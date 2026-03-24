"use client";

import dynamic from "next/dynamic";
import { usePortfolioAnalytics } from "@/hooks/use-analytics";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingApprovals } from "@/components/dashboard/pending-approvals";
import { TaskList } from "@/components/dashboard/task-list";

// Lazy load chart-heavy components to reduce initial bundle
const ProjectStatusChart = dynamic(
  () => import("@/components/dashboard/project-status-chart").then((m) => ({ default: m.ProjectStatusChart })),
  { loading: () => <Skeleton className="h-[350px]" /> }
);
const ProjectSummaryTable = dynamic(
  () => import("@/components/dashboard/project-summary-table").then((m) => ({ default: m.ProjectSummaryTable })),
  { loading: () => <Skeleton className="h-[300px]" /> }
);

export default function DashboardPage() {
  const { data, isLoading, error } = usePortfolioAnalytics();

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Failed to load dashboard data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : (
        <KPICards data={data} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <TaskList />
        <PendingApprovals />
      </div>

      <ProjectStatusChart />

      <ProjectSummaryTable />
    </div>
  );
}
