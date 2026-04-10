"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { PipelineProject } from "./pipeline-board";

interface PipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: PipelineProject | null;
  onSave: (data: Partial<PipelineProject>) => Promise<void>;
}

type FormState = Partial<PipelineProject>;

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Input
        id={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder ?? label}
        className="h-8 text-sm"
      />
    </div>
  );
}

function TextareaField({
  label,
  name,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Textarea
        id={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        rows={rows}
        className="text-sm"
      />
    </div>
  );
}

export function PipelineDialog({
  open,
  onOpenChange,
  project,
  onSave,
}: PipelineDialogProps) {
  const [form, setForm] = React.useState<FormState>({});
  const [isSaving, setIsSaving] = React.useState(false);

  // Populate form when project changes
  React.useEffect(() => {
    if (project) {
      setForm({ ...project });
    } else {
      setForm({});
    }
  }, [project, open]);

  const set = React.useCallback((name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value || null }));
  }, []);

  const v = (key: keyof PipelineProject): string =>
    (form[key] as string | null | undefined) ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(form);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Pipeline Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="info">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1 text-xs">
                Info
              </TabsTrigger>
              <TabsTrigger value="testfit-legal" className="flex-1 text-xs">
                Test Fit &amp; Legal
              </TabsTrigger>
              <TabsTrigger value="design-permitting" className="flex-1 text-xs">
                Design &amp; Permitting
              </TabsTrigger>
              <TabsTrigger value="construction" className="flex-1 text-xs">
                Construction
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex-1 text-xs">
                Notes
              </TabsTrigger>
            </TabsList>

            {/* INFO TAB */}
            <TabsContent value="info" className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Address *" name="address" value={v("address")} onChange={set} />
                <Field label="City *" name="city" value={v("city")} onChange={set} />
                <Field label="State" name="state" value={v("state")} onChange={set} placeholder="e.g. CA" />
                <Field label="Project Number" name="projectNumber" value={v("projectNumber")} onChange={set} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Deal Type" name="dealType" value={v("dealType")} onChange={set} placeholder="Conversion or GU" />
                <Field label="Site Acceptance" name="siteAcceptance" value={v("siteAcceptance")} onChange={set} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Civil / Permitting Team" name="civilPermittingTeam" value={v("civilPermittingTeam")} onChange={set} />
                <Field label="Architect Team" name="architectTeam" value={v("architectTeam")} onChange={set} />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">
                Due Diligence
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="As-Builts" name="asBuilts" value={v("asBuilts")} onChange={set} placeholder="TRUE / date" />
                <Field label="Alta / Topo" name="altaTopo" value={v("altaTopo")} onChange={set} placeholder="TRUE / date" />
                <Field label="Geotech" name="geotech" value={v("geotech")} onChange={set} placeholder="TRUE / date" />
                <Field label="Phase 1 Testing" name="phase1Testing" value={v("phase1Testing")} onChange={set} placeholder="TRUE / date" />
                <Field label="Asbestos Testing" name="asbestosTesting" value={v("asbestosTesting")} onChange={set} placeholder="TRUE / date" />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">
                Signage
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Signage Vendor" name="signageVendor" value={v("signageVendor")} onChange={set} />
                <Field label="Sign Resource PM" name="signResourcePm" value={v("signResourcePm")} onChange={set} />
                <Field label="Sent to 7B" name="sentTo7B" value={v("sentTo7B")} onChange={set} placeholder="TRUE / date" />
                <Field label="Signage Approved by 7B" name="signageApprovedBy7B" value={v("signageApprovedBy7B")} onChange={set} placeholder="TRUE / date" />
              </div>
            </TabsContent>

            {/* TEST FIT & LEGAL TAB */}
            <TabsContent value="testfit-legal" className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Test Fit
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Test Fit Requested" name="testFitRequested" value={v("testFitRequested")} onChange={set} placeholder="TRUE / date" />
                <Field label="Test Fit Completed" name="testFitCompleted" value={v("testFitCompleted")} onChange={set} placeholder="TRUE / date" />
                <Field label="Test Fit Approved" name="testFitApproved" value={v("testFitApproved")} onChange={set} placeholder="TRUE / date / note" />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">
                Legal
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="LOI Executed" name="loiExecuted" value={v("loiExecuted")} onChange={set} placeholder="TRUE / date" />
                <Field label="Title Received" name="titleReceived" value={v("titleReceived")} onChange={set} placeholder="TRUE / date" />
                <Field label="Title Reviewed" name="titleReviewed" value={v("titleReviewed")} onChange={set} placeholder="TRUE / date" />
                <Field label="SIR" name="sir" value={v("sir")} onChange={set} placeholder="TRUE / date" />
                <Field label="Initial Budget" name="initialBudget" value={v("initialBudget")} onChange={set} />
                <Field label="Lease Executed" name="leaseExecuted" value={v("leaseExecuted")} onChange={set} placeholder="TRUE / date" />
                <Field label="Rent Commencement Date" name="rentCommencementDate" value={v("rentCommencementDate")} onChange={set} />
              </div>
            </TabsContent>

            {/* DESIGN & PERMITTING TAB */}
            <TabsContent value="design-permitting" className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Design
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Power Application Submitted" name="powerApplicationSubmitted" value={v("powerApplicationSubmitted")} onChange={set} placeholder="TRUE / date" />
                <Field label="Design Kickoff Call" name="designKickoffCall" value={v("designKickoffCall")} onChange={set} placeholder="TRUE / date" />
                <Field label="Design Docs Approved" name="designDocsApproved" value={v("designDocsApproved")} onChange={set} placeholder="TRUE / date" />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">
                Permitting
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Planning Submittal" name="planningSubmittal" value={v("planningSubmittal")} onChange={set} placeholder="TRUE / date" />
                <Field label="Planning Approved" name="planningApproved" value={v("planningApproved")} onChange={set} placeholder="TRUE / date" />
                <Field label="ROW Permits Approved" name="rowPermitsApproved" value={v("rowPermitsApproved")} onChange={set} placeholder="TRUE / date" />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">
                Construction Documents
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="CD Kickoff Call" name="cdKickoffCall" value={v("cdKickoffCall")} onChange={set} placeholder="TRUE / date" />
                <Field label="ISP Intake Form Sent" name="ispIntakeFormSent" value={v("ispIntakeFormSent")} onChange={set} placeholder="TRUE / date" />
                <Field label="CD Submitted to 7B" name="cdSubmittedTo7B" value={v("cdSubmittedTo7B")} onChange={set} placeholder="TRUE / date" />
                <Field label="Approved by 7B" name="approved7B" value={v("approved7B")} onChange={set} placeholder="TRUE / date" />
                <Field label="CDs Submitted" name="cdsSubmitted" value={v("cdsSubmitted")} onChange={set} placeholder="TRUE / date" />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">
                Bidding
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Health Submitted" name="healthSubmitted" value={v("healthSubmitted")} onChange={set} placeholder="TRUE / date" />
                <Field label="Out to Bid" name="outToBid" value={v("outToBid")} onChange={set} placeholder="TRUE / date" />
                <Field label="Pre-Bid Meeting" name="prebidMeeting" value={v("prebidMeeting")} onChange={set} placeholder="TRUE / date" />
                <Field label="Bids Due" name="bidsDue" value={v("bidsDue")} onChange={set} />
                <Field label="Final Budget Approved" name="finalBudgetApproved" value={v("finalBudgetApproved")} onChange={set} placeholder="TRUE / date" />
              </div>
            </TabsContent>

            {/* CONSTRUCTION TAB */}
            <TabsContent value="construction" className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="General Contractor" name="generalContractor" value={v("generalContractor")} onChange={set} />
                <Field label="GC Contract Issued" name="gcContractIssued" value={v("gcContractIssued")} onChange={set} placeholder="TRUE / date" />
                <Field label="Permits Issued" name="permitsIssued" value={v("permitsIssued")} onChange={set} placeholder="TRUE / date" />
                <Field label="Construction Start" name="constructionStart" value={v("constructionStart")} onChange={set} />
                <Field label="Turnover / COO" name="turnoverCoo" value={v("turnoverCoo")} onChange={set} />
                <Field label="Open Date" name="openDate" value={v("openDate")} onChange={set} />
              </div>
            </TabsContent>

            {/* NOTES TAB */}
            <TabsContent value="notes" className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Format timestamped entries as: <code className="bg-muted px-1 rounded">INITIALS-M-D- Note text</code> (e.g. <code className="bg-muted px-1 rounded">JD-3-15- Submitted plans</code>)
              </p>
              <TextareaField
                label="Development Notes"
                name="developmentNotes"
                value={v("developmentNotes")}
                onChange={set}
                rows={8}
              />
              <TextareaField
                label="Planning Approval Process"
                name="planningApprovalProcess"
                value={v("planningApprovalProcess")}
                onChange={set}
                rows={4}
              />
              <TextareaField
                label="Building Approval Process"
                name="buildingApprovalProcess"
                value={v("buildingApprovalProcess")}
                onChange={set}
                rows={4}
              />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !form.address || !form.city}>
              {isSaving ? "Saving…" : project ? "Save Changes" : "Add Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
