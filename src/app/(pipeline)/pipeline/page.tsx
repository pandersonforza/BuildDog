import { PipelineReport } from "@/components/pipeline/pipeline-report";

export default function PipelinePage() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <PipelineReport />
    </div>
  );
}
