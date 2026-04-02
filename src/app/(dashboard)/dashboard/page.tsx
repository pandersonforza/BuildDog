"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { usePortfolioAnalytics } from "@/hooks/use-analytics";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingApprovals } from "@/components/dashboard/pending-approvals";
import { ReturnedInvoices } from "@/components/dashboard/returned-invoices";
import { useAuth } from "@/hooks/use-auth";
import { PROJECT_GROUPS } from "@/lib/constants";

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
  const [groupFilter, setGroupFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const { data, isLoading, error } = usePortfolioAnalytics(groupFilter);
  const { canEdit } = useAuth();

  const handleStatusClick = (status: string) => {
    setStatusFilter((prev) => (prev === status ? null : status));
    setStageFilter(null);
  };

  const handleStageClick = (stage: string) => {
    setStageFilter((prev) => (prev === stage ? null : stage));
    setStatusFilter(null);
  };

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
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold">Dashboard</h1>
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
      </div>

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : (
        <KPICards data={data} />
      )}

      {canEdit && (
        <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(min(100%,28rem),1fr))]">
          <PendingApprovals />
          <ReturnedInvoices />
        </div>
      )}

      <ProjectStatusChart
        group={groupFilter}
        activeStatusFilter={statusFilter}
        activeStageFilter={stageFilter}
        onStatusClick={handleStatusClick}
        onStageClick={handleStageClick}
      />

      <ProjectSummaryTable
        group={groupFilter}
        statusFilter={statusFilter}
        stageFilter={stageFilter}
      />
    </div>
  );
}
