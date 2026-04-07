"use client";

import { useParams } from "next/navigation";
import { DistributionSheet } from "@/components/distribution/distribution-sheet";

export default function DistributionPage() {
  const params = useParams();
  const projectId = params.id as string;

  return <DistributionSheet projectId={projectId} />;
}
