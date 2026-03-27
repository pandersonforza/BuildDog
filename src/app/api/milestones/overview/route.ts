import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const group = request.nextUrl.searchParams.get("group");
    const milestones = await prisma.milestone.findMany({
      where: group ? { project: { projectGroup: group } } : undefined,
      include: {
        project: { select: { id: true, name: true, address: true, status: true, projectGroup: true, projectedOpenYear: true } },
      },
      orderBy: [{ project: { name: "asc" } }, { sortOrder: "asc" }],
    });

    return NextResponse.json(milestones);
  } catch {
    return NextResponse.json({ error: "Failed to fetch milestones" }, { status: 500 });
  }
}
