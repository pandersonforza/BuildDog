"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { PROJECT_GROUPS } from "@/lib/constants";
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
  project: { id: string; name: string; address: string; status: string; projectedOpenYear: number | null };
}

const PIE_COLORS = ["#10b981", "#64748b"];

export default function MilestonesOverviewPage() {
  const [milestones, setMilestones] = useState<MilestoneWithProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");

  useEffect(() => {
    setIsLoading(true);
    const params = groupFilter !== "All" ? `?group=${encodeURIComponent(groupFilter)}` : "";
    fetch(`/api/milestones/overview${params}`)
      .then((r) => r.json())
      .then(setMilestones)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [groupFilter]);

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

  // Get unique years from milestone projects
  const years = [...new Set(milestones.map((m) => m.project.projectedOpenYear).filter(Boolean))].sort() as number[];

  // Filter by year
  const filteredMilestones = yearFilter === "All"
    ? milestones
    : milestones.filter((m) => String(m.project.projectedOpenYear) === yearFilter);

  const totalExpected = filteredMilestones.reduce((s, m) => s + m.devFee, 0);
  const totalPaid = filteredMilestones.reduce((s, m) => s + m.paidAmount, 0);
  const totalRemaining = totalExpected - totalPaid;
  const completedCount = filteredMilestones.filter((m) => m.status === "Completed").length;
  const pendingCount = filteredMilestones.filter((m) => m.status === "Pending").length;

  const pieData = [
    { name: "Completed", value: completedCount },
    { name: "Pending", value: pendingCount },
  ].filter((d) => d.value > 0);

  // Dev fees by year summary
  const feesByYear = new Map<number, { expected: number; paid: number }>();
  for (const m of milestones) {
    const yr = m.project.projectedOpenYear;
    if (!yr) continue;
    const existing = feesByYear.get(yr) || { expected: 0, paid: 0 };
    existing.expected += m.devFee;
    existing.paid += m.paidAmount;
    feesByYear.set(yr, existing);
  }
  const feesByYearData = [...feesByYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, data]) => ({ year, ...data, remaining: data.expected - data.paid }));

  // Group milestones by project for the cards
  const projectGroups = new Map<string, { project: { id: string; name: string }; milestones: MilestoneWithProject[] }>();
  for (const m of filteredMilestones) {
    const existing = projectGroups.get(m.project.id);
    if (existing) {
      existing.milestones.push(m);
    } else {
      projectGroups.set(m.project.id, { project: m.project, milestones: [m] });
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold">Milestones Overview</h1>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          {["All", ...PROJECT_GROUPS].map((g) => (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                groupFilter === g
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        {years.length > 0 && (
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            <button
              onClick={() => setYearFilter("All")}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                yearFilter === "All"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Years
            </button>
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYearFilter(String(y))}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  yearFilter === String(y)
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dev Fees by Year */}
      {feesByYearData.length > 1 && yearFilter === "All" && (
        <Card>
          <CardHeader>
            <CardTitle>Dev Fees by Year</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">Year</th>
                  <th className="py-2 pr-4 text-right">Expected</th>
                  <th className="py-2 pr-4 text-right">Paid</th>
                  <th className="py-2 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {feesByYearData.map((row) => (
                  <tr key={row.year} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium">{row.year}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(row.expected)}</td>
                    <td className="py-2 pr-4 text-right text-emerald-400">{formatCurrency(row.paid)}</td>
                    <td className="py-2 text-right text-amber-400">{formatCurrency(row.remaining)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary/20 font-semibold">
                  <td className="py-2 pr-4">Total</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(feesByYearData.reduce((s, r) => s + r.expected, 0))}</td>
                  <td className="py-2 pr-4 text-right text-emerald-400">{formatCurrency(feesByYearData.reduce((s, r) => s + r.paid, 0))}</td>
                  <td className="py-2 text-right text-amber-400">{formatCurrency(feesByYearData.reduce((s, r) => s + r.remaining, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

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
                <div>
                  <Link href={`/projects/${project.id}/milestones`} className="text-base font-semibold hover:text-primary hover:underline">
                    {project.name}
                  </Link>
                  {project.address && (
                    <p className="text-xs text-muted-foreground mt-0.5">{project.address}</p>
                  )}
                </div>
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
