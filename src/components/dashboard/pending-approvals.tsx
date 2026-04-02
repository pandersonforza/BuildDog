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
import { formatCurrency, formatDate } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { InvoiceApprovalDialog, type InvoiceForApproval } from "@/components/invoices/invoice-approval-dialog";

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
  const [reviewingInvoice, setReviewingInvoice] = useState<InvoiceForApproval | null>(null);
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

  if (loading) return null;

  const oldest5 = [...invoices]
    .sort((a, b) => {
      const aDate = a.submittedDate ? new Date(a.submittedDate).getTime() : 0;
      const bDate = b.submittedDate ? new Date(b.submittedDate).getTime() : 0;
      return aDate - bDate;
    })
    .slice(0, 5);

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
            <>
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
                  {oldest5.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.vendorName}</TableCell>
                      <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>{invoice.project?.name ?? "—"}</TableCell>
                      <TableCell>{invoice.submittedDate ? formatDate(invoice.submittedDate) : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReviewingInvoice(invoice)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {invoices.length > 5 && (
                <p className="text-xs text-muted-foreground mt-3">
                  Showing 5 oldest of {invoices.length} pending — go to the Invoices tab to see all.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <InvoiceApprovalDialog
        open={!!reviewingInvoice}
        onOpenChange={(o) => { if (!o) setReviewingInvoice(null); }}
        invoice={reviewingInvoice}
        onSuccess={() => {
          setReviewingInvoice(null);
          fetchInvoices();
        }}
      />
    </>
  );
}
