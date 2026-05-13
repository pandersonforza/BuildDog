import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

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

/** POST — create a dev-fee invoice for the selected milestones. */
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

    // Fetch the selected milestones
    const milestones = await prisma.milestone.findMany({
      where: { id: { in: milestoneIds }, projectId },
      select: { id: true, name: true, devFee: true },
    });

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

    // Generate the next sequential number at creation time
    const invoiceNumber = formatDevFeeNumber(await getNextDevFeeNumber());

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
