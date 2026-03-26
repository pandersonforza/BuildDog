import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const where: Record<string, unknown> = {};
    if (projectId) {
      where.projectId = projectId;
    }

    const drawRequests = await prisma.drawRequest.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, status: true } },
        lineItems: {
          include: {
            budgetLineItem: {
              select: { id: true, description: true, revisedBudget: true, actualCost: true, committedCost: true, categoryId: true },
            },
          },
        },
        invoices: {
          select: {
            id: true,
            vendorName: true,
            invoiceNumber: true,
            amount: true,
            date: true,
            status: true,
            lineItem: {
              select: {
                id: true,
                description: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { drawNumber: 'asc' },
    });

    return NextResponse.json(drawRequests);
  } catch (error) {
    console.error('Failed to fetch draw requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draw requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { projectId, invoiceIds } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing required field: projectId' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Auto-assign next draw number
    const lastDraw = await prisma.drawRequest.findFirst({
      where: { projectId },
      orderBy: { drawNumber: 'desc' },
      select: { drawNumber: true },
    });

    const drawNumber = (lastDraw?.drawNumber ?? 0) + 1;

    // Calculate total from selected invoices
    let totalAmount = body.totalAmount ?? 0;
    if (invoiceIds && invoiceIds.length > 0) {
      const invoices = await prisma.invoice.findMany({
        where: { id: { in: invoiceIds } },
      });
      totalAmount = invoices.reduce((sum: number, inv: { amount: number }) => sum + inv.amount, 0);
    }

    const drawRequest = await prisma.$transaction(async (tx) => {
      const draw = await tx.drawRequest.create({
        data: {
          projectId,
          drawNumber,
          status: 'Draft',
          totalAmount,
          notes: body.notes ?? null,
        },
      });

      // Link selected invoices to this draw
      if (invoiceIds && invoiceIds.length > 0) {
        await tx.invoice.updateMany({
          where: { id: { in: invoiceIds } },
          data: { drawRequestId: draw.id },
        });
      }

      return tx.drawRequest.findUnique({
        where: { id: draw.id },
        include: {
          lineItems: {
            include: {
              budgetLineItem: true,
            },
          },
          invoices: true,
        },
      });
    });

    return NextResponse.json(drawRequest, { status: 201 });
  } catch (error) {
    console.error('Failed to create draw request:', error);
    return NextResponse.json(
      { error: 'Failed to create draw request' },
      { status: 500 }
    );
  }
}
