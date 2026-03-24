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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
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

  // Group by project for the bar chart
  const projectMap = new Map<string, { name: string; id: string; expected: number; paid: number }>();
  for (const m of milestones) {
    const existing = projectMap.get(m.project.id);
    if (existing) {
      existing.expected += m.devFee;
      existing.paid += m.paidAmount;
    } else {
      projectMap.set(m.project.id, {
        name: m.project.name,
        id: m.project.id,
        expected: m.devFee,
        paid: m.paidAmount,
      });
    }
  }
  const projectBarData = [...projectMap.values()].map((p) => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + "…" : p.name,
    "Expected Fees": p.expected,
    "Paid to Date": p.paid,
  }));

  // Group milestones by project for the table
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Progress</p>
            <p className="text-lg font-semibold">
              {completedCount} / {milestones.length} complete
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {milestones.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Status Pie */}
          <Card>
            <CardHeader>
              <CardTitle>Overall Milestone Status</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              {pieData.length > 0 ? (
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
              ) : (
                <p className="text-muted-foreground text-sm">No data</p>
              )}
            </CardContent>
          </Card>

          {/* Fees by Project Bar */}
          <Card>
            <CardHeader>
              <CardTitle>Dev Fees by Project</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={projectBarData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Legend />
                  <Bar dataKey="Expected Fees" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Paid to Date" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Per-Project Breakdown */}
      {[...projectGroups.values()].map(({ project, milestones: pMilestones }) => {
        const pExpected = pMilestones.reduce((s, m) => s + m.devFee, 0);
        const pPaid = pMilestones.reduce((s, m) => s + m.paidAmount, 0);
        const pCompleted = pMilestones.filter((m) => m.status === "Completed").length;

        return (
          <Card key={project.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  <Link href={`/projects/${project.id}/milestones`} className="hover:text-primary hover:underline">
                    {project.name}
                  </Link>
                </CardTitle>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Expected: <span className="text-foreground font-medium">{formatCurrency(pExpected)}</span></span>
                  <span>Paid: <span className="text-emerald-400 font-medium">{formatCurrency(pPaid)}</span></span>
                  <span>{pCompleted}/{pMilestones.length} complete</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pMilestones.map((m) => {
                  const isCompleted = m.status === "Completed";
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between py-2 px-3 rounded-md ${
                        isCompleted ? "bg-emerald-900/10 opacity-70" : "bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-4 w-4 rounded border-2 flex items-center justify-center ${
                            isCompleted
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isCompleted && (
                            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm font-medium ${isCompleted ? "line-through" : ""}`}>
                          {m.name}
                        </span>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <span className="text-muted-foreground">
                          Fee: <span className="text-foreground">{formatCurrency(m.devFee)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Paid: <span className="text-emerald-400">{formatCurrency(m.paidAmount)}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
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
