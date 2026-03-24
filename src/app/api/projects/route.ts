import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const stage = searchParams.get('stage');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }
    if (stage) {
      where.stage = stage;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { projectManager: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch projects with only the numeric fields needed for aggregation
    const projects = await prisma.project.findMany({
      where,
      include: {
        budgetCategories: {
          select: {
            lineItems: {
              select: {
                committedCost: true,
                actualCost: true,
                originalBudget: true,
                revisedBudget: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const projectsWithAggregates = projects.map((project) => {
      let totalCommitted = 0;
      let totalSpent = 0;
      let totalOriginalBudget = 0;
      let totalRevisedBudget = 0;

      for (const category of project.budgetCategories) {
        for (const item of category.lineItems) {
          totalCommitted += item.committedCost;
          totalSpent += item.actualCost;
          totalOriginalBudget += item.originalBudget;
          totalRevisedBudget += item.revisedBudget;
        }
      }

      return {
        ...project,
        aggregates: {
          totalOriginalBudget,
          totalRevisedBudget,
          totalCommitted,
          totalSpent,
          totalRemaining: totalRevisedBudget - totalSpent - totalCommitted,
        },
      };
    });

    return NextResponse.json(projectsWithAggregates);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { name, address, projectManager } = body;

    if (!name || !address || !projectManager) {
      return NextResponse.json(
        { error: 'Missing required fields: name, address, projectManager' },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name,
        address,
        tenant: body.tenant || null,
        status: body.status ?? 'Active',
        stage: body.stage ?? 'Pre-Development',
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        totalBudget: body.totalBudget ?? 0,
        projectManager,
        description: body.description ?? null,
        budgetCategories: {
          create: [
            { name: "Hard Costs", categoryGroup: "Hard Costs" },
            { name: "Soft Costs", categoryGroup: "Soft Costs" },
            { name: "Financing Costs", categoryGroup: "Financing" },
            { name: "Land & Acquisition", categoryGroup: "Land" },
          ],
        },
      },
      include: {
        budgetCategories: true,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
