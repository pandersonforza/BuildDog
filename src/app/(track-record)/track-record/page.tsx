"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Target, DollarSign, Clock, BarChart3 } from "lucide-react";

interface TrackRecordProject {
  id: string;
  name: string;
  address: string;
  tenant: string | null;
  projectManager: string;
  completionDate: string | null;
  finalBudget: number | null;
  finalCost: number | null;
  irr: number | null;
  equityMultiple: number | null;
  profitAmount: number | null;
  holdPeriodMonths: number | null;
  completionNotes: string | null;
}

interface Summary {
  count: number;
  avgIrr: number | null;
  underBudget: number;
  overBudget: number;
  totalProfit: number;
  avgEquityMultiple: number | null;
  avgHoldPeriod: number | null;
}

export default function TrackRecordPage() {
  const [projects, setProjects] = useState<TrackRecordProject[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/track-record")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects || []);
        setSummary(data.summary || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <h1 className="text-3xl font-bold">Track Record</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const budgetChartData = projects
    .filter((p) => p.finalBudget != null && p.finalCost != null)
    .map((p) => ({
      name: p.name.length > 15 ? p.name.slice(0, 15) + "…" : p.name,
      variance: (p.finalCost ?? 0) - (p.finalBudget ?? 0),
      overBudget: (p.finalCost ?? 0) > (p.finalBudget ?? 0),
    }));

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Track Record</h1>

      {summary && summary.count === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No completed projects yet. Mark a project as &quot;Completed&quot; and enter its track record stats to see them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <p className="text-2xl font-bold">{summary?.count ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Avg IRR</p>
                </div>
                <p className="text-2xl font-bold">
                  {summary?.avgIrr != null ? `${summary.avgIrr.toFixed(1)}%` : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Total Profit</p>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(summary?.totalProfit ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs text-muted-foreground">Under Budget</p>
                </div>
                <p className="text-2xl font-bold">{summary?.underBudget ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <p className="text-xs text-muted-foreground">Over Budget</p>
                </div>
                <p className="text-2xl font-bold">{summary?.overBudget ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Avg Hold</p>
                </div>
                <p className="text-2xl font-bold">
                  {summary?.avgHoldPeriod != null ? `${Math.round(summary.avgHoldPeriod)}mo` : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Budget Variance Chart */}
          {budgetChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Budget Variance by Project</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={budgetChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} />
                      <YAxis tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        formatter={(value) => [formatCurrency(Number(value)), "Variance"]}
                      />
                      <Bar dataKey="variance" radius={[4, 4, 0, 0]}>
                        {budgetChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.overBudget ? "#ef4444" : "#10b981"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Project Table */}
          <Card>
            <CardHeader>
              <CardTitle>Completed Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 px-3">Project</th>
                      <th className="py-2 px-3 text-right">Final Budget</th>
                      <th className="py-2 px-3 text-right">Final Cost</th>
                      <th className="py-2 px-3 text-right">Variance</th>
                      <th className="py-2 px-3 text-right">IRR</th>
                      <th className="py-2 px-3 text-right">Equity Multiple</th>
                      <th className="py-2 px-3 text-right">Profit</th>
                      <th className="py-2 px-3 text-right">Hold Period</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => {
                      const variance = (p.finalBudget != null && p.finalCost != null)
                        ? p.finalCost - p.finalBudget
                        : null;
                      const isOver = variance != null && variance > 0;
                      return (
                        <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-3">
                            <Link href={`/projects/${p.id}`} className="font-medium text-primary hover:underline">
                              {p.name}
                            </Link>
                            {p.tenant && <span className="text-xs text-muted-foreground ml-2">{p.tenant}</span>}
                          </td>
                          <td className="py-2 px-3 text-right">{p.finalBudget != null ? formatCurrency(p.finalBudget) : "—"}</td>
                          <td className="py-2 px-3 text-right">{p.finalCost != null ? formatCurrency(p.finalCost) : "—"}</td>
                          <td className="py-2 px-3 text-right">
                            {variance != null ? (
                              <Badge variant="secondary" className={isOver ? "bg-red-900/40 text-red-400" : "bg-emerald-900/40 text-emerald-400"}>
                                {isOver ? "+" : ""}{formatCurrency(variance)}
                              </Badge>
                            ) : "—"}
                          </td>
                          <td className="py-2 px-3 text-right">{p.irr != null ? `${p.irr.toFixed(1)}%` : "—"}</td>
                          <td className="py-2 px-3 text-right">{p.equityMultiple != null ? `${p.equityMultiple.toFixed(2)}x` : "—"}</td>
                          <td className="py-2 px-3 text-right">{p.profitAmount != null ? formatCurrency(p.profitAmount) : "—"}</td>
                          <td className="py-2 px-3 text-right">{p.holdPeriodMonths != null ? `${p.holdPeriodMonths} mo` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
