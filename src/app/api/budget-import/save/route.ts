import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

interface LineItemInput {
  description: string;
  originalBudget: number;
  revisedBudget: number;
}

interface CategoryInput {
  name: string;
  categoryGroup: string;
  lineItems: LineItemInput[];
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, categories, clearExisting } = body as {
      projectId: string;
      categories: CategoryInput[];
      clearExisting: boolean;
    };

    if (!projectId || !categories || !Array.isArray(categories)) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId and categories' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Before deleting anything, snapshot existing actualCosts keyed by
      // lowercase description so we can restore them on the new line items.
      const preservedActuals = new Map<string, number>();
      if (clearExisting) {
        const existing = await tx.budgetCategory.findMany({
          where: { projectId },
          include: {
            lineItems: { select: { description: true, actualCost: true } },
          },
        });
        for (const cat of existing) {
          for (const li of cat.lineItems) {
            preservedActuals.set(li.description.trim().toLowerCase(), li.actualCost);
          }
        }

        // Now delete existing categories/line items
        const existingCategories = await tx.budgetCategory.findMany({
          where: { projectId },
          select: { id: true },
        });
        const categoryIds = existingCategories.map((c) => c.id);

        if (categoryIds.length > 0) {
          await tx.budgetLineItem.deleteMany({
            where: { categoryId: { in: categoryIds } },
          });
          await tx.budgetCategory.deleteMany({
            where: { projectId },
          });
        }
      }

      // Create new categories with line items, restoring any prior actualCost
      for (const cat of categories) {
        await tx.budgetCategory.create({
          data: {
            projectId,
            name: cat.name,
            categoryGroup: cat.categoryGroup,
            lineItems: {
              create: cat.lineItems.map((li) => ({
                description: li.description,
                originalBudget: li.originalBudget,
                revisedBudget: li.revisedBudget,
                committedCost: 0,
                actualCost: preservedActuals.get(li.description.trim().toLowerCase()) ?? 0,
              })),
            },
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save budget:', error);
    return NextResponse.json(
      { error: 'Failed to save budget' },
      { status: 500 }
    );
  }
}
