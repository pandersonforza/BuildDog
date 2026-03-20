import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    const projects = await prisma.project.findMany({
      include: {
        budgetCategories: {
          include: {
            lineItems: true,
          },
        },
        invoices: {
          where: {
            status: { in: ['Approved', 'Paid'] },
          },
          select: { amount: true, status: true },
        },
      },
    });

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

      // Compute spent from actual approved/paid invoices
      const projectSpent = project.invoices.reduce(
        (sum: number, inv: { amount: number }) => sum + inv.amount, 0
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

    // Top 5 projects by budget
    const topProjects = projectSummaries
      .sort((a, b) => b.totalBudget - a.totalBudget)
      .slice(0, 5);

    // Calculate paid this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const paidThisMonth = await prisma.invoice.aggregate({
      where: {
        status: 'Paid',
        paidDate: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });
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
