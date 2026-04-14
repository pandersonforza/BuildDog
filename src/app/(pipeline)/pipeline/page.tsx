import { PipelineReport } from "@/components/pipeline/pipeline-report";

export default function PipelinePage() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="px-8 py-5 border-b border-border shrink-0">
        <h1 className="text-2xl font-bold">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Live view from Google Sheets</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <PipelineReport />
      </div>
    </div>
  );
}
