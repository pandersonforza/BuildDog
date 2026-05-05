"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { BudgetOverview } from "@/components/budget/budget-overview";
import { BudgetTable } from "@/components/budget/budget-table";
import { BudgetImport } from "@/components/budget/budget-import";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, Download, RefreshCw } from "lucide-react";
import { exportBudgetToExcel } from "@/components/budget/budget-export";
import { useAuth } from "@/hooks/use-auth";
import type { BudgetCategoryWithLineItems, BudgetSummary } from "@/types";

export default function BudgetPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [categories, setCategories] = useState<BudgetCategoryWithLineItems[]>([]);
  const [projectName, setProjectName] = useState("");
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const { canEdit, user } = useAuth();
  const isAdmin = user?.role === "admin";

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projectRes, analyticsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/analytics/project/${projectId}`),
      ]);

      if (!projectRes.ok) throw new Error("Failed to fetch project data");

      const projectData = await projectRes.json();
      setProjectName(projectData.name || "Project");
      setCategories(projectData.budgetCategories || []);

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setSummary(analyticsData.budgetSummary || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        Failed to load budget data: {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  const handleRecalculateActuals = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetch("/api/budget/recalculate-actuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error("Failed to recalculate");
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => exportBudgetToExcel(categories, projectName)}
          disabled={categories.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
        {canEdit && (
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import from Excel
          </Button>
        )}
        {isAdmin && (
          <Button
            variant="outline"
            onClick={handleRecalculateActuals}
            disabled={isRecalculating}
            title="Rebuild actual costs from approved/paid invoices"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? "animate-spin" : ""}`} />
            {isRecalculating ? "Recalculating…" : "Recalculate Actuals"}
          </Button>
        )}
      </div>
      {summary && (
        <BudgetOverview summary={summary} categories={categories} />
      )}
      <BudgetTable projectId={projectId} categories={categories} onMutate={fetchData} />
      <BudgetImport
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={projectId}
        onSuccess={fetchData}
      />
    </div>
  );
}
