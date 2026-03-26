import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    if (!categoryId) {
      return NextResponse.json(
        { error: 'categoryId query parameter is required' },
        { status: 400 }
      );
    }

    const lineItems = await prisma.budgetLineItem.findMany({
      where: { categoryId },
      include: {
        category: { select: { id: true, name: true, categoryGroup: true, projectId: true } },
      },
      orderBy: { description: 'asc' },
    });

    return NextResponse.json(lineItems);
  } catch (error) {
    console.error('Failed to fetch budget line items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget line items' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { categoryId, description, originalBudget } = body;

    if (!categoryId || !description || originalBudget == null) {
      return NextResponse.json(
        { error: 'Missing required fields: categoryId, description, originalBudget' },
        { status: 400 }
      );
    }

    if (typeof originalBudget !== 'number' || originalBudget < 0) {
      return NextResponse.json(
        { error: 'originalBudget must be a non-negative number' },
        { status: 400 }
      );
    }

    const category = await prisma.budgetCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
      return NextResponse.json(
        { error: 'Budget category not found' },
        { status: 404 }
      );
    }

    const lineItem = await prisma.budgetLineItem.create({
      data: {
        categoryId,
        description,
        originalBudget,
        revisedBudget: body.revisedBudget ?? originalBudget,
        committedCost: 0,
        actualCost: 0,
      },
    });

    return NextResponse.json(lineItem, { status: 201 });
  } catch (error) {
    console.error('Failed to create budget line item:', error);
    return NextResponse.json(
      { error: 'Failed to create budget line item' },
      { status: 500 }
    );
  }
}
