import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

interface ProcessedInvoice {
  vendorName: string;
  invoiceNumber: string | null;
  amount: number;
  date: string;
  description: string;
  suggestedProjectId: string | null;
  suggestedBudgetLineItemId: string | null;
  confidence: number;
  reasoning: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath } = body;

    if (!filePath) {
      return NextResponse.json(
        { error: 'Missing required field: filePath' },
        { status: 400 }
      );
    }

    // Fetch PDF from blob URL or local path
    let pdfBuffer: Buffer;
    try {
      if (filePath.startsWith('http')) {
        // For Vercel Blob private stores, use the token to authenticate
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        const res = await fetch(filePath, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status} ${res.statusText}`);
        pdfBuffer = Buffer.from(await res.arrayBuffer());
      } else {
        const { readFile } = await import('fs/promises');
        const path = await import('path');
        const absolutePath = path.join(process.cwd(), 'public', filePath);
        pdfBuffer = await readFile(absolutePath);
      }
    } catch (fetchErr) {
      console.error('File fetch error:', fetchErr);
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown error';
      return NextResponse.json(
        { error: `File not found: ${msg}` },
        { status: 404 }
      );
    }

    // Only fetch active projects to keep context small
    const projects = await prisma.project.findMany({
      where: { status: 'Active' },
      select: {
        id: true,
        name: true,
        budgetCategories: {
          select: {
            id: true,
            name: true,
            lineItems: {
              select: { id: true, description: true },
              // Limit line items per category to keep prompt size manageable
              take: 30,
            },
          },
        },
      },
    });

    const vendors = await prisma.vendor.findMany({
      select: { id: true, name: true, company: true, category: true },
    });

    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('ANTHROPIC_API_KEY not set — returning mock response for testing');
      const mockResult: ProcessedInvoice = {
        vendorName: 'Sample Vendor LLC',
        invoiceNumber: 'INV-2024-001',
        amount: 5250.00,
        date: new Date().toISOString().split('T')[0],
        description: 'Construction materials and supplies',
        suggestedProjectId: projects.length > 0 ? projects[0].id : null,
        suggestedBudgetLineItemId:
          projects.length > 0 &&
          projects[0].budgetCategories.length > 0 &&
          projects[0].budgetCategories[0].lineItems.length > 0
            ? projects[0].budgetCategories[0].lineItems[0].id
            : null,
        confidence: 0.45,
        reasoning: 'Mock response — ANTHROPIC_API_KEY not configured. Set the environment variable to enable AI-powered invoice processing.',
      };
      return NextResponse.json(mockResult);
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const base64Pdf = pdfBuffer.toString('base64');

    const projectContext = projects
      .map((p) => {
        const categories = p.budgetCategories
          .map((cat) => {
            const items = cat.lineItems
              .map((li) => `      - LineItem ID: "${li.id}" | Name: "${li.description}"`)
              .join('\n');
            return `    Category: "${cat.name}" (ID: "${cat.id}")\n${items}`;
          })
          .join('\n');
        return `  Project: "${p.name}" (ID: "${p.id}")\n${categories}`;
      })
      .join('\n\n');

    const vendorContext = vendors
      .map((v) => `  - "${v.name}" (Company: "${v.company}", Category: "${v.category}")`)
      .join('\n');

    const systemPrompt = `You are an expert invoice processing assistant for a real estate development company. Your job is to analyze invoice PDFs and extract structured data.

Here are the available projects and their budget line items:

${projectContext || '  (No projects available)'}

Here are the known vendors:

${vendorContext || '  (No vendors available)'}

Analyze the provided PDF. It may contain ONE or MULTIPLE invoices. Carefully check for page breaks, different vendor names, different invoice numbers, or other indicators that separate invoices exist within the document.

Return ONLY valid JSON with no additional text or markdown formatting.

Required JSON structure — ALWAYS return an object with an "invoices" array, even for a single invoice:
{
  "invoices": [
    {
      "vendorName": "string - the vendor/company name on the invoice",
      "invoiceNumber": "string or null - the invoice number if present",
      "amount": number - the total amount due (numeric, no currency symbols),
      "date": "string - invoice date in YYYY-MM-DD format",
      "description": "string - brief description of goods/services",
      "suggestedProjectId": "string or null - the ID of the best matching project from the list above",
      "suggestedBudgetLineItemId": "string or null - the ID of the best matching budget line item from the list above",
      "confidence": number between 0 and 1 - how confident you are in the project/line item match,
      "reasoning": "string - brief explanation of why you chose this project and line item"
    }
  ]
}

Guidelines:
- If the PDF contains multiple invoices (different vendors, invoice numbers, or clearly separated sections), extract EACH one as a separate entry in the array.
- Match vendors to known vendors when possible (fuzzy matching on name/company).
- Match to projects and line items based on the description, vendor category, and amount.
- If no good match exists, set suggestedProjectId and suggestedBudgetLineItemId to null with low confidence.
- Always extract vendorName, amount, and date even if you cannot match to a project.
- For the date, use the invoice date (not due date or payment date).
- For the amount, use the total amount due (including tax if shown).`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          // Cache the project/vendor context — same across all invoice calls
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf,
              },
            },
            {
              type: 'text',
              text: 'Extract all invoices from this PDF and return the JSON response.',
            },
          ],
        },
      ],
    } as Parameters<typeof anthropic.messages.create>[0]) as Awaited<ReturnType<typeof anthropic.messages.create>> & { content: Array<{ type: string; text?: string }> };

    const textBlock = response.content.find((block: { type: string }) => block.type === 'text') as { type: 'text'; text: string } | undefined;
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'No text response received from AI' },
        { status: 502 }
      );
    }

    let jsonText = textBlock.text.trim();

    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    let parsed: { invoices?: ProcessedInvoice[] } & ProcessedInvoice;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error('Failed to parse AI response as JSON:', jsonText);
      return NextResponse.json(
        { error: 'Failed to parse AI response. The model did not return valid JSON.' },
        { status: 502 }
      );
    }

    // Normalize: always return { invoices: [...] }
    let invoices: ProcessedInvoice[];
    if (Array.isArray(parsed.invoices)) {
      invoices = parsed.invoices;
    } else if (parsed.vendorName) {
      // Single invoice returned as flat object (backward compat)
      invoices = [parsed];
    } else {
      return NextResponse.json(
        { error: 'AI response is missing required fields.' },
        { status: 502 }
      );
    }

    // Validate each invoice
    for (const inv of invoices) {
      if (!inv.vendorName || inv.amount === undefined || !inv.date) {
        return NextResponse.json(
          { error: 'AI response is missing required fields (vendorName, amount, date) on one or more invoices.' },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('Failed to process invoice:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to process invoice: ${message}` },
      { status: 500 }
    );
  }
}
