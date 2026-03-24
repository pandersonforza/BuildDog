import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const milestones = await prisma.milestone.findMany({
      include: {
        project: { select: { id: true, name: true, status: true } },
      },
      orderBy: [{ project: { name: "asc" } }, { sortOrder: "asc" }],
    });

    return NextResponse.json(milestones);
  } catch {
    return NextResponse.json({ error: "Failed to fetch milestones" }, { status: 500 });
  }
}
