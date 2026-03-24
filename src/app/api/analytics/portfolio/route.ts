import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    // Run queries in parallel for speed
    const [projects, paidThisMonth] = await Promise.all([
      prisma.project.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          stage: true,
          totalBudget: true,
          budgetCategories: {
            select: {
              lineItems: {
                select: {
                  committedCost: true,
                  revisedBudget: true,
                },
              },
            },
          },
          invoices: {
            where: { status: { in: ['Approved', 'Paid'] } },
            select: { amount: true },
          },
        },
      }),
      prisma.invoice.aggregate({
        where: {
          status: 'Paid',
          paidDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { amount: true },
      }),
    ]);

    let totalBudget = 0;
    let totalSpent = 0;
    let totalCommitted = 0;

    const projectsByStatus: Record<string, number> = {};
    const projectsByStage: Record<string, number> = {};

    const projectSummaries = projects.map((project) => {
      let projectCommitted = 0;
      let projectBudget = 0;

      for (const category of project.budgetCategories) {
        for (const item of category.lineItems) {
          projectCommitted += item.committedCost;
          projectBudget += item.revisedBudget;
        }
      }

      const projectSpent = project.invoices.reduce(
        (sum, inv) => sum + inv.amount, 0
      );

      const budget = projectBudget > 0 ? projectBudget : project.totalBudget;
      totalBudget += budget;
      totalSpent += projectSpent;
      totalCommitted += projectCommitted;

      projectsByStatus[project.status] = (projectsByStatus[project.status] ?? 0) + 1;
      projectsByStage[project.stage] = (projectsByStage[project.stage] ?? 0) + 1;

      return {
        id: project.id,
        name: project.name,
        totalBudget: budget,
        spent: projectSpent,
        committed: projectCommitted,
        status: project.status,
        stage: project.stage,
      };
    });

    const topProjects = projectSummaries
      .sort((a, b) => b.totalBudget - a.totalBudget)
      .slice(0, 5);

    const monthlyPaid = paidThisMonth._sum.amount ?? 0;
    const totalRemaining = totalBudget - totalSpent;
    const activeProjects = projectsByStatus["Active"] ?? 0;

    return NextResponse.json({
      monthlyPaid,
      totalBudget,
      totalSpent,
      totalCommitted,
      totalActualCost: totalSpent,
      totalRemaining,
      totalProjects: projects.length,
      projectCount: projects.length,
      activeProjects,
      totalDrawsFunded: 0,
      budgetVariance: totalBudget - totalSpent,
      budgetVariancePercent: totalBudget > 0 ? ((totalBudget - totalSpent) / totalBudget) * 100 : 0,
      projectsByStatus,
      projectsByStage,
      topProjects,
    });
  } catch (error) {
    console.error('Failed to fetch portfolio analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio analytics' },
      { status: 500 }
    );
  }
}
