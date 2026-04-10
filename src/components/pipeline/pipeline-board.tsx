"use client";

import * as React from "react";
import {
  Loader2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
  ChevronDown,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { PipelineDialog } from "./pipeline-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineProject {
  id: string;
  createdAt: string;
  updatedAt: string;
  projectNumber: string | null;
  address: string;
  city: string;
  state: string | null;
  dealType: string | null;
  siteAcceptance: string | null;
  milestones: string | null;
  dueDiligence: string | null;
  civilPermittingTeam: string | null;
  architectTeam: string | null;
  asBuilts: string | null;
  altaTopo: string | null;
  geotech: string | null;
  phase1Testing: string | null;
  asbestosTesting: string | null;
  signageVendor: string | null;
  signResourcePm: string | null;
  sentTo7B: string | null;
  signageApprovedBy7B: string | null;
  testFitRequested: string | null;
  testFitCompleted: string | null;
  testFitApproved: string | null;
  loiExecuted: string | null;
  titleReceived: string | null;
  titleReviewed: string | null;
  sir: string | null;
  initialBudget: string | null;
  leaseExecuted: string | null;
  rentCommencementDate: string | null;
  powerApplicationSubmitted: string | null;
  designKickoffCall: string | null;
  designDocsApproved: string | null;
  planningSubmittal: string | null;
  planningApproved: string | null;
  rowPermitsApproved: string | null;
  cdKickoffCall: string | null;
  ispIntakeFormSent: string | null;
  cdSubmittedTo7B: string | null;
  approved7B: string | null;
  cdsSubmitted: string | null;
  healthSubmitted: string | null;
  outToBid: string | null;
  prebidMeeting: string | null;
  bidsDue: string | null;
  finalBudgetApproved: string | null;
  generalContractor: string | null;
  gcContractIssued: string | null;
  permitsIssued: string | null;
  constructionStart: string | null;
  turnoverCoo: string | null;
  openDate: string | null;
  planningApprovalProcess: string | null;
  buildingApprovalProcess: string | null;
  developmentNotes: string | null;
}

// ---------------------------------------------------------------------------
// Stage calculation
// ---------------------------------------------------------------------------

type StageName =
  | "Open"
  | "Construction"
  | "Permitted"
  | "Bidding"
  | "Design"
  | "CD Phase"
  | "Lease Signed"
  | "LOI"
  | "Test Fit"
  | "Site Accepted"
  | "Prospect";

function getStage(p: PipelineProject): StageName {
  if (p.openDate) return "Open";
  if (p.constructionStart) return "Construction";
  if (p.permitsIssued) return "Permitted";
  if (p.outToBid) return "Bidding";
  if (p.designDocsApproved) return "Design";
  if (p.cdKickoffCall) return "CD Phase";
  if (p.leaseExecuted) return "Lease Signed";
  if (p.loiExecuted) return "LOI";
  if (p.testFitApproved) return "Test Fit";
  if (p.siteAcceptance) return "Site Accepted";
  return "Prospect";
}

const STAGE_COLORS: Record<StageName, string> = {
  Prospect: "bg-gray-100 text-gray-700 border-gray-200",
  "Site Accepted": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Test Fit": "bg-blue-100 text-blue-800 border-blue-200",
  LOI: "bg-purple-100 text-purple-800 border-purple-200",
  "Lease Signed": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "CD Phase": "bg-cyan-100 text-cyan-800 border-cyan-200",
  Design: "bg-cyan-100 text-cyan-800 border-cyan-200",
  Permitted: "bg-orange-100 text-orange-800 border-orange-200",
  Bidding: "bg-amber-100 text-amber-800 border-amber-200",
  Construction: "bg-red-100 text-red-800 border-red-200",
  Open: "bg-green-100 text-green-800 border-green-200",
};

const STAGE_DOT_COLORS: Record<StageName, string> = {
  Prospect: "bg-gray-400",
  "Site Accepted": "bg-yellow-500",
  "Test Fit": "bg-blue-500",
  LOI: "bg-purple-500",
  "Lease Signed": "bg-indigo-500",
  "CD Phase": "bg-cyan-500",
  Design: "bg-cyan-500",
  Permitted: "bg-orange-500",
  Bidding: "bg-amber-500",
  Construction: "bg-red-500",
  Open: "bg-green-500",
};

const PROGRESS_STAGES: StageName[] = [
  "Prospect",
  "Site Accepted",
  "Test Fit",
  "LOI",
  "Lease Signed",
  "CD Phase",
  "Design",
  "Permitted",
  "Bidding",
  "Construction",
  "Open",
];

