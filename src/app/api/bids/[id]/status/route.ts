import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["Submitted", "Under Review", "Accepted", "Rejected"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await request.json();

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const bid = await prisma.bid.update({
      where: { id },
      data: { status },
      include: { lineItems: true },
    });

    // When a bid is accepted, add line items as committed costs in the budget
    if (status === "Accepted") {
      await addBidToBudget(bid.projectId, bid.lineItems);
    }

    return NextResponse.json(bid);
  } catch {
    return NextResponse.json({ error: "Failed to update bid status" }, { status: 500 });
  }
}

async function addBidToBudget(
  projectId: string,
  bidLineItems: { description: string; amount: number; category: string | null }[]
) {
  // Group bid line items by category
  const byCategory = new Map<string, { description: string; amount: number }[]>();
  for (const li of bidLineItems) {
    const cat = li.category || "Uncategorized";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push({ description: li.description, amount: li.amount });
  }

  const categoryNames = [...byCategory.keys()];

  // Batch fetch: get all existing budget categories for this project in one query
  const existingCategories = await prisma.budgetCategory.findMany({
    where: { projectId, name: { in: categoryNames } },
    include: { lineItems: { select: { id: true, description: true, committedCost: true } } },
  });

  const categoryMap = new Map(existingCategories.map((c) => [c.name, c]));

  // Create missing categories in batch
  const missingNames = categoryNames.filter((n) => !categoryMap.has(n));
  if (missingNames.length > 0) {
    await prisma.budgetCategory.createMany({
      data: missingNames.map((name) => ({
        projectId,
        name,
        categoryGroup: "Hard Costs",
      })),
    });
    // Fetch the newly created categories
    const newCats = await prisma.budgetCategory.findMany({
      where: { projectId, name: { in: missingNames } },
      include: { lineItems: { select: { id: true, description: true, committedCost: true } } },
    });
    for (const c of newCats) categoryMap.set(c.name, c);
  }

  // Now process all line items with minimal queries using a transaction
  const operations: Parameters<typeof prisma.$transaction>[0] = [];

  for (const [categoryName, items] of byCategory) {
    const category = categoryMap.get(categoryName)!;
    const lineItemMap = new Map(category.lineItems.map((li) => [li.description, li]));

    for (const item of items) {
      const existing = lineItemMap.get(item.description);
      if (existing) {
        operations.push(
          prisma.budgetLineItem.update({
            where: { id: existing.id },
            data: { committedCost: existing.committedCost + item.amount },
          })
        );
      } else {
        operations.push(
          prisma.budgetLineItem.create({
            data: {
              categoryId: category.id,
              description: item.description,
              originalBudget: 0,
              revisedBudget: 0,
              committedCost: item.amount,
              actualCost: 0,
            },
          })
        );
      }
    }
  }

  // Execute all updates/creates in a single transaction
  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }
}
