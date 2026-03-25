"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface MilestoneWithProject {
  id: string;
  name: string;
  description: string | null;
  devFee: number;
  paidAmount: number;
  expectedDate: string | null;
  completedDate: string | null;
  status: string;
  project: { id: string; name: string; status: string };
}

const PIE_COLORS = ["#10b981", "#64748b"];

export default function MilestonesOverviewPage() {
  const [milestones, setMilestones] = useState<MilestoneWithProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/milestones/overview")
      .then((r) => r.json())
      .then(setMilestones)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const totalExpected = milestones.reduce((s, m) => s + m.devFee, 0);
  const totalPaid = milestones.reduce((s, m) => s + m.paidAmount, 0);
  const totalRemaining = totalExpected - totalPaid;
  const completedCount = milestones.filter((m) => m.status === "Completed").length;
  const pendingCount = milestones.filter((m) => m.status === "Pending").length;

  const pieData = [
    { name: "Completed", value: completedCount },
    { name: "Pending", value: pendingCount },
  ].filter((d) => d.value > 0);

  // Group milestones by project for the cards
  const projectGroups = new Map<string, { project: { id: string; name: string }; milestones: MilestoneWithProject[] }>();
  for (const m of milestones) {
    const existing = projectGroups.get(m.project.id);
    if (existing) {
      existing.milestones.push(m);
    } else {
      projectGroups.set(m.project.id, { project: m.project, milestones: [m] });
    }
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Milestones Overview</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Expected Fees</p>
            <p className="text-lg font-semibold">{formatCurrency(totalExpected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Paid to Date</p>
            <p className="text-lg font-semibold text-emerald-400">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Remaining</p>
            <p className="text-lg font-semibold text-amber-400">{formatCurrency(totalRemaining)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Pie Chart */}
      {milestones.length > 0 && pieData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Overall Milestone Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-Project Summary Cards */}
      {[...projectGroups.values()].map(({ project, milestones: pMilestones }) => {
        const pExpected = pMilestones.reduce((s, m) => s + m.devFee, 0);
        const pPaid = pMilestones.reduce((s, m) => s + m.paidAmount, 0);
        const pCompleted = pMilestones.filter((m) => m.status === "Completed").length;

        return (
          <Card key={project.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <Link href={`/projects/${project.id}/milestones`} className="text-base font-semibold hover:text-primary hover:underline">
                  {project.name}
                </Link>
                <div className="flex gap-6 text-sm text-muted-foreground">
                  <span>Expected: <span className="text-foreground font-medium">{formatCurrency(pExpected)}</span></span>
                  <span>Paid: <span className="text-emerald-400 font-medium">{formatCurrency(pPaid)}</span></span>
                  <span>{pCompleted}/{pMilestones.length} complete</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {milestones.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No milestones found across any projects.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
