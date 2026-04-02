import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { put } from '@vercel/blob';

export const maxDuration = 300;

const APPROVER_EMAIL = 'panderson@forzacommercial.com';
const BOT_SUBMITTER_NAME = 'Invoices';

// Resend signs inbound webhooks — verify the signature to prevent spoofing
async function verifyResendSignature(request: NextRequest, rawBody: string): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification if secret not configured (dev only)

  const signature = request.headers.get('svix-signature');
  const msgId = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');

  if (!signature || !msgId || !timestamp) return false;

  try {
    const { Webhook } = await import('svix');
    const wh = new Webhook(secret);
    wh.verify(rawBody, {
      'svix-id': msgId,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    });
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    const isValid = await verifyResendSignature(request, rawBody);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // Resend inbound email event structure
    const emailData = payload.data ?? payload;
    const attachments: Array<{ filename: string; content: string; contentType: string }> =
      emailData.attachments ?? [];

    // Filter to PDF attachments only
    const pdfAttachments = attachments.filter(
      (a) => a.contentType === 'application/pdf' || a.filename?.toLowerCase().endsWith('.pdf')
    );

    if (pdfAttachments.length === 0) {
      return NextResponse.json({ message: 'No PDF attachments found, skipping' }, { status: 200 });
    }

    // Look up the approver
    const approver = await prisma.user.findUnique({
      where: { email: APPROVER_EMAIL },
      select: { id: true, name: true },
    });

    if (!approver) {
      console.error(`Approver not found: ${APPROVER_EMAIL}`);
      return NextResponse.json({ error: 'Approver not found' }, { status: 500 });
    }

    const results = [];

    for (const attachment of pdfAttachments) {
      try {
        // Decode base64 PDF and upload to Vercel Blob
        const pdfBuffer = Buffer.from(attachment.content, 'base64');
        const filename = attachment.filename || `invoice-${Date.now()}.pdf`;

        const blob = await put(`invoices/${Date.now()}-${filename}`, pdfBuffer, {
          access: 'public',
          contentType: 'application/pdf',
        });

        // Run AI processing
        const processRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/invoices/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: blob.url }),
        });

        if (!processRes.ok) {
          console.error('AI processing failed for', filename);
          results.push({ filename, status: 'ai_failed' });
          continue;
        }

        const { invoices: processedInvoices } = await processRes.json() as {
          invoices: Array<{
            vendorName: string;
            invoiceNumber: string | null;
            amount: number;
            date: string;
            description: string;
            suggestedProjectId: string | null;
            suggestedBudgetLineItemId: string | null;
            confidence: number;
            reasoning: string;
          }>;
        };

        for (const inv of processedInvoices) {
          const isPayApp = false; // Email attachments are standard invoices
          const hasGoodMatch = inv.confidence >= 0.6 && inv.suggestedProjectId && inv.suggestedBudgetLineItemId;

          // Create the invoice
          const invoice = await prisma.invoice.create({
            data: {
              vendorName: inv.vendorName,
              amount: inv.amount,
              date: new Date(inv.date),
              filePath: blob.url,
              invoiceNumber: inv.invoiceNumber ?? null,
              description: inv.description ?? null,
              aiConfidence: inv.confidence,
              aiNotes: inv.reasoning,
              submittedBy: BOT_SUBMITTER_NAME,
              // Only assign project/line item if AI is confident
              projectId: hasGoodMatch ? inv.suggestedProjectId : null,
              budgetLineItemId: (hasGoodMatch && !isPayApp) ? inv.suggestedBudgetLineItemId : null,
              // Always set approver and auto-submit
              approver: approver.name,
              approverId: approver.id,
              status: 'Submitted',
              submittedDate: new Date(),
            },
          });

          results.push({ filename, invoiceId: invoice.id, status: 'submitted' });
        }
      } catch (err) {
        console.error('Error processing attachment', attachment.filename, err);
        results.push({ filename: attachment.filename, status: 'error' });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    console.error('Inbound email webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
