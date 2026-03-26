import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const category = await prisma.budgetCategory.findUnique({
      where: { id },
      include: {
        lineItems: true,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Budget category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('Failed to fetch budget category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget category' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.budgetCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Budget category not found' },
        { status: 404 }
      );
    }

    const category = await prisma.budgetCategory.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.categoryGroup !== undefined && { categoryGroup: body.categoryGroup }),
      },
      include: {
        lineItems: true,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Failed to update budget category:', error);
    return NextResponse.json(
      { error: 'Failed to update budget category' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.budgetCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Budget category not found' },
        { status: 404 }
      );
    }

    await prisma.budgetCategory.delete({ where: { id } });

    return NextResponse.json({ message: 'Budget category deleted successfully' });
  } catch (error) {
    console.error('Failed to delete budget category:', error);
    return NextResponse.json(
      { error: 'Failed to delete budget category' },
      { status: 500 }
    );
  }
}
