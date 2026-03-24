"use client";

import { useParams } from "next/navigation";
import { useProject } from "@/hooks/use-projects";
import { useProjectAnalytics } from "@/hooks/use-analytics";
import { ProjectDetailHeader } from "@/components/projects/project-detail-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Skeleton } from "@/components/ui/skeleton";
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
                  <span className="text-muted-foreground">Original Budget</span>
                  <CurrencyDisplay amount={analytics.budgetSummary.originalBudget} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revised Budget</span>
                  <CurrencyDisplay amount={analytics.budgetSummary.revisedBudget} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Committed</span>
                  <CurrencyDisplay amount={analytics.budgetSummary.committedCost} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actual Cost</span>
                  <CurrencyDisplay amount={analytics.budgetSummary.actualCost} />
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-medium">
                  <span>Variance</span>
                  <CurrencyDisplay
                    amount={analytics.budgetSummary.variance}
                    showVariance
                    baseAmount={0}
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
    </div>
  );
}