// ---------------------------------------------------------------------------
// Checklist sections
// ---------------------------------------------------------------------------

interface ChecklistSection {
  label: string;
  fields: Array<{ key: keyof PipelineProject; label: string }>;
}

const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    label: "Due Diligence",
    fields: [
      { key: "asBuilts", label: "As-Builts" },
      { key: "altaTopo", label: "Alta / Topo" },
      { key: "geotech", label: "Geotech" },
      { key: "phase1Testing", label: "Phase 1 Testing" },
      { key: "asbestosTesting", label: "Asbestos Testing" },
    ],
  },
  {
    label: "Signage",
    fields: [
      { key: "signageVendor", label: "Signage Vendor" },
      { key: "signResourcePm", label: "Sign Resource PM" },
      { key: "sentTo7B", label: "Sent to 7B" },
      { key: "signageApprovedBy7B", label: "Signage Approved by 7B" },
    ],
  },
  {
    label: "Test Fit",
    fields: [
      { key: "testFitRequested", label: "Test Fit Requested" },
      { key: "testFitCompleted", label: "Test Fit Completed" },
      { key: "testFitApproved", label: "Test Fit Approved" },
    ],
  },
  {
    label: "Legal",
    fields: [
      { key: "loiExecuted", label: "LOI Executed" },
      { key: "titleReceived", label: "Title Received" },
      { key: "titleReviewed", label: "Title Reviewed" },
      { key: "sir", label: "SIR" },
      { key: "initialBudget", label: "Initial Budget" },
      { key: "leaseExecuted", label: "Lease Executed" },
      { key: "rentCommencementDate", label: "Rent Commencement Date" },
    ],
  },
  {
    label: "Design",
    fields: [
      { key: "powerApplicationSubmitted", label: "Power Application Submitted" },
      { key: "designKickoffCall", label: "Design Kickoff Call" },
      { key: "designDocsApproved", label: "Design Docs Approved" },
    ],
  },
  {
    label: "Permitting",
    fields: [
      { key: "planningSubmittal", label: "Planning Submittal" },
      { key: "planningApproved", label: "Planning Approved" },
      { key: "rowPermitsApproved", label: "ROW Permits Approved" },
    ],
  },
  {
    label: "Construction Documents",
    fields: [
      { key: "cdKickoffCall", label: "CD Kickoff Call" },
      { key: "ispIntakeFormSent", label: "ISP Intake Form Sent" },
      { key: "cdSubmittedTo7B", label: "CD Submitted to 7B" },
      { key: "approved7B", label: "Approved by 7B" },
      { key: "cdsSubmitted", label: "CDs Submitted" },
    ],
  },
  {
    label: "Bidding",
    fields: [
      { key: "healthSubmitted", label: "Health Submitted" },
      { key: "outToBid", label: "Out to Bid" },
      { key: "prebidMeeting", label: "Pre-Bid Meeting" },
      { key: "bidsDue", label: "Bids Due" },
      { key: "finalBudgetApproved", label: "Final Budget Approved" },
    ],
  },
  {
    label: "Construction",
    fields: [
      { key: "generalContractor", label: "General Contractor" },
      { key: "gcContractIssued", label: "GC Contract Issued" },
      { key: "permitsIssued", label: "Permits Issued" },
      { key: "constructionStart", label: "Construction Start" },
      { key: "turnoverCoo", label: "Turnover / COO" },
      { key: "openDate", label: "Open Date" },
    ],
  },
];

function isChecked(value: string | null): boolean {
  if (!value) return false;
  const v = value.trim().toUpperCase();
  return v === "TRUE" || v === "YES" || v.length > 0;
}

// ---------------------------------------------------------------------------
// Inline edit components
// ---------------------------------------------------------------------------

function InlineInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={placeholder}
      className={`w-full rounded px-1.5 py-0.5 bg-transparent hover:bg-muted/60 focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none transition-colors text-sm placeholder:text-muted-foreground/40 ${className}`}
    />
  );
}

function InlineTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-md px-2.5 py-2 bg-muted/10 border border-border/50 hover:border-border focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none transition-colors text-sm resize-none placeholder:text-muted-foreground/40 leading-relaxed"
    />
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function StageBadge({ stage }: { stage: StageName }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[stage]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT_COLORS[stage]}`} />
      {stage}
    </span>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-muted/40 px-3 py-2 text-sm font-medium hover:bg-muted/70 transition-colors"
      >
        {title}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-3 py-2 space-y-1">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main board
// ---------------------------------------------------------------------------

export function PipelineBoard() {
  const { toast } = useToast();
  const [projects, setProjects] = React.useState<PipelineProject[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  const handleImportFromSheet = async () => {
    setImporting(true);
    try {
      const res = await fetch("/api/pipeline/import", { method: "POST" });
      const data = (await res.json()) as { imported?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      toast({
        title: "Imported!",
        description: `${data.imported} projects imported from Google Sheet`,
      });
      fetchProjects();
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const fetchProjects = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/pipeline");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProjects(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load pipeline projects",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedId, toast]);

  React.useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard navigation
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (dialogOpen) return;
      const filtered = filteredProjects;
      const idx = filtered.findIndex((p) => p.id === selectedId);
      if ((e.key === "ArrowUp" || e.key === "ArrowLeft") && idx > 0) {
        setSelectedId(filtered[idx - 1].id);
      } else if (
        (e.key === "ArrowDown" || e.key === "ArrowRight") &&
        idx < filtered.length - 1
      ) {
        setSelectedId(filtered[idx + 1].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const filteredProjects = React.useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.address.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        (p.state ?? "").toLowerCase().includes(q)
    );
  }, [projects, search]);

  const selectedProject = projects.find((p) => p.id === selectedId) ?? null;
  const selectedIdx = filteredProjects.findIndex((p) => p.id === selectedId);

  // Delete
  const handleDelete = React.useCallback(
    async (id: string) => {
      if (!confirm("Delete this pipeline project?")) return;
      try {
        const res = await fetch(`/api/pipeline/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        toast({ title: "Deleted", description: "Project removed from pipeline" });
        setSelectedId(null);
        fetchProjects();
      } catch {
        toast({
          title: "Error",
          description: "Failed to delete project",
          variant: "destructive",
        });
      }
    },
    [fetchProjects, toast]
  );

  // Create new project (dialog only)
  const handleCreate = React.useCallback(
    async (data: Partial<PipelineProject>) => {
      try {
        const res = await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to create");
        const saved = await res.json();
        toast({ title: "Created", description: `${saved.address} added to pipeline` });
        setDialogOpen(false);
        await fetchProjects();
        setSelectedId(saved.id);
      } catch {
        toast({ title: "Error", description: "Failed to create project", variant: "destructive" });
      }
    },
    [fetchProjects, toast]
  );

  // Called by ProjectDetail when it auto-saves a field
  const handleProjectUpdated = React.useCallback((updated: PipelineProject) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* LEFT PANEL */}
      <div className="flex w-72 shrink-0 flex-col border-r border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Project Pipeline</h2>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {filteredProjects.length}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDialogOpen(true)}
            className="h-7 w-7 p-0"
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add project</span>
          </Button>
        </div>

        {/* Search */}
        <div className="border-b border-border px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search address or city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-sm"
            />
          </div>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto">
          {filteredProjects.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground space-y-3">
              <p>{search ? "No matches found" : "No projects yet"}</p>
              {!search && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleImportFromSheet}
                  disabled={importing}
                >
                  {importing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                  Import from Google Sheet
                </Button>
              )}
            </div>
          ) : (
            filteredProjects.map((project) => {
              const stage = getStage(project);
              const snippet = project.developmentNotes
                ? project.developmentNotes.slice(0, 60) +
                  (project.developmentNotes.length > 60 ? "…" : "")
                : null;
              const isSelected = project.id === selectedId;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedId(project.id)}
                  className={`w-full border-b border-border px-4 py-3 text-left transition-colors ${
                    isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-tight">{project.address}</span>
                    <StageBadge stage={stage} />
                  </div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    {project.city}
                    {project.state ? `, ${project.state}` : ""}
                  </p>
                  {snippet && (
                    <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">
                      {snippet}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedProject ? (
          <ProjectDetail
            key={selectedProject.id}
            project={selectedProject}
            idx={selectedIdx}
            total={filteredProjects.length}
            onPrev={() =>
              selectedIdx > 0 && setSelectedId(filteredProjects[selectedIdx - 1].id)
            }
            onNext={() =>
              selectedIdx < filteredProjects.length - 1 &&
              setSelectedId(filteredProjects[selectedIdx + 1].id)
            }
            onDelete={() => handleDelete(selectedProject.id)}
            onUpdated={handleProjectUpdated}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <p className="text-sm">Select a project from the list</p>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add First Project
            </Button>
          </div>
        )}
      </div>

      {/* Dialog — create only */}
      <PipelineDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={null}
        onSave={handleCreate}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project detail — fully inline editable
// ---------------------------------------------------------------------------

type SaveStatus = "idle" | "saving" | "saved" | "error";

function ProjectDetail({
  project,
  idx,
  total,
  onPrev,
  onNext,
  onDelete,
  onUpdated,
}: {
  project: PipelineProject;
  idx: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onDelete: () => void;
  onUpdated: (project: PipelineProject) => void;
}) {
  const { toast } = useToast();
  const [form, setFormState] = React.useState<PipelineProject>(project);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const doSave = React.useCallback(
    async (data: PipelineProject) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/pipeline/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to save");
        const saved = await res.json();
        onUpdated(saved);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
      } catch {
        setSaveStatus("error");
        toast({ title: "Save failed", description: "Changes could not be saved", variant: "destructive" });
      }
    },
    [onUpdated, toast]
  );

  const setField = React.useCallback(
    (key: keyof PipelineProject, value: string | null) => {
      setFormState((prev) => {
        const updated = { ...prev, [key]: value };
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => doSave(updated), 800);
        return updated;
      });
    },
    [doSave]
  );

  const toggleCheck = React.useCallback(
    (key: keyof PipelineProject) => {
      setFormState((prev) => {
        const current = prev[key] as string | null;
        const wasChecked = isChecked(current);
        const updated = { ...prev, [key]: wasChecked ? null : "TRUE" };
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        doSave(updated);
        return updated;
      });
    },
    [doSave]
  );

  const stage = getStage(form);
  const stageIdx = PROGRESS_STAGES.indexOf(stage);

  return (
    <div className="flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2 gap-4">
        <div className="flex-1 min-w-0 space-y-0.5">
          {/* Address — styled as heading input */}
          <input
            type="text"
            value={form.address}
            onChange={(e) => setField("address", e.target.value)}
            placeholder="Address"
            className="w-full text-base font-bold bg-transparent rounded px-1 py-0.5 hover:bg-muted/60 focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none transition-colors placeholder:text-muted-foreground/40"
          />
          {/* City / State / Project # row */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="text"
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
              placeholder="City"
              className="w-28 bg-transparent rounded px-1 py-0.5 hover:bg-muted/60 focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none transition-colors text-xs placeholder:text-muted-foreground/40"
            />
            <span>,</span>
            <input
              type="text"
              value={form.state ?? ""}
              onChange={(e) => setField("state", e.target.value || null)}
              placeholder="ST"
              className="w-10 bg-transparent rounded px-1 py-0.5 hover:bg-muted/60 focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none transition-colors text-xs placeholder:text-muted-foreground/40"
            />
            {(form.projectNumber !== null || true) && (
              <>
                <span className="text-border">·</span>
                <span>#</span>
                <input
                  type="text"
                  value={form.projectNumber ?? ""}
                  onChange={(e) => setField("projectNumber", e.target.value || null)}
                  placeholder="—"
                  className="w-16 bg-transparent rounded px-1 py-0.5 hover:bg-muted/60 focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none transition-colors text-xs placeholder:text-muted-foreground/40"
                />
              </>
            )}
            <span className="text-border">·</span>
            <input
              type="text"
              value={form.dealType ?? ""}
              onChange={(e) => setField("dealType", e.target.value || null)}
              placeholder="Deal type"
              className="w-24 bg-transparent rounded px-1 py-0.5 hover:bg-muted/60 focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none transition-colors text-xs placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* Save status + actions */}
        <div className="flex shrink-0 items-center gap-2">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" /> Error
            </span>
          )}
          <StageBadge stage={stage} />
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
          <div className="flex items-center gap-1 border-l border-border pl-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrev}
              disabled={idx <= 0}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">
              {idx + 1} / {total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNext}
              disabled={idx >= total - 1}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stage progress strip */}
      <div className="shrink-0 border-b border-border bg-muted/20 px-6 py-3 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {PROGRESS_STAGES.map((s, i) => {
            const isPast = i < stageIdx;
            const isCurrent = i === stageIdx;
            const isLast = i === PROGRESS_STAGES.length - 1;
            return (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`h-2 w-2 rounded-full border ${
                      isCurrent
                        ? `${STAGE_DOT_COLORS[s]} border-transparent scale-125`
                        : isPast
                        ? "bg-green-400 border-transparent"
                        : "bg-muted border-border"
                    }`}
                  />
                  <span
                    className={`text-[10px] whitespace-nowrap font-medium ${
                      isCurrent
                        ? "text-foreground"
                        : isPast
                        ? "text-green-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {s}
                  </span>
                </div>
                {!isLast && (
                  <div
                    className={`h-px w-6 shrink-0 -mt-3 ${
                      i < stageIdx ? "bg-green-400" : "bg-border"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {/* Development Notes */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Development Notes
          </p>
          <p className="mb-1 text-[10px] text-muted-foreground/70">
            Format: <code className="bg-muted px-0.5 rounded">INITIALS-M-D- Note text</code>
          </p>
          <InlineTextarea
            value={form.developmentNotes}
            onChange={(v) => setField("developmentNotes", v)}
            placeholder="e.g. JD-4-10- Submitted plans to city…"
            rows={5}
          />
        </div>

        {/* Two-column info grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left: process notes */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Planning Approval Process
              </p>
              <InlineTextarea
                value={form.planningApprovalProcess}
                onChange={(v) => setField("planningApprovalProcess", v)}
                placeholder="Describe planning process…"
                rows={3}
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Building Approval Process
              </p>
              <InlineTextarea
                value={form.buildingApprovalProcess}
                onChange={(v) => setField("buildingApprovalProcess", v)}
                placeholder="Describe building process…"
                rows={3}
              />
            </div>
          </div>

          {/* Right: key dates */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Key Dates
            </p>
            <div className="space-y-1">
              <KeyDateField
                label="Site Acceptance"
                value={form.siteAcceptance}
                onChange={(v) => setField("siteAcceptance", v)}
              />
              <KeyDateField
                label="LOI Executed"
                value={form.loiExecuted}
                onChange={(v) => setField("loiExecuted", v)}
              />
              <KeyDateField
                label="Lease Executed"
                value={form.leaseExecuted}
                onChange={(v) => setField("leaseExecuted", v)}
              />
              <KeyDateField
                label="Construction Start"
                value={form.constructionStart}
                onChange={(v) => setField("constructionStart", v)}
              />
              <KeyDateField
                label="Open Date"
                value={form.openDate}
                onChange={(v) => setField("openDate", v)}
              />
              <KeyDateField
                label="Rent Commencement"
                value={form.rentCommencementDate}
                onChange={(v) => setField("rentCommencementDate", v)}
              />
            </div>
          </div>
        </div>

        {/* Teams */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Teams
          </p>
          <div className="grid grid-cols-3 gap-2">
            <TeamField
              label="Civil / Permitting"
              value={form.civilPermittingTeam}
              onChange={(v) => setField("civilPermittingTeam", v)}
            />
            <TeamField
              label="Architect"
              value={form.architectTeam}
              onChange={(v) => setField("architectTeam", v)}
            />
            <TeamField
              label="General Contractor"
              value={form.generalContractor}
              onChange={(v) => setField("generalContractor", v)}
            />
          </div>
        </div>

        {/* Stage checklists */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Stage Checklist
          </p>
          <div className="space-y-2">
            {CHECKLIST_SECTIONS.map((section) => (
              <CollapsibleSection key={section.label} title={section.label}>
                {section.fields.map((field) => {
                  const val = form[field.key] as string | null;
                  const checked = isChecked(val);
                  const hasTextValue =
                    val &&
                    val.toUpperCase() !== "TRUE" &&
                    val.toUpperCase() !== "FALSE";
                  return (
                    <div key={field.key} className="flex items-center gap-2 py-0.5">
                      {/* Toggle checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleCheck(field.key)}
                        className="shrink-0 text-base leading-none hover:scale-110 transition-transform"
                        title={checked ? "Mark incomplete" : "Mark complete"}
                      >
                        {checked ? "✅" : "⬜"}
                      </button>
                      <span
                        className={`text-sm shrink-0 ${
                          checked ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {field.label}
                      </span>
                      {/* Inline value input */}
                      <input
                        type="text"
                        value={hasTextValue ? val! : ""}
                        onChange={(e) => setField(field.key, e.target.value || (checked ? "TRUE" : null))}
                        placeholder="date or note"
                        className="flex-1 min-w-0 text-xs bg-transparent rounded px-1 py-0.5 hover:bg-muted/60 focus:bg-background focus:ring-1 focus:ring-ring focus:outline-none transition-colors placeholder:text-muted-foreground/30 text-right"
                      />
                    </div>
                  );
                })}
              </CollapsibleSection>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline field subcomponents
// ---------------------------------------------------------------------------

function KeyDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
      <InlineInput
        value={value}
        onChange={onChange}
        placeholder="—"
        className="text-right text-xs max-w-[130px]"
      />
    </div>
  );
}

function TeamField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/10 hover:bg-muted/20 transition-colors p-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
        {label}
      </p>
      <InlineInput
        value={value}
        onChange={onChange}
        placeholder="—"
        className="font-medium text-sm px-0"
      />
    </div>
  );
}
