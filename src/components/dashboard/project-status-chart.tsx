"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface ChartData {
  name: string;
  value: number;
}

const STATUS_CHART_COLORS: Record<string, string> = {
  Active: "#10b981",
  "On Hold": "#f59e0b",
  Completed: "#3b82f6",
  Dead: "#ef4444",
};

const STAGE_CHART_COLORS: Record<string, string> = {
  "Pre-Development": "#64748b",
  Design: "#a78bfa",
  Permitting: "#fbbf24",
  Construction: "#34d399",
  Closeout: "#60a5fa",
};

function MiniPieChart({
  title,
  data,
  colorMap,
  labelKey,
}: {
  title: string;
  data: ChartData[];
  colorMap: Record<string, string>;
  labelKey: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="w-[200px] h-[200px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={colorMap[entry.name] || "#94a3b8"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.375rem",
                    color: "var(--color-foreground)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 font-medium text-muted-foreground">{labelKey}</th>
                  <th className="text-right py-1.5 font-medium text-muted-foreground">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.map((entry) => (
                  <tr key={entry.name} className="border-b border-border last:border-0">
                    <td className="py-1.5 flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: colorMap[entry.name] || "#94a3b8" }}
                      />
                      {entry.name}
                    </td>
                    <td className="text-right py-1.5 font-medium">{entry.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectStatusChart({ group }: { group?: string }) {
  const [statusData, setStatusData] = useState<ChartData[]>([]);
  const [stageData, setStageData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) return;
        let projects: { status: string; stage: string; projectGroup: string }[] = await res.json();
        if (group && group !== "All") {
          projects = projects.filter((p) => p.projectGroup === group);
        }

        const statusCounts: Record<string, number> = {};
        const stageCounts: Record<string, number> = {};

        for (const p of projects) {
          statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
          if (p.status === "Active") {
            stageCounts[p.stage] = (stageCounts[p.stage] || 0) + 1;
          }
        }

        setStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));
        setStageData(Object.entries(stageCounts).map(([name, value]) => ({ name, value })));
      } catch {
        // silently handle
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [group]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle>{i === 0 ? "Projects by Status" : "Active Projects by Stage"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <MiniPieChart
        title="Projects by Status"
        data={statusData}
        colorMap={STATUS_CHART_COLORS}
        labelKey="Status"
      />
      {stageData.length > 0 && (
        <MiniPieChart
          title="Active Projects by Stage"
          data={stageData}
          colorMap={STAGE_CHART_COLORS}
          labelKey="Stage"
        />
      )}
    </div>
  );
}
