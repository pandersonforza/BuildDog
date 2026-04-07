"use client";

import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { DistributionSheet } from "@/components/distribution/distribution-sheet";

export default function DistributionPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        You don&apos;t have permission to view this page.
      </div>
    );
  }

  return <DistributionSheet projectId={projectId} />;
}
