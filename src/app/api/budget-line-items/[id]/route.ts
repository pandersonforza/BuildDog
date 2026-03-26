import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const lineItem = await prisma.budgetLineItem.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, categoryGroup: true, projectId: true },
        },
        drawLineItems: {
          select: {
            id: true,
            thisDrawAmount: true,
            previousDraws: true,
            drawRequest: { select: { id: true, drawNumber: true, status: true } },
          },
        },
      },
    });

    if (!lineItem) {
      return NextResponse.json(
        { error: 'Budget line item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(lineItem);
  } catch (error) {
    console.error('Failed to fetch budget line item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget line item' },
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

    const existing = await prisma.budgetLineItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Budget line item not found' },
        { status: 404 }
      );
    }

    const lineItem = await prisma.budgetLineItem.update({
      where: { id },
      data: {
        ...(body.description !== undefined && { description: body.description }),
        ...(body.originalBudget !== undefined && { originalBudget: body.originalBudget }),
        ...(body.revisedBudget !== undefined && { revisedBudget: body.revisedBudget }),
        ...(body.committedCost !== undefined && { committedCost: body.committedCost }),
        ...(body.actualCost !== undefined && { actualCost: body.actualCost }),
      },
    });

    return NextResponse.json(lineItem);
  } catch (error) {
    console.error('Failed to update budget line item:', error);
    return NextResponse.json(
      { error: 'Failed to update budget line item' },
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

    const existing = await prisma.budgetLineItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Budget line item not found' },
        { status: 404 }
      );
    }

    await prisma.budgetLineItem.delete({ where: { id } });

    return NextResponse.json({ message: 'Budget line item deleted successfully' });
  } catch (error) {
    console.error('Failed to delete budget line item:', error);
    return NextResponse.json(
      { error: 'Failed to delete budget line item' },
      { status: 500 }
    );
  }
}
