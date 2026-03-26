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
          include: {
            vendor: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        drawRequests: {
          include: {
            lineItems: true,
          },
          orderBy: { drawNumber: 'asc' },
        },
        invoices: {
          where: {
            status: { in: ['Approved', 'Paid'] },
          },
          select: { amount: true, budgetLineItemId: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Budget by category group
    const categoryGroupMap: Record<
      string,
      { group: string; originalBudget: number; revisedBudget: number; committed: number; spent: number }
    > = {};

    const varianceByLineItem: Array<{
      id: string;
      description: string;
      categoryGroup: string;
      categoryName: string;
      originalBudget: number;
      revisedBudget: number;
      committedCost: number;
      actualCost: number;
      variance: number;
      percentUsed: number;
    }> = [];

    for (const category of project.budgetCategories) {
      const group = category.categoryGroup;
      if (!categoryGroupMap[group]) {
        categoryGroupMap[group] = {
          group,
          originalBudget: 0,
          revisedBudget: 0,
          committed: 0,
          spent: 0,
        };
      }

      for (const item of category.lineItems) {
        // Use the line item's actualCost field directly (editable by admin)
        const itemActualCost = item.actualCost;

        categoryGroupMap[group].originalBudget += item.originalBudget;
        categoryGroupMap[group].revisedBudget += item.revisedBudget;
        categoryGroupMap[group].committed += item.committedCost;
        categoryGroupMap[group].spent += itemActualCost;

        const variance = item.revisedBudget - itemActualCost;
        const percentUsed =
          item.revisedBudget > 0
            ? (itemActualCost / item.revisedBudget) * 100
            : 0;

        varianceByLineItem.push({
          id: item.id,
          description: item.description,
          categoryGroup: category.categoryGroup,
          categoryName: category.name,
          originalBudget: item.originalBudget,
          revisedBudget: item.revisedBudget,
          committedCost: item.committedCost,
          actualCost: itemActualCost,
          variance,
          percentUsed: Math.round(percentUsed * 100) / 100,
        });
      }
    }

    const budgetByCategory = Object.values(categoryGroupMap).sort((a, b) =>
      a.group.localeCompare(b.group)
    );

    // Draw history with cumulative totals
    let cumulativeAmount = 0;
    const drawHistory = project.drawRequests.map((draw) => {
      const drawTotal = draw.lineItems.reduce(
        (sum, item) => sum + item.thisDrawAmount,
        0
      );
      cumulativeAmount += draw.status === 'Funded' ? drawTotal : 0;

      return {
        id: draw.id,
        drawNumber: draw.drawNumber,
        status: draw.status,
        totalAmount: draw.totalAmount,
        submittedDate: draw.submittedDate,
        approvedDate: draw.approvedDate,
        fundedDate: draw.fundedDate,
        cumulativeFunded: cumulativeAmount,
        lineItemCount: draw.lineItems.length,
      };
    });

    // Sort variance by most over-budget first
    varianceByLineItem.sort((a, b) => a.variance - b.variance);

    // Compute budget summary from actual line items
    let totalOriginalBudget = 0;
    let totalRevisedBudget = 0;
    let totalCommittedCost = 0;
    let totalActualCost = 0;

    const categorySummaries = project.budgetCategories.map((category) => {
      let catOriginal = 0;
      let catRevised = 0;
      let catCommitted = 0;
      let catActual = 0;

      for (const item of category.lineItems) {
        catOriginal += item.originalBudget;
        catRevised += item.revisedBudget;
        catCommitted += item.committedCost;
        catActual += item.actualCost;
      }

      totalOriginalBudget += catOriginal;
      totalRevisedBudget += catRevised;
      totalCommittedCost += catCommitted;
      totalActualCost += catActual;

      const catVariance = catRevised - catActual;
      const catVariancePercent = catRevised > 0 ? (catVariance / catRevised) * 100 : 0;

      return {
        id: category.id,
        name: category.name,
        categoryGroup: category.categoryGroup,
        originalBudget: catOriginal,
        revisedBudget: catRevised,
        committedCost: catCommitted,
        actualCost: catActual,
        variance: catVariance,
        variancePercent: Math.round(catVariancePercent * 100) / 100,
        lineItemCount: category.lineItems.length,
      };
    });

    const totalVariance = totalRevisedBudget - totalActualCost;
    const totalVariancePercent = totalRevisedBudget > 0 ? (totalVariance / totalRevisedBudget) * 100 : 0;
    const percentComplete = totalRevisedBudget > 0 ? (totalActualCost / totalRevisedBudget) * 100 : 0;

    const budgetSummary = {
      originalBudget: totalOriginalBudget,
      revisedBudget: totalRevisedBudget,
      committedCost: totalCommittedCost,
      actualCost: totalActualCost,
      variance: totalVariance,
      variancePercent: Math.round(totalVariancePercent * 100) / 100,
      percentComplete: Math.round(percentComplete * 100) / 100,
    };

    // Recent draws (last 5)
    const recentDraws = project.drawRequests.slice(-5).reverse().map((draw) => ({
      id: draw.id,
      drawNumber: draw.drawNumber,
      status: draw.status,
      totalAmount: draw.totalAmount,
      createdAt: draw.createdAt,
    }));

    // Recent contracts (last 5)
    const recentContracts = project.contracts.slice(0, 5).map((contract) => ({
      id: contract.id,
      title: contract.title,
      amount: contract.amount,
      status: contract.status,
      vendor: { name: contract.vendor.name },
    }));

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        totalBudget: project.totalBudget,
        status: project.status,
        stage: project.stage,
      },
      budgetSummary,
      categorySummaries,
      budgetByCategory,
      drawHistory,
      recentDraws,
      recentContracts,
      varianceByLineItem,
    });
  } catch (error) {
    console.error('Failed to fetch project analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project analytics' },
      { status: 500 }
    );
  }
}
