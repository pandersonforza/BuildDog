"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AlertCircle, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SearchableSelect, SelectNative } from "@/components/ui/select";

interface Invoice {
  id: string;
  vendorName: string;
  invoiceNumber: string | null;
  amount: number;
  description: string | null;
  submittedDate: string | null;
  filePath: string | null;
  aiNotes: string | null;
  rejectionReason: string | null;
  project: { id: string; name: string; address: string } | null;
  lineItem: {
    id: string;
    description: string;
    category: { id: string; name: string } | null;
  } | null;
}

export function PendingApprovals() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [approveForm, setApproveForm] = useState({
    vendorName: "",
    invoiceNumber: "",
    amount: "",
    description: "",
  });
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedLineItemId, setSelectedLineItemId] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string; address: string }[]>([]);
  const [lineItems, setLineItems] = useState<{ id: string; description: string; category: { name: string } }[]>([]);
  const [loadingLineItems, setLoadingLineItems] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();

  const fetchInvoices = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/invoices?status=Submitted&approverId=${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setInvoices(data);
    } catch {
      console.error("Failed to fetch pending invoices");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchInvoices();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user, fetchInvoices]);

  const openView = async (invoice: Invoice) => {
    setViewingInvoice(invoice);
    setApproveForm({
      vendorName: invoice.vendorName,
      invoiceNumber: invoice.invoiceNumber || "",
      amount: String(invoice.amount),
      description: invoice.description || "",
    });
    setSelectedProjectId(invoice.project?.id || "");
    setSelectedLineItemId(invoice.lineItem?.id || "");
    setRejectReason("");
    setShowRejectInput(false);
    // Fetch all active projects for the selector
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } catch { /* silently ignore */ }
  };

  useEffect(() => {
    if (!selectedProjectId || !viewingInvoice) { setLineItems([]); return; }
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
  }, [selectedProjectId, viewingInvoice]);

  const closeView = () => {
    setViewingInvoice(null);
    setShowRejectInput(false);
    setRejectReason("");
    setLineItems([]);
  };

  const handleApprove = async () => {
    if (!viewingInvoice) return;
    setActionLoading(viewingInvoice.id);
    try {
      const res = await fetch(`/api/invoices/${viewingInvoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Approved",
          vendorName: approveForm.vendorName,
          invoiceNumber: approveForm.invoiceNumber || null,
          amount: parseFloat(approveForm.amount),
          description: approveForm.description || null,
          projectId: selectedProjectId || null,
          budgetLineItemId: selectedLineItemId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to approve");
      }
      toast({ title: "Invoice Approved", description: `Invoice from ${approveForm.vendorName} has been approved.` });
      closeView();
      fetchInvoices();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to approve invoice", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!viewingInvoice) return;
    setActionLoading(viewingInvoice.id);
    try {
      const res = await fetch(`/api/invoices/${viewingInvoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Pending Review",
          rejectionReason: rejectReason.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reject");
      }
      toast({ title: "Invoice Returned", description: `Invoice sent back to ${viewingInvoice.vendorName} submitter for revision.` });
      closeView();
      fetchInvoices();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to reject invoice", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return null;

  // Parse pay app items from aiNotes
  const getPayItems = (inv: Invoice) => {
    const match = inv.aiNotes?.match(/__payAppLineItems__([\s\S]+)$/);
    if (!match) return [];
    try { return JSON.parse(match[1]) as { lineItemId: string; description: string; amount: number }[]; }
    catch { return []; }
  };

  const getPdfUrl = (inv: Invoice) => {
    if (!inv.filePath) return null;
    return inv.filePath.startsWith("http")
      ? `/api/invoices/file?url=${encodeURIComponent(inv.filePath)}`
      : inv.filePath;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <CardTitle>Invoice Approvals</CardTitle>
            {invoices.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {invoices.length}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">No invoices waiting for your approval.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.vendorName}</TableCell>
                    <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                    <TableCell>{invoice.project?.name ?? "—"}</TableCell>
                    <TableCell>{invoice.submittedDate ? formatDate(invoice.submittedDate) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === invoice.id}
                        onClick={() => openView(invoice)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Full review dialog */}
      <Dialog open={!!viewingInvoice} onOpenChange={(o) => { if (!o) closeView(); }}>
        {viewingInvoice && (() => {
          const payItems = getPayItems(viewingInvoice);
          const isPayApp = payItems.length > 0;
          const pdfUrl = getPdfUrl(viewingInvoice);

          return (
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
                      <Label htmlFor="pa-vendor">Vendor Name</Label>
                      <Input id="pa-vendor" value={approveForm.vendorName} onChange={(e) => setApproveForm({ ...approveForm, vendorName: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pa-number">Invoice #</Label>
                      <Input id="pa-number" value={approveForm.invoiceNumber} onChange={(e) => setApproveForm({ ...approveForm, invoiceNumber: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pa-amount">Amount</Label>
                      <Input id="pa-amount" type="number" step="0.01" value={approveForm.amount} onChange={(e) => setApproveForm({ ...approveForm, amount: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pa-desc">Description</Label>
                      <Textarea id="pa-desc" value={approveForm.description} onChange={(e) => setApproveForm({ ...approveForm, description: e.target.value })} rows={3} />
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

                  {/* Rejection reason input — shown only when rejecting */}
                  {showRejectInput && (
                    <div className="space-y-1.5 border-t border-border pt-3">
                      <Label htmlFor="pa-reject-reason">Reason for returning (optional)</Label>
                      <Textarea
                        id="pa-reject-reason"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
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
                <Button variant="outline" onClick={closeView}>Cancel</Button>
                {!showRejectInput ? (
                  <Button
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/10"
                    onClick={() => setShowRejectInput(true)}
                    disabled={actionLoading !== null}
                  >
                    Return to Submitter
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading ? "Returning..." : "Confirm Return"}
                  </Button>
                )}
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleApprove}
                  disabled={actionLoading !== null}
                >
                  {actionLoading ? "Approving..." : `Approve ${isPayApp ? "Pay App" : "Invoice"}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          );
        })()}
      </Dialog>
    </>
  );
}
