import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const draw = await prisma.drawRequest.findUnique({
      where: { id },
      include: {
        project: true,
        invoices: {
          include: {
            lineItem: {
              include: { category: true },
            },
          },
          orderBy: { vendorName: 'asc' },
        },
        lineItems: {
          include: {
            budgetLineItem: {
              include: { category: true },
            },
          },
        },
      },
    });

    if (!draw) {
      return NextResponse.json({ error: 'Draw not found' }, { status: 404 });
    }

    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(amount);

    const formatDate = (date: Date | string | null) => {
      if (!date) return '—';
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Create the summary PDF
    const summaryDoc = await PDFDocument.create();
    const font = await summaryDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await summaryDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 612; // Letter width
    const pageHeight = 792; // Letter height
    const margin = 50;
    const lineHeight = 16;

    let page = summaryDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const addText = (text: string, x: number, yPos: number, options?: { font?: typeof font; size?: number; color?: ReturnType<typeof rgb> }) => {
      page.drawText(text, {
        x,
        y: yPos,
        font: options?.font || font,
        size: options?.size || 10,
        color: options?.color || rgb(0.1, 0.1, 0.1),
      });
    };

    const drawLine = (x1: number, yPos: number, x2: number) => {
      page.drawLine({
        start: { x: x1, y: yPos },
        end: { x: x2, y: yPos },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });
    };

    const ensureSpace = (needed: number) => {
      if (y - needed < margin) {
        page = summaryDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    };

    // Header
    addText('BuildDog', margin, y, { font: fontBold, size: 18, color: rgb(0.16, 0.6, 0.6) });
    y -= 30;

    addText(`Draw Request #${draw.drawNumber}`, margin, y, { font: fontBold, size: 16 });
    y -= 20;

    addText(`Project: ${draw.project.name}`, margin, y, { size: 11 });
    y -= lineHeight;

    addText(`Status: ${draw.status}`, margin, y, { size: 11 });
    addText(`Date: ${formatDate(draw.createdAt)}`, margin + 250, y, { size: 11 });
    y -= lineHeight;

    addText(`Total Amount: ${formatCurrency(draw.totalAmount)}`, margin, y, { font: fontBold, size: 12, color: rgb(0.16, 0.6, 0.6) });
    y -= 10;

    drawLine(margin, y, pageWidth - margin);
    y -= 25;

    // Invoice Summary Section
    if (draw.invoices.length > 0) {
      addText('Invoice Summary', margin, y, { font: fontBold, size: 14 });
      y -= 20;

      // Table header
      const col1 = margin;       // Vendor
      const col2 = margin + 170; // Invoice #
      const col3 = margin + 260; // Line Item
      const col4 = margin + 400; // Date
      const col5 = pageWidth - margin; // Amount (right-aligned)

      addText('Vendor', col1, y, { font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.4) });
      addText('Invoice #', col2, y, { font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.4) });
      addText('Line Item', col3, y, { font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.4) });
      addText('Date', col4, y, { font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.4) });
      addText('Amount', col5 - 50, y, { font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.4) });
      y -= 5;
      drawLine(margin, y, pageWidth - margin);
      y -= lineHeight;

      let invoiceTotal = 0;

      for (const invoice of draw.invoices) {
        ensureSpace(lineHeight + 5);

        const vendorText = invoice.vendorName.length > 25
          ? invoice.vendorName.slice(0, 25) + '...'
          : invoice.vendorName;
        addText(vendorText, col1, y, { size: 9 });
        addText(invoice.invoiceNumber || '—', col2, y, { size: 9 });

        const lineItemText = invoice.lineItem
          ? `${invoice.lineItem.category.name} - ${invoice.lineItem.description}`
          : '—';
        const truncatedLineItem = lineItemText.length > 22
          ? lineItemText.slice(0, 22) + '...'
          : lineItemText;
        addText(truncatedLineItem, col3, y, { size: 9 });

        addText(formatDate(invoice.date), col4, y, { size: 9 });

        const amountStr = formatCurrency(invoice.amount);
        const amountWidth = font.widthOfTextAtSize(amountStr, 9);
        addText(amountStr, col5 - amountWidth, y, { size: 9 });

        invoiceTotal += invoice.amount;
        y -= lineHeight;
      }

      // Total row
      ensureSpace(lineHeight + 10);
      drawLine(margin, y + 8, pageWidth - margin);
      y -= 2;
      addText('Total', col1, y, { font: fontBold, size: 10 });
      addText(`${draw.invoices.length} invoice(s)`, col2, y, { size: 9, color: rgb(0.4, 0.4, 0.4) });
      const totalStr = formatCurrency(invoiceTotal);
      const totalWidth = fontBold.widthOfTextAtSize(totalStr, 10);
      addText(totalStr, col5 - totalWidth, y, { font: fontBold, size: 10, color: rgb(0.16, 0.6, 0.6) });
      y -= 30;
    }

    // Notes section
    if (draw.notes) {
      ensureSpace(50);
      addText('Notes', margin, y, { font: fontBold, size: 12 });
      y -= lineHeight;
      // Wrap notes text
      const words = draw.notes.split(' ');
      let line = '';
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, 10);
        if (width > pageWidth - 2 * margin) {
          ensureSpace(lineHeight);
          addText(line, margin, y, { size: 10 });
          y -= lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        ensureSpace(lineHeight);
        addText(line, margin, y, { size: 10 });
        y -= lineHeight;
      }
    }

    // Save summary PDF
    const summaryBytes = await summaryDoc.save();

    // Now merge with invoice PDFs
    const mergedDoc = await PDFDocument.load(summaryBytes);

    for (const invoice of draw.invoices) {
      if (invoice.filePath) {
        try {
          let fileBytes: Buffer;
          if (invoice.filePath.startsWith('http')) {
            const token = process.env.BLOB_READ_WRITE_TOKEN;
            const res = await fetch(invoice.filePath, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) throw new Error('Failed to fetch');
            fileBytes = Buffer.from(await res.arrayBuffer());
          } else {
            const { readFile } = await import('fs/promises');
            const path = await import('path');
            const absolutePath = path.join(process.cwd(), 'public', invoice.filePath);
            fileBytes = await readFile(absolutePath);
          }

          // Try to load as PDF
          const invoicePdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
          const pages = await mergedDoc.copyPages(invoicePdf, invoicePdf.getPageIndices());
          for (const p of pages) {
            mergedDoc.addPage(p);
          }
        } catch (err) {
          // If the file can't be loaded as PDF, add a placeholder page
          const placeholderPage = mergedDoc.addPage([pageWidth, pageHeight]);
          const placeholderFont = await mergedDoc.embedFont(StandardFonts.Helvetica);
          placeholderPage.drawText(`Invoice: ${invoice.vendorName}`, {
            x: margin,
            y: pageHeight - margin,
            font: placeholderFont,
            size: 14,
            color: rgb(0.1, 0.1, 0.1),
          });
          placeholderPage.drawText(`File could not be loaded: ${invoice.filePath}`, {
            x: margin,
            y: pageHeight - margin - 25,
            font: placeholderFont,
            size: 10,
            color: rgb(0.5, 0.5, 0.5),
          });
        }
      }
    }

    const finalBytes = await mergedDoc.save();

    const filename = `Draw_${draw.drawNumber}_${draw.project.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    return new NextResponse(Buffer.from(finalBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Failed to generate draw PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate draw PDF' },
      { status: 500 }
    );
  }
}
