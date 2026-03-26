"use client";

import { useState } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { InvoiceUpload } from "@/components/invoices/invoice-upload";
import { PayAppEntry } from "@/components/invoices/payapp-entry";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { Plus, ExternalLink, Trash2, DollarSign, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { InvoiceWithRelations } from "@/types";

interface InvoiceListProps {
  invoices: InvoiceWithRelations[];
  onMutate: () => void;
  showProject?: boolean;
  projectId?: string;
}

export function InvoiceList({
  invoices,
  onMutate,
  showProject = true,
  projectId,
}: InvoiceListProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [payAppOpen, setPayAppOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingInvoiceId, setRejectingInvoiceId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approvingInvoice, setApprovingInvoice] = useState<InvoiceWithRelations | null>(null);
  const [approveForm, setApproveForm] = useState({
    vendorName: "",
    invoiceNumber: "",
    amount: "",
    description: "",
  });
  const [payAppItemsOpen, setPayAppItemsOpen] = useState(false);
  const { toast } = useToast();
  const { user, canEdit } = useAuth();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/invoices/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete invoice");
      toast({ title: "Invoice deleted" });
      onMutate();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete invoice",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (invoice: InvoiceWithRelations) => {
    if (!invoice.approver) {
      toast({
        title: "Cannot submit",
        description: "An approver must be assigned before submitting",
        variant: "destructive",
      });
      return;
    }
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Submitted" }),
      });
      if (!res.ok) throw new Error("Failed to submit invoice");
      toast({ title: "Invoice submitted for approval" });
      onMutate();
    } catch {
      toast({
        title: "Error",
        description: "Failed to submit invoice",
        variant: "destructive",
      });
    }
  };

  const openApproveDialog = (invoice: InvoiceWithRelations) => {
    setApprovingInvoice(invoice);
    setApproveForm({
      vendorName: invoice.vendorName,
      invoiceNumber: invoice.invoiceNumber || "",
      amount: String(invoice.amount),
      description: invoice.description || "",
    });
    setApproveDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!approvingInvoice) return;
    try {
      const res = await fetch(`/api/invoices/${approvingInvoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Approved",
          vendorName: approveForm.vendorName,
          invoiceNumber: approveForm.invoiceNumber || null,
          amount: parseFloat(approveForm.amount),
          description: approveForm.description || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to approve invoice");
      toast({ title: "Invoice approved" });
      setApproveDialogOpen(false);
      setApprovingInvoice(null);
      onMutate();
    } catch {
      toast({
        title: "Error",
        description: "Failed to approve invoice",
        variant: "destructive",
      });
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Paid" }),
      });
      if (!res.ok) throw new Error("Failed to mark as paid");
      toast({ title: "Invoice marked as paid" });
      onMutate();
    } catch {
      toast({
        title: "Error",
        description: "Failed to mark invoice as paid",
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!rejectingInvoiceId) return;
    try {
      const res = await fetch(`/api/invoices/${rejectingInvoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Rejected",
          rejectionReason: rejectionReason.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to reject invoice");
      toast({ title: "Invoice rejected" });
      setRejectDialogOpen(false);
      setRejectingInvoiceId(null);
      setRejectionReason("");
      onMutate();
    } catch {
      toast({
        title: "Error",
        description: "Failed to reject invoice",
        variant: "destructive",
      });
    }
  };

  const columns: ColumnDef<InvoiceWithRelations, unknown>[] = [
    {
      accessorKey: "vendorName",
      header: "Vendor Name",
    },
    {
      accessorKey: "invoiceNumber",
      header: "Invoice #",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.invoiceNumber || "-"}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(row.original.amount);
        return <span>{formatted}</span>;
      },
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.date),
    },
    ...(showProject
      ? [
          {
            accessorKey: "project.name" as const,
            header: "Project",
            cell: ({ row }: { row: { original: InvoiceWithRelations } }) => {
              const project = row.original.project;
              if (!project) {
                return (
                  <span className="text-sm text-muted-foreground">
                    Unassigned
                  </span>
                );
              }
              return (
                <Link
                  href={`/projects/${project.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {project.name}
                </Link>
              );
            },
          } satisfies ColumnDef<InvoiceWithRelations, unknown>,
        ]
      : []),
    {
      id: "lineItem",
      header: "Line Item",
      cell: ({ row }) => {
        const li = row.original.lineItem;
        if (!li) {
          return (
            <span className="text-sm text-muted-foreground">-</span>
          );
        }
        return (
          <span className="text-sm">
            {li.category.name} - {li.description}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "approver",
      header: "Approver",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.approver || "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <div className="flex items-center gap-1">
            {row.original.filePath && (
              <a
                href={row.original.filePath.startsWith('http') ? `/api/invoices/file?url=${encodeURIComponent(row.original.filePath)}` : row.original.filePath}
                target="_blank"
                rel="noopener noreferrer"
                title="View PDF"
                className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent hover:text-accent-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {canEdit && status === "Pending Review" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSubmit(row.original)}
                >
                  Submit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setDeleteId(row.original.id);
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
            {canEdit && status === "Submitted" && (
              <>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => openApproveDialog(row.original)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setRejectingInvoiceId(row.original.id);
                    setRejectionReason("");
                    setRejectDialogOpen(true);
                  }}
                >
                  Reject
                </Button>
              </>
            )}
            {canEdit && status === "Approved" && (
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => handleMarkPaid(row.original.id)}
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Mark Paid
              </Button>
            )}
            {user?.role === "admin" && status !== "Pending Review" && (
              <Button
                variant="ghost"
                size="icon"
                title="Delete invoice (admin)"
                onClick={() => {
                  setDeleteId(row.original.id);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Invoices</h2>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPayAppOpen(true)}>
              <FileText className="h-4 w-4 mr-2" />
              Pay App Entry
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Upload Invoice
            </Button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        searchKey="vendorName"
        searchPlaceholder="Search invoices..."
      />

      <InvoiceUpload
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        projectId={projectId}
        onSuccess={onMutate}
      />

      <PayAppEntry
        open={payAppOpen}
        onOpenChange={setPayAppOpen}
        projectId={projectId}
        onSuccess={onMutate}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Invoice"
        description="Are you sure you want to delete this invoice? This action cannot be undone."
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        {(() => {
          const notes = approvingInvoice?.aiNotes || "";
          const match = notes.match(/__payAppLineItems__([\s\S]+)$/);
          let payItems: { lineItemId: string; description: string; amount: number }[] = [];
          if (match) { try { payItems = JSON.parse(match[1]); } catch { /* empty */ } }
          const isPayApp = payItems.length > 0;

          const pdfUrl = approvingInvoice?.filePath
            ? approvingInvoice.filePath.startsWith('http')
              ? `/api/invoices/file?url=${encodeURIComponent(approvingInvoice.filePath)}`
              : approvingInvoice.filePath
            : null;

          return (
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>Approve {isPayApp ? "Pay Application" : "Invoice"}</DialogTitle>
                <DialogDescription>
                  Review and edit the details before approving.
                </DialogDescription>
              </DialogHeader>

              <div className={`grid gap-6 ${pdfUrl ? "grid-cols-2" : ""}`}>
                {/* PDF Preview — left side */}
                {pdfUrl && (
                  <div className="border border-border rounded-lg overflow-hidden h-[65vh]">
                    <iframe
                      src={pdfUrl}
                      className="w-full h-full"
                      title="Invoice PDF Preview"
                    />
                  </div>
                )}

                {/* Right side: form + pay app items */}
                <div className="overflow-y-auto max-h-[65vh] pr-1">

              <div className={isPayApp ? "space-y-4" : ""}>
                {/* Pay App line items — left side */}
                {isPayApp && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="px-3 py-2 text-sm font-medium bg-muted/30 border-b border-border">
                      Line Items ({payItems.length})
                    </div>
                    <div className="max-h-[50vh] overflow-y-auto">
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

                {/* Form fields — right side (or full width for regular invoices) */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="approve-vendor">Vendor Name</Label>
                    <Input
                      id="approve-vendor"
                      value={approveForm.vendorName}
                      onChange={(e) => setApproveForm({ ...approveForm, vendorName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="approve-invoiceNumber">Invoice #</Label>
                    <Input
                      id="approve-invoiceNumber"
                      value={approveForm.invoiceNumber}
                      onChange={(e) => setApproveForm({ ...approveForm, invoiceNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="approve-amount">Amount</Label>
                    <Input
                      id="approve-amount"
                      type="number"
                      step="0.01"
                      value={approveForm.amount}
                      onChange={(e) => setApproveForm({ ...approveForm, amount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="approve-description">Description</Label>
                    <Textarea
                      id="approve-description"
                      value={approveForm.description}
                      onChange={(e) => setApproveForm({ ...approveForm, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>

                </div>{/* close right-side scrollable */}
              </div>{/* close grid */}

              <DialogFooter>
                <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleApprove}
                >
                  Approve {isPayApp ? "Pay App" : "Invoice"}
                </Button>
              </DialogFooter>
            </DialogContent>
          );
        })()}
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Invoice</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectionReason">Rejection Reason</Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
            >
              Reject Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
