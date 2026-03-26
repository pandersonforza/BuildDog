import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      where: { status: "Completed" },
      orderBy: { completionDate: "desc" },
      select: {
        id: true,
        name: true,
        address: true,
        tenant: true,
        projectManager: true,
        completionDate: true,
        finalBudget: true,
        finalCost: true,
        irr: true,
        equityMultiple: true,
        profitAmount: true,
        holdPeriodMonths: true,
        completionNotes: true,
      },
    });

    // Compute summary stats
    const count = projects.length;
    const withIrr = projects.filter((p) => p.irr != null);
    const avgIrr = withIrr.length > 0
      ? withIrr.reduce((s, p) => s + (p.irr ?? 0), 0) / withIrr.length
      : null;

    const withBudget = projects.filter((p) => p.finalBudget != null && p.finalCost != null);
    const underBudget = withBudget.filter((p) => (p.finalCost ?? 0) <= (p.finalBudget ?? 0)).length;
    const overBudget = withBudget.filter((p) => (p.finalCost ?? 0) > (p.finalBudget ?? 0)).length;

    const totalProfit = projects.reduce((s, p) => s + (p.profitAmount ?? 0), 0);

    const withEquity = projects.filter((p) => p.equityMultiple != null);
    const avgEquityMultiple = withEquity.length > 0
      ? withEquity.reduce((s, p) => s + (p.equityMultiple ?? 0), 0) / withEquity.length
      : null;

    const avgHoldPeriod = projects.filter((p) => p.holdPeriodMonths != null).length > 0
      ? projects.filter((p) => p.holdPeriodMonths != null).reduce((s, p) => s + (p.holdPeriodMonths ?? 0), 0) / projects.filter((p) => p.holdPeriodMonths != null).length
      : null;

    return NextResponse.json({
      projects,
      summary: {
        count,
        avgIrr,
        underBudget,
        overBudget,
        totalProfit,
        avgEquityMultiple,
        avgHoldPeriod,
      },
    });
  } catch (error) {
    console.error("Track record error:", error);
    return NextResponse.json({ error: "Failed to load track record" }, { status: 500 });
  }
}
