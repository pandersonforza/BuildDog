"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load MilestonesPanel (contains recharts) to reduce initial bundle
const MilestonesPanel = dynamic(
  () => import("@/components/milestones/milestones-panel").then((m) => ({ default: m.MilestonesPanel })),
  { loading: () => <Skeleton className="h-[400px] w-full" /> }
);

export default function MilestonesPage() {
  const params = useParams();
  const projectId = params.id as string;

  return <MilestonesPanel projectId={projectId} />;
}
