"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { SearchableSelect, SelectNative } from "@/components/ui/select";
import { ExternalLink, AlertTriangle } from "lucide-react";

export interface InvoiceForApproval {
  id: string;
  vendorName: string;
  invoiceNumber: string | null;
  amount: number;
  description: string | null;
  filePath: string | null;
  aiNotes: string | null;
  project: { id: string; name: string; address: string } | null;
  lineItem: {
    id: string;
    description: string;
    category: { id?: string; name: string } | null;
  } | null;
}

interface InvoiceApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceForApproval | null;
  onSuccess: () => void;
}

export function InvoiceApprovalDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: InvoiceApprovalDialogProps) {
  const [form, setForm] = useState({ vendorName: "", invoiceNumber: "", amount: "", description: "" });
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedLineItemId, setSelectedLineItemId] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string; address: string }[]>([]);
  const [lineItems, setLineItems] = useState<{ id: string; description: string; category: { name: string } }[]>([]);
  const [loadingLineItems, setLoadingLineItems] = useState(false);
  const [showReturnInput, setShowReturnInput] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<{ id: string; invoiceNumber: string | null; amount: number; status: string; project: { name: string } | null }[]>([]);
  const { toast } = useToast();

  // Populate form when invoice changes
  useEffect(() => {
    if (!invoice || !open) return;
    setForm({
      vendorName: invoice.vendorName,
      invoiceNumber: invoice.invoiceNumber || "",
      amount: String(invoice.amount),
      description: invoice.description || "",
    });
    setSelectedProjectId(invoice.project?.id || "");
    setSelectedLineItemId(invoice.lineItem?.id || "");
    setShowReturnInput(false);
    setReturnReason("");
    setDuplicates([]);
    // Fetch projects and check for duplicates in parallel
    fetch("/api/projects")
      .then((r) => r.ok ? r.json() : [])
      .then(setProjects)
      .catch(() => setProjects([]));
    fetch(`/api/invoices?vendorName=${encodeURIComponent(invoice.vendorName)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((all: { id: string; invoiceNumber: string | null; amount: number; status: string; project: { name: string } | null }[]) => {
        const dupes = all.filter((inv) => {
          if (inv.id === invoice.id) return false;
          if (inv.status === "Rejected") return false;
          const sameInvoiceNumber = invoice.invoiceNumber && inv.invoiceNumber &&
            inv.invoiceNumber.trim().toLowerCase() === invoice.invoiceNumber.trim().toLowerCase();
          const sameAmount = Math.abs(inv.amount - invoice.amount) < 0.01;
          return sameInvoiceNumber || sameAmount;
        });
        setDuplicates(dupes);
      })
      .catch(() => setDuplicates([]));
  }, [invoice, open]);

  // Fetch line items when project changes
  useEffect(() => {
    if (!selectedProjectId || !open) { setLineItems([]); return; }
    setLoadingLineItems(true);
    fetch(`/api/projects/${selectedProjectId}`)
      .then((r) => r.json())
      .then((p) => {
        const items: { id: string; description: string; category: { name: string } }[] = [];
        for (const cat of p.budgetCategories || []) {
          for (const li of cat.lineItems || []) {
            items.push({ id: li.id, description: li.description, category: { name: cat.name } });
          }
        }
        setLineItems(items);
      })
      .catch(() => setLineItems([]))
      .finally(() => setLoadingLineItems(false));
  }, [selectedProjectId, open]);

  const handleClose = () => {
    onOpenChange(false);
    setShowReturnInput(false);
    setReturnReason("");
    setLineItems([]);
    setDuplicates([]);
  };

  const handleApprove = async () => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Approved",
          vendorName: form.vendorName,
          invoiceNumber: form.invoiceNumber || null,
          amount: parseFloat(form.amount),
          description: form.description || null,
          projectId: selectedProjectId || null,
          budgetLineItemId: selectedLineItemId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to approve");
      }
      toast({ title: "Invoice Approved", description: `Invoice from ${form.vendorName} has been approved.` });
      handleClose();
      onSuccess();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to approve invoice", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Pending Review",
          rejectionReason: returnReason.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to return");
      }
      toast({ title: "Invoice Returned", description: `Invoice sent back to submitter for revision.` });
      handleClose();
      onSuccess();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to return invoice", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  if (!invoice) return null;

  const payItems = (() => {
    const match = invoice.aiNotes?.match(/__payAppLineItems__([\s\S]+)$/);
    if (!match) return [];
    try { return JSON.parse(match[1]) as { lineItemId: string; description: string; amount: number }[]; }
    catch { return []; }
  })();
  const isPayApp = payItems.length > 0;

  const pdfUrl = invoice.filePath
    ? invoice.filePath.startsWith("http")
      ? `/api/invoices/file?url=${encodeURIComponent(invoice.filePath)}`
      : invoice.filePath
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Review {isPayApp ? "Pay Application" : "Invoice"}</DialogTitle>
          <DialogDescription>
            Review the details below and approve or return to the submitter.
          </DialogDescription>
        </DialogHeader>

        <div className={`grid gap-6 ${pdfUrl ? "grid-cols-2" : ""} overflow-hidden`}>
          {/* PDF preview — left */}
          {pdfUrl && (
            <div className="border border-border rounded-lg overflow-hidden h-[60vh]">
              <iframe src={pdfUrl} className="w-full h-full" title="Invoice PDF Preview" />
            </div>
          )}

          {/* Details — right */}
          <div className="overflow-y-auto max-h-[60vh] pr-1 space-y-4">
            {/* Duplicate warning */}
            {duplicates.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-600">Possible duplicate invoice</p>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {duplicates.map((d) => (
                      <li key={d.id}>
                        {d.invoiceNumber ? `#${d.invoiceNumber} · ` : ""}
                        ${d.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        {d.project ? ` · ${d.project.name}` : ""} —{" "}
                        <span className="capitalize">{d.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {/* Pay app items */}
            {isPayApp && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-2 text-sm font-medium bg-muted/30 border-b border-border">
                  Line Items ({payItems.length})
                </div>
                <div className="max-h-[30vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-1.5 px-3">Description</th>
                        <th className="py-1.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-border/50">
                          <td className="py-1.5 px-3">{item.description}</td>
                          <td className="py-1.5 px-3 text-right">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-background">
                      <tr className="border-t-2 border-primary/20 font-semibold">
                        <td className="py-1.5 px-3">Total</td>
                        <td className="py-1.5 px-3 text-right text-primary">
                          ${payItems.reduce((s, i) => s + i.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Editable fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="iad-vendor">Vendor Name</Label>
                <Input id="iad-vendor" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="iad-number">Invoice #</Label>
                <Input id="iad-number" value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="iad-amount">Amount</Label>
                <Input id="iad-amount" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="iad-desc">Description</Label>
                <Textarea id="iad-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Project</Label>
                <SearchableSelect
                  value={selectedProjectId}
                  onChange={(val) => { setSelectedProjectId(val); setSelectedLineItemId(""); }}
                  placeholder="Select a project"
                  options={projects.map((p) => ({
                    value: p.id,
                    label: p.address ? `${p.name} — ${p.address}` : p.name,
                  }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Budget Line Item</Label>
                {!selectedProjectId ? (
                  <p className="text-sm text-muted-foreground">Select a project first</p>
                ) : loadingLineItems ? (
                  <p className="text-sm text-muted-foreground">Loading line items...</p>
                ) : lineItems.length === 0 ? (
                  <p className="text-sm text-amber-600">No line items found for this project</p>
                ) : (
                  <SelectNative
                    value={selectedLineItemId}
                    onChange={(e) => setSelectedLineItemId(e.target.value)}
                    placeholder="Select a line item"
                    options={lineItems.map((li) => ({
                      value: li.id,
                      label: `${li.category.name} — ${li.description}`,
                    }))}
                  />
                )}
              </div>
            </div>

            {/* Return reason — shown only when returning */}
            {showReturnInput && (
              <div className="space-y-1.5 border-t border-border pt-3">
                <Label htmlFor="iad-return-reason">Reason for returning (optional)</Label>
                <Textarea
                  id="iad-return-reason"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Explain what needs to be corrected..."
                  rows={2}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center gap-2">
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mr-auto">
              <ExternalLink className="h-3.5 w-3.5" />
              Open PDF
            </a>
          )}
          <Button variant="outline" onClick={handleClose} disabled={actionLoading}>Cancel</Button>
          {!showReturnInput ? (
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => setShowReturnInput(true)}
              disabled={actionLoading}
            >
              Return to Submitter
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleReturn}
              disabled={actionLoading}
            >
              {actionLoading ? "Returning..." : "Confirm Return"}
            </Button>
          )}
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleApprove}
            disabled={actionLoading}
          >
            {actionLoading ? "Approving..." : `Approve ${isPayApp ? "Pay App" : "Invoice"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
