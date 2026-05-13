import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { put } from '@vercel/blob';

/** Compute the next available DF-XXXX number by scanning existing invoices. */
async function getNextDevFeeNumber(): Promise<number> {
  const dfInvoices = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: 'DF-' } },
    select: { invoiceNumber: true },
  });

  let max = 0;
  for (const inv of dfInvoices) {
    const match = inv.invoiceNumber?.match(/^DF-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

function formatDevFeeNumber(n: number): string {
  return `DF-${String(n).padStart(4, '0')}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Build a PDF for a dev-fee invoice and return its bytes. */
async function generateDevFeePdf(opts: {
  invoiceNumber: string;
  invoiceDate: Date;
  vendorName: string;
  projectName: string;
  projectAddress: string;
  milestones: { name: string; devFee: number }[];
  totalAmount: number;
  approverName: string | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const lineHeight = 18;
  const teal = rgb(0.16, 0.6, 0.6);
  const dark = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.45, 0.45, 0.45);

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const text = (
    str: string,
    x: number,
    yPos: number,
    opts?: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb>; rightAlign?: boolean }
  ) => {
    const f = opts?.bold ? fontBold : font;
    const sz = opts?.size ?? 10;
    const col = opts?.color ?? dark;
    const xPos = opts?.rightAlign ? x - f.widthOfTextAtSize(str, sz) : x;
    page.drawText(str, { x: xPos, y: yPos, font: f, size: sz, color: col });
  };

  const hline = (yPos: number, x1 = margin, x2 = pageWidth - margin, thickness = 0.5, color = rgb(0.8, 0.8, 0.8)) => {
    page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness, color });
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  // ── Header ──────────────────────────────────────────────
  text('PropHound', margin, y, { bold: true, size: 20, color: teal });
  text('DEVELOPMENT FEE INVOICE', pageWidth - margin, y, { bold: true, size: 11, color: muted, rightAlign: true });
  y -= 8;
  hline(y, margin, pageWidth - margin, 1.5, teal);
  y -= 20;

  // Invoice meta — two columns
  text('Invoice Number:', margin, y, { bold: true, size: 10 });
  text(opts.invoiceNumber, margin + 110, y, { size: 10, color: teal });
  text('Invoice Date:', pageWidth - margin - 200, y, { bold: true, size: 10 });
  text(formatDate(opts.invoiceDate), pageWidth - margin - 95, y, { size: 10 });
  y -= lineHeight;

  text('Billed By:', margin, y, { bold: true, size: 10 });
  text(opts.vendorName, margin + 110, y, { size: 10 });
  if (opts.approverName) {
    text('Approver:', pageWidth - margin - 200, y, { bold: true, size: 10 });
    text(opts.approverName, pageWidth - margin - 95, y, { size: 10 });
  }
  y -= lineHeight;

  text('Project:', margin, y, { bold: true, size: 10 });
  text(opts.projectName, margin + 110, y, { size: 10 });
  y -= lineHeight;

  if (opts.projectAddress) {
    text('Address:', margin, y, { bold: true, size: 10 });
    text(opts.projectAddress, margin + 110, y, { size: 10 });
    y -= lineHeight;
  }

  y -= 10;
  hline(y);
  y -= 20;

  // ── Milestone table ──────────────────────────────────────
  text('Milestone', margin, y, { bold: true, size: 9, color: muted });
  text('Dev Fee', pageWidth - margin, y, { bold: true, size: 9, color: muted, rightAlign: true });
  y -= 6;
  hline(y);
  y -= lineHeight;

  for (const m of opts.milestones) {
    ensureSpace(lineHeight + 4);
    text(m.name, margin, y, { size: 10 });
    text(formatCurrency(m.devFee), pageWidth - margin, y, { size: 10, rightAlign: true });
    y -= lineHeight;
  }

  // Total row
  ensureSpace(lineHeight + 14);
  y -= 4;
  hline(y, margin, pageWidth - margin, 1, dark);
  y -= lineHeight;
  text('Total', margin, y, { bold: true, size: 12 });
  text(formatCurrency(opts.totalAmount), pageWidth - margin, y, { bold: true, size: 12, color: teal, rightAlign: true });
  y -= 30;

  // ── Footer note ──────────────────────────────────────────
  ensureSpace(30);
  hline(y, margin, pageWidth - margin, 0.5, rgb(0.85, 0.85, 0.85));
  y -= 14;
  text(`Generated ${formatDate(new Date())}`, margin, y, { size: 8, color: muted });
  text('PropHound', pageWidth - margin, y, { size: 8, color: teal, rightAlign: true });

  return doc.save();
}

// ── GET: preview next invoice number ────────────────────────────────────────

/** GET — returns the next available dev-fee invoice number for preview. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const next = await getNextDevFeeNumber();
    return NextResponse.json({ formatted: formatDevFeeNumber(next) });
  } catch {
    return NextResponse.json({ error: 'Failed to get next invoice number' }, { status: 500 });
  }
}

// ── POST: create invoice + PDF ───────────────────────────────────────────────

/** POST — create a dev-fee invoice (with attached PDF) for the selected milestones. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as {
      projectId: string;
      milestoneIds: string[];
      vendorName: string;
      date: string;
      approverId?: string;
      submitForApproval?: boolean;
    };

    const { projectId, milestoneIds, vendorName, date } = body;

    if (!projectId || !milestoneIds?.length || !vendorName?.trim() || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    // Fetch milestones + project info in parallel
    const [milestones, project] = await Promise.all([
      prisma.milestone.findMany({
        where: { id: { in: milestoneIds }, projectId },
        select: { id: true, name: true, devFee: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, address: true },
      }),
    ]);

    if (milestones.length === 0) {
      return NextResponse.json({ error: 'No matching milestones found' }, { status: 404 });
    }

    const totalAmount = milestones.reduce((sum, m) => sum + m.devFee, 0);

    // Resolve optional approver
    let approverName: string | null = null;
    if (body.approverId) {
      const approver = await prisma.user.findUnique({
        where: { id: body.approverId },
        select: { name: true },
      });
      approverName = approver?.name ?? null;
    }

    // Generate invoice number
    const invoiceNumber = formatDevFeeNumber(await getNextDevFeeNumber());

    // Generate PDF
    const pdfBytes = await generateDevFeePdf({
      invoiceNumber,
      invoiceDate: parsedDate,
      vendorName: vendorName.trim(),
      projectName: project?.name ?? 'Unknown Project',
      projectAddress: project?.address ?? '',
      milestones,
      totalAmount,
      approverName,
    });

    // Upload PDF to Vercel Blob
    const blobName = `invoices/dev-fee/${invoiceNumber}.pdf`;
    const blob = await put(blobName, Buffer.from(pdfBytes), {
      access: 'public',
      contentType: 'application/pdf',
    });

    const milestoneLines = milestones
      .map((m) => `${m.name}: $${m.devFee.toFixed(2)}`)
      .join('\n');

    const invoice = await prisma.invoice.create({
      data: {
        vendorName: vendorName.trim(),
        invoiceNumber,
        amount: totalAmount,
        date: parsedDate,
        description: `Dev Fee: ${milestones.map((m) => m.name).join(', ')}`,
        projectId,
        filePath: blob.url,
        status: body.submitForApproval ? 'Submitted' : 'Pending Review',
        approverId: body.approverId ?? null,
        approver: approverName,
        submittedBy: body.submitForApproval ? user.name : null,
        submittedById: body.submitForApproval ? user.id : null,
        submittedDate: body.submitForApproval ? new Date() : null,
        aiNotes: `Dev Fee Invoice\n\nMilestones:\n${milestoneLines}`,
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Failed to create dev fee invoice:', error);
    return NextResponse.json({ error: 'Failed to create dev fee invoice' }, { status: 500 });
  }
}
