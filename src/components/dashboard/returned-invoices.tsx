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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";

interface ReturnedInvoice {
  id: string;
  vendorName: string;
  amount: number;
  rejectionReason: string | null;
  project: { id: string; name: string } | null;
}

export function ReturnedInvoices() {
  const [invoices, setInvoices] = useState<ReturnedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingInvoice, setViewingInvoice] = useState<ReturnedInvoice | null>(null);
  const { user, isLoading: authLoading } = useAuth();

  const fetchInvoices = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/invoices?status=Pending Review&submittedById=${user.id}&returned=true`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setInvoices(data);
    } catch {
      console.error("Failed to fetch returned invoices");
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

  if (loading || invoices.length === 0) return null;

  return (
    <>
      <Card className="border-amber-500/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-500" />
            <CardTitle>Invoices Returned to You</CardTitle>
            <Badge variant="secondary" className="ml-auto">
              {invoices.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.vendorName}</TableCell>
                  <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                  <TableCell>{invoice.project?.name ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px]">
                    {invoice.rejectionReason ? (
                      <span className="text-sm text-amber-600 truncate block">{invoice.rejectionReason}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">No reason given</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewingInvoice(invoice)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!viewingInvoice} onOpenChange={(o) => { if (!o) setViewingInvoice(null); }}>
        {viewingInvoice && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invoice Returned — {viewingInvoice.vendorName}</DialogTitle>
              <DialogDescription>
                This invoice was returned to you for revision.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">Vendor</span>
                <span className="font-medium">{viewingInvoice.vendorName}</span>
                <span className="text-muted-foreground">Amount</span>
                <span>{formatCurrency(viewingInvoice.amount)}</span>
                <span className="text-muted-foreground">Project</span>
                <span>{viewingInvoice.project?.name ?? "—"}</span>
              </div>
              {viewingInvoice.rejectionReason && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-xs font-medium text-amber-600 mb-1">Reason for return</p>
                  <p className="text-sm">{viewingInvoice.rejectionReason}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingInvoice(null)}>Close</Button>
              <Link
                href="/invoices"
                onClick={() => setViewingInvoice(null)}
                className="inline-flex items-center justify-center h-10 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Go to Invoices
              </Link>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
