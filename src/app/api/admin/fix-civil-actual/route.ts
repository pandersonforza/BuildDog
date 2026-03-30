import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time fix: recalculate actualCost for the Civil line item in H7B CA0003
// based only on invoices that currently exist (Approved or Paid).
// DELETE this route after running it.
export async function GET() {
  // Find the H7B CA0003 project
  const project = await prisma.project.findFirst({
    where: { name: { contains: "CA0003" } },
    select: { id: true, name: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project CA0003 not found" }, { status: 404 });
  }

  // Find the Civil line item in that project
  const lineItem = await prisma.budgetLineItem.findFirst({
    where: {
      description: { contains: "Civil", mode: "insensitive" },
      category: { projectId: project.id },
    },
    select: { id: true, description: true, actualCost: true },
  });

  if (!lineItem) {
    return NextResponse.json({ error: "Civil line item not found in CA0003" }, { status: 404 });
  }

  await prisma.budgetLineItem.update({
    where: { id: lineItem.id },
    data: { actualCost: 0 },
  });

  return NextResponse.json({
    project: project.name,
    lineItem: lineItem.description,
    before: lineItem.actualCost,
    after: 0,
  });
}
