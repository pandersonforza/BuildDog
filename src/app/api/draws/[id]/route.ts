import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const STATUS_ORDER = ['Draft', 'Submitted', 'Approved', 'Funded'] as const;

function getStatusIndex(status: string): number {
  return STATUS_ORDER.indexOf(status as (typeof STATUS_ORDER)[number]);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const drawRequest = await prisma.drawRequest.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, status: true, address: true } },
        lineItems: {
          include: {
            budgetLineItem: {
              include: { category: { select: { id: true, name: true, categoryGroup: true } } },
            },
          },
        },
      },
    });

    if (!drawRequest) {
      return NextResponse.json(
        { error: 'Draw request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(drawRequest);
  } catch (error) {
    console.error('Failed to fetch draw request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draw request' },
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

    const existing = await prisma.drawRequest.findUnique({
      where: { id },
      include: {
        lineItems: {
          select: { id: true, budgetLineItemId: true, thisDrawAmount: true },
        },
        invoices: { select: { id: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Draw request not found' },
        { status: 404 }
      );
    }

    // Handle status transitions
    if (body.status && body.status !== existing.status) {
      const currentIndex = getStatusIndex(existing.status);
      const newIndex = getStatusIndex(body.status);

      if (newIndex === -1) {
        return NextResponse.json(
          { error: `Invalid status: ${body.status}. Must be one of: ${STATUS_ORDER.join(', ')}` },
          { status: 400 }
        );
      }

      if (newIndex <= currentIndex) {
        return NextResponse.json(
          { error: `Cannot transition from ${existing.status} to ${body.status}. Backward transitions are not allowed.` },
          { status: 400 }
        );
      }

      if (newIndex !== currentIndex + 1) {
        return NextResponse.json(
          { error: `Cannot skip statuses. Must transition from ${existing.status} to ${STATUS_ORDER[currentIndex + 1]}.` },
          { status: 400 }
        );
      }

      // Draft -> Submitted: require at least 1 line item or invoice
      if (existing.status === 'Draft' && body.status === 'Submitted') {
        if (existing.lineItems.length === 0 && existing.invoices.length === 0) {
          return NextResponse.json(
            { error: 'Cannot submit draw request without at least one line item or invoice' },
            { status: 400 }
          );
        }
        body.submittedDate = new Date().toISOString();
      }

      // Submitted -> Approved
      if (existing.status === 'Submitted' && body.status === 'Approved') {
        body.approvedDate = new Date().toISOString();
      }

      // Approved -> Funded: update actualCost on budget line items in a transaction
      if (existing.status === 'Approved' && body.status === 'Funded') {
        body.fundedDate = new Date().toISOString();

        await prisma.$transaction(async (tx) => {
          for (const drawLineItem of existing.lineItems) {
            await tx.budgetLineItem.update({
              where: { id: drawLineItem.budgetLineItemId },
              data: {
                actualCost: {
                  increment: drawLineItem.thisDrawAmount,
                },
              },
            });
          }

          await tx.drawRequest.update({
            where: { id },
            data: {
              status: body.status,
              fundedDate: new Date(body.fundedDate),
              ...(body.notes !== undefined && { notes: body.notes }),
              ...(body.totalAmount !== undefined && { totalAmount: body.totalAmount }),
            },
          });
        });

        const updated = await prisma.drawRequest.findUnique({
          where: { id },
          include: {
            lineItems: {
              include: { budgetLineItem: true },
            },
          },
        });

        return NextResponse.json(updated);
      }
    }

    const drawRequest = await prisma.drawRequest.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.totalAmount !== undefined && { totalAmount: body.totalAmount }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.submittedDate !== undefined && { submittedDate: new Date(body.submittedDate) }),
        ...(body.approvedDate !== undefined && { approvedDate: new Date(body.approvedDate) }),
        ...(body.fundedDate !== undefined && { fundedDate: new Date(body.fundedDate) }),
      },
      include: {
        lineItems: {
          include: { budgetLineItem: true },
        },
      },
    });

    return NextResponse.json(drawRequest);
  } catch (error) {
    console.error('Failed to update draw request:', error);
    return NextResponse.json(
      { error: 'Failed to update draw request' },
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

    const existing = await prisma.drawRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Draw request not found' },
        { status: 404 }
      );
    }

    if (existing.status === 'Funded') {
      return NextResponse.json(
        { error: 'Cannot delete a funded draw request' },
        { status: 400 }
      );
    }

    await prisma.drawRequest.delete({ where: { id } });

    return NextResponse.json({ message: 'Draw request deleted successfully' });
  } catch (error) {
    console.error('Failed to delete draw request:', error);
    return NextResponse.json(
      { error: 'Failed to delete draw request' },
      { status: 500 }
    );
  }
}
