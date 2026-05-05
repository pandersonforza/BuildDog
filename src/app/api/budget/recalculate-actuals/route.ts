import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // 1. Fetch all approved/paid invoices for this project
    const invoices = await prisma.invoice.findMany({
      where: {
        projectId,
        status: { in: ['Approved', 'Paid'] },
      },
      select: {
        id: true,
        amount: true,
        budgetLineItemId: true,
        aiNotes: true,
      },
    });

    // 2. Build a Map<lineItemId, totalActual> from invoices
    const actuals = new Map<string, number>();

    for (const invoice of invoices) {
      const isPayApp = invoice.aiNotes?.includes('__payAppLineItems__');

      if (isPayApp && invoice.aiNotes) {
        // Pay app: distribute amounts to individual line items stored in aiNotes
        const match = invoice.aiNotes.match(/__payAppLineItems__([\s\S]+)$/);
        if (match) {
          try {
            const items: { lineItemId: string; amount: number }[] = JSON.parse(match[1]);
            for (const item of items) {
              if (item.lineItemId && item.amount !== 0) {
                actuals.set(item.lineItemId, (actuals.get(item.lineItemId) ?? 0) + item.amount);
              }
            }
          } catch {
            // Skip malformed pay app data — can't recover these
          }
        }
      } else if (invoice.budgetLineItemId) {
        actuals.set(
          invoice.budgetLineItemId,
          (actuals.get(invoice.budgetLineItemId) ?? 0) + invoice.amount
        );
      }
    }

    // 3. Get all line items for the project
    const categories = await prisma.budgetCategory.findMany({
      where: { projectId },
      include: { lineItems: { select: { id: true } } },
    });

    const allLineItemIds = categories.flatMap((c) => c.lineItems.map((li) => li.id));

    // 4. Update every line item's actualCost in a single transaction
    await prisma.$transaction(
      allLineItemIds.map((id) =>
        prisma.budgetLineItem.update({
          where: { id },
          data: { actualCost: actuals.get(id) ?? 0 },
        })
      )
    );

    const recovered = allLineItemIds.filter((id) => (actuals.get(id) ?? 0) !== 0).length;

    return NextResponse.json({
      success: true,
      lineItemsUpdated: allLineItemIds.length,
      lineItemsWithActuals: recovered,
      invoicesProcessed: invoices.length,
    });
  } catch (error) {
    console.error('Failed to recalculate actuals:', error);
    return NextResponse.json({ error: 'Failed to recalculate actuals' }, { status: 500 });
  }
}
