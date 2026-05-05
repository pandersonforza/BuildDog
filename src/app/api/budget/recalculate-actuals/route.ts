import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { projectId, relinks = [] } = await request.json() as {
      projectId: string;
      relinks?: { invoiceId: string; lineItemId: string }[];
    };
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Apply any admin-supplied relinks first so the recalculate picks them up via normal ID matching
    if (relinks.length > 0) {
      await prisma.$transaction(
        relinks.map(({ invoiceId, lineItemId }) =>
          prisma.invoice.update({
            where: { id: invoiceId },
            data: { budgetLineItemId: lineItemId },
          })
        )
      );
    }

    // 1. Load all current line items and build two lookup maps:
    //    - lineItemIdSet: for fast ID existence checks
    //    - descToId: normalized description → lineItemId (fallback for re-imported budgets
    //      where onDelete:SetNull wiped budgetLineItemId off all invoices)
    const categories = await prisma.budgetCategory.findMany({
      where: { projectId },
      include: { lineItems: { select: { id: true, description: true } } },
    });

    const allLineItems = categories.flatMap((c) => c.lineItems);
    const lineItemIdSet = new Set(allLineItems.map((li) => li.id));
    const descToId = new Map<string, string>();
    for (const li of allLineItems) {
      descToId.set(li.description.trim().toLowerCase(), li.id);
    }

    // 2. Fetch every approved/paid invoice for this project
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
        vendorName: true,
        description: true,
      },
    });

    // 3. Accumulate actuals, matching by ID first then description
    const actuals = new Map<string, number>();
    const unmatched: { id: string; vendorName: string; amount: number; reason: string }[] = [];

    for (const invoice of invoices) {
      const isPayApp = invoice.aiNotes?.includes('__payAppLineItems__');

      if (isPayApp && invoice.aiNotes) {
        // Pay app: each line item stored in aiNotes with its own description + amount.
        // After a budget re-import the lineItemIds in aiNotes are stale — fall back to
        // description matching against the current line items.
        const match = invoice.aiNotes.match(/__payAppLineItems__([\s\S]+)$/);
        if (match) {
          try {
            const items: { lineItemId: string; description: string; amount: number }[] =
              JSON.parse(match[1]);

            for (const item of items) {
              if (item.amount === 0) continue;

              // Try current ID first (works when budget was NOT re-imported)
              if (item.lineItemId && lineItemIdSet.has(item.lineItemId)) {
                actuals.set(item.lineItemId, (actuals.get(item.lineItemId) ?? 0) + item.amount);
                continue;
              }

              // Fall back to description match (handles re-import case)
              if (item.description) {
                const matchedId = descToId.get(item.description.trim().toLowerCase());
                if (matchedId) {
                  actuals.set(matchedId, (actuals.get(matchedId) ?? 0) + item.amount);
                  continue;
                }
              }

              // Truly unmatched pay-app line item
              unmatched.push({
                id: invoice.id,
                vendorName: invoice.vendorName,
                amount: item.amount,
                reason: `Pay-app line "${item.description ?? '(no description)'}" has no matching budget line item`,
              });
            }
          } catch {
            unmatched.push({
              id: invoice.id,
              vendorName: invoice.vendorName,
              amount: invoice.amount,
              reason: 'Could not parse pay-app line items',
            });
          }
        }
      } else {
        // Regular invoice: match by budgetLineItemId (may be null after re-import)
        if (invoice.budgetLineItemId && lineItemIdSet.has(invoice.budgetLineItemId)) {
          actuals.set(
            invoice.budgetLineItemId,
            (actuals.get(invoice.budgetLineItemId) ?? 0) + invoice.amount
          );
        } else {
          // budgetLineItemId is null (wiped by onDelete:SetNull) or stale.
          // These invoices need to be manually re-linked by an admin.
          unmatched.push({
            id: invoice.id,
            vendorName: invoice.vendorName,
            amount: invoice.amount,
            reason: 'Invoice is not linked to a budget line item — re-link it and run again',
          });
        }
      }
    }

    // 4. Write the computed actuals back in a single transaction.
    //    Line items with no matching invoices are set to 0.
    await prisma.$transaction(
      allLineItems.map((li) =>
        prisma.budgetLineItem.update({
          where: { id: li.id },
          data: { actualCost: actuals.get(li.id) ?? 0 },
        })
      )
    );

    return NextResponse.json({
      success: true,
      lineItemsUpdated: allLineItems.length,
      invoicesProcessed: invoices.length,
      invoicesMatched: invoices.length - unmatched.length,
      unmatchedCount: unmatched.length,
      unmatched,
    });
  } catch (error) {
    console.error('Failed to recalculate actuals:', error);
    return NextResponse.json({ error: 'Failed to recalculate actuals' }, { status: 500 });
  }
}
