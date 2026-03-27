import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time migration: assign H7B group to all projects whose name starts with "H7B".
// DELETE this route after running it.
export async function POST() {
  const result = await prisma.project.updateMany({
    where: { name: { startsWith: "H7B" } },
    data: { projectGroup: "H7B" },
  });

  const updated = await prisma.project.findMany({
    where: { projectGroup: "H7B" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ updated: result.count, projects: updated });
}
