import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        budgetCategories: {
          include: {
            lineItems: true,
          },
        },
        contracts: {
          select: {
            id: true,
            title: true,
            amount: true,
            type: true,
            status: true,
            startDate: true,
            endDate: true,
            vendor: { select: { id: true, name: true, company: true } },
          },
        },
        drawRequests: {
          include: {
            lineItems: true,
          },
          orderBy: { drawNumber: 'asc' },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Failed to fetch project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
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

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.tenant !== undefined && { tenant: body.tenant }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.stage !== undefined && { stage: body.stage }),
        ...(body.startDate !== undefined && { startDate: new Date(body.startDate) }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
        ...(body.totalBudget !== undefined && { totalBudget: body.totalBudget }),
        ...(body.projectManager !== undefined && { projectManager: body.projectManager }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.projectGroup !== undefined && { projectGroup: body.projectGroup }),
        // Track record fields
        ...(body.completionDate !== undefined && { completionDate: body.completionDate ? new Date(body.completionDate) : null }),
        ...(body.finalBudget !== undefined && { finalBudget: body.finalBudget }),
        ...(body.finalCost !== undefined && { finalCost: body.finalCost }),
        ...(body.irr !== undefined && { irr: body.irr }),
        ...(body.equityMultiple !== undefined && { equityMultiple: body.equityMultiple }),
        ...(body.profitAmount !== undefined && { profitAmount: body.profitAmount }),
        ...(body.holdPeriodMonths !== undefined && { holdPeriodMonths: body.holdPeriodMonths }),
        ...(body.holdStartDate !== undefined && { holdStartDate: body.holdStartDate ? new Date(body.holdStartDate) : null }),
        ...(body.holdEndDate !== undefined && { holdEndDate: body.holdEndDate ? new Date(body.holdEndDate) : null }),
        ...(body.completionNotes !== undefined && { completionNotes: body.completionNotes }),
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error('Failed to update project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
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

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    await prisma.project.delete({ where: { id } });

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
