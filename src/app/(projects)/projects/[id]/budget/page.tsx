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
  const [isApplyingRelinks, setIsApplyingRelinks] = useState(false);
  const [recalcResult, setRecalcResult] = useState<{ invoicesMatched: number; unmatchedCount: number } | null>(null);
  const [unmatchedInvoices, setUnmatchedInvoices] = useState<{ id: string; vendorName: string; amount: number; reason: string }[]>([]);
  const [relinks, setRelinks] = useState<Record<string, string>>({}); // invoiceId → lineItemId
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

  const runRecalculate = async (relinkPayload: { invoiceId: string; lineItemId: string }[] = []) => {
    const res = await fetch("/api/budget/recalculate-actuals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, relinks: relinkPayload }),
    });
    if (!res.ok) throw new Error("Failed to recalculate");
    return res.json();
  };

  const handleRecalculateActuals = async () => {
    setIsRecalculating(true);
    setRecalcResult(null);
    setUnmatchedInvoices([]);
    setRelinks({});
    try {
      const data = await runRecalculate();
      setRecalcResult({ invoicesMatched: data.invoicesMatched, unmatchedCount: data.unmatchedCount });
      if (data.unmatched?.length) setUnmatchedInvoices(data.unmatched);
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleApplyRelinks = async () => {
    const payload = Object.entries(relinks).map(([invoiceId, lineItemId]) => ({ invoiceId, lineItemId }));
    if (payload.length === 0) return;
    setIsApplyingRelinks(true);
    try {
      const data = await runRecalculate(payload);
      setRecalcResult({ invoicesMatched: data.invoicesMatched, unmatchedCount: data.unmatchedCount });
      setUnmatchedInvoices(data.unmatched ?? []);
      setRelinks({});
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsApplyingRelinks(false);
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
      {recalcResult && (
        <div className={`rounded-md border px-4 py-3 text-sm ${recalcResult.unmatchedCount > 0 ? "border-yellow-400/50 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-300" : "border-emerald-400/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300"}`}>
          {recalcResult.unmatchedCount === 0
            ? `✓ All ${recalcResult.invoicesMatched} invoice${recalcResult.invoicesMatched !== 1 ? "s" : ""} matched — actuals restored.`
            : `${recalcResult.invoicesMatched} invoice${recalcResult.invoicesMatched !== 1 ? "s" : ""} restored. ${recalcResult.unmatchedCount} below need to be matched manually.`}
        </div>
      )}

      {unmatchedInvoices.length > 0 && (
        <div className="rounded-md border border-yellow-400/50 bg-yellow-50 dark:bg-yellow-950/20 p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                Match unlinked invoices to budget line items
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                These invoices lost their line item link when the budget was re-imported. Select the correct line item for each, then click Apply.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleApplyRelinks}
              disabled={Object.keys(relinks).length === 0 || isApplyingRelinks}
              className="shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isApplyingRelinks ? "animate-spin" : ""}`} />
              {isApplyingRelinks ? "Applying…" : "Apply & Recalculate"}
            </Button>
          </div>
          <div className="space-y-2">
            {unmatchedInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 rounded border border-yellow-300/60 dark:border-yellow-700/40 bg-white dark:bg-background px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{inv.vendorName}</p>
                  <p className="text-xs text-muted-foreground truncate">{inv.reason}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums whitespace-nowrap text-foreground">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(inv.amount)}
                </span>
                <select
                  className="text-sm border border-input rounded-md px-2 py-1.5 bg-background min-w-[220px] max-w-[300px] focus:outline-none focus:ring-1 focus:ring-ring"
                  value={relinks[inv.id] ?? ""}
                  onChange={(e) => setRelinks((prev) => ({ ...prev, [inv.id]: e.target.value }))}
                >
                  <option value="">Select line item…</option>
                  {categories.map((cat) => (
                    <optgroup key={cat.id} label={`${cat.categoryGroup} — ${cat.name}`}>
                      {cat.lineItems.map((li) => (
                        <option key={li.id} value={li.id}>{li.description}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
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
