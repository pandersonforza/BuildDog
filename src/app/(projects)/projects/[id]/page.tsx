"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useProject } from "@/hooks/use-projects";
import { useProjectAnalytics } from "@/hooks/use-analytics";
import { ProjectDetailHeader } from "@/components/projects/project-detail-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { project, isLoading, error, mutate } = useProject(projectId);
  const { data: analytics } = useProjectAnalytics(projectId);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        Failed to load project: {error}
      </div>
    );
  }

  if (isLoading || !project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProjectDetailHeader
        project={project}
        budgetSummary={analytics?.budgetSummary}
        onMutate={mutate}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Budget Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Budget Summary
              <Link
                href={`/projects/${projectId}/budget`}
                className="text-sm font-normal text-primary hover:underline"
              >
                View Details
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.budgetSummary ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Budget</span>
                  <CurrencyDisplay amount={analytics.budgetSummary.revisedBudget} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actual Cost</span>
                  <CurrencyDisplay amount={analytics.budgetSummary.actualCost} />
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-medium">
                  <span>Remaining</span>
                  <CurrencyDisplay
                    amount={analytics.budgetSummary.revisedBudget - analytics.budgetSummary.actualCost}
                  />
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No budget data available.</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Draws */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent Draws
              <Link
                href={`/projects/${projectId}/draws`}
                className="text-sm font-normal text-primary hover:underline"
              >
                View All
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.recentDraws && analytics.recentDraws.length > 0 ? (
              <div className="space-y-3">
                {analytics.recentDraws.slice(0, 5).map((draw) => (
                  <div key={draw.id} className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">Draw #{draw.drawNumber}</span>
                      <StatusBadge status={draw.status} className="ml-2" />
                    </div>
                    <CurrencyDisplay amount={draw.totalAmount} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No draws yet.</p>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Track Record - only for Completed projects */}
      {project.status === "Completed" && (
        <TrackRecordCard project={project} onMutate={mutate} />
      )}
    </div>
  );
}

function TrackRecordCard({ project, onMutate }: { project: Record<string, unknown> & { id: string }; onMutate: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    finalBudget: (project.finalBudget as number) ?? "",
    finalCost: (project.finalCost as number) ?? "",
    irr: (project.irr as number) ?? "",
    equityMultiple: (project.equityMultiple as number) ?? "",
    profitAmount: (project.profitAmount as number) ?? "",
    holdPeriodMonths: (project.holdPeriodMonths as number) ?? "",
    completionNotes: (project.completionNotes as string) ?? "",
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (form.finalBudget !== "") body.finalBudget = Number(form.finalBudget);
      if (form.finalCost !== "") body.finalCost = Number(form.finalCost);
      if (form.irr !== "") body.irr = Number(form.irr);
      if (form.equityMultiple !== "") body.equityMultiple = Number(form.equityMultiple);
      if (form.profitAmount !== "") body.profitAmount = Number(form.profitAmount);
      if (form.holdPeriodMonths !== "") body.holdPeriodMonths = Number(form.holdPeriodMonths);
      body.completionNotes = form.completionNotes;
      body.completionDate = new Date().toISOString();

      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Track record updated" });
      setEditing(false);
      onMutate();
    } catch {
      toast({ title: "Error", description: "Failed to save track record", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const hasData = project.finalBudget != null || project.irr != null;
  const isAdmin = user?.role === "admin";

  if (!editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Track Record
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4 mr-1" />
                {hasData ? "Edit" : "Enter Stats"}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Final Budget</p>
                <p className="font-semibold">{project.finalBudget != null ? formatCurrency(project.finalBudget as number) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Final Cost</p>
                <p className="font-semibold">{project.finalCost != null ? formatCurrency(project.finalCost as number) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Variance</p>
                <p className="font-semibold">
                  {project.finalBudget != null && project.finalCost != null
                    ? formatCurrency((project.finalCost as number) - (project.finalBudget as number))
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">IRR</p>
                <p className="font-semibold">{project.irr != null ? `${(project.irr as number).toFixed(1)}%` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Equity Multiple</p>
                <p className="font-semibold">{project.equityMultiple != null ? `${(project.equityMultiple as number).toFixed(2)}x` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Profit</p>
                <p className="font-semibold">{project.profitAmount != null ? formatCurrency(project.profitAmount as number) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hold Period</p>
                <p className="font-semibold">{project.holdPeriodMonths != null ? `${project.holdPeriodMonths} months` : "—"}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No track record stats entered yet.{isAdmin ? " Click \"Enter Stats\" to add completion data." : ""}
            </p>
          )}
          {project.completionNotes && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{project.completionNotes as string}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Track Record</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label htmlFor="tr-finalBudget">Final Budget ($)</Label>
            <Input id="tr-finalBudget" type="number" step="0.01" value={form.finalBudget} onChange={(e) => setForm((f) => ({ ...f, finalBudget: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tr-finalCost">Final Cost ($)</Label>
            <Input id="tr-finalCost" type="number" step="0.01" value={form.finalCost} onChange={(e) => setForm((f) => ({ ...f, finalCost: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tr-irr">IRR (%)</Label>
            <Input id="tr-irr" type="number" step="0.1" value={form.irr} onChange={(e) => setForm((f) => ({ ...f, irr: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tr-equity">Equity Multiple (x)</Label>
            <Input id="tr-equity" type="number" step="0.01" value={form.equityMultiple} onChange={(e) => setForm((f) => ({ ...f, equityMultiple: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tr-profit">Profit ($)</Label>
            <Input id="tr-profit" type="number" step="0.01" value={form.profitAmount} onChange={(e) => setForm((f) => ({ ...f, profitAmount: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tr-hold">Hold Period (months)</Label>
            <Input id="tr-hold" type="number" value={form.holdPeriodMonths} onChange={(e) => setForm((f) => ({ ...f, holdPeriodMonths: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1 mt-4">
          <Label htmlFor="tr-notes">Completion Notes</Label>
          <Textarea id="tr-notes" value={form.completionNotes} onChange={(e) => setForm((f) => ({ ...f, completionNotes: e.target.value }))} rows={3} />
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Track Record"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
