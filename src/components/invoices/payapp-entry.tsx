"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Loader2, Upload, Download, FileText, CheckCircle, AlertCircle } from "lucide-react";
// xlsx is dynamically imported when needed to reduce bundle size
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/utils";

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface BudgetLineItem {
  id: string;
  description: string;
  revisedBudget: number;
  actualCost: number;
  categoryId: string;
}

interface BudgetCategory {
  id: string;
  name: string;
  categoryGroup: string;
  lineItems: BudgetLineItem[];
}

interface PayAppFormItem {
  lineItemId: string;
  description: string;
  categoryName: string;
  budget: number;
  previouslyBilled: number;
  currentAmount: number;
}

interface PdfExtractedItem {
  description: string;
  amount: number;
  matchedLineItemId: string | null;
  manualLineItemId: string;
}

type Step = "form" | "saving";

interface PayAppEntryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onSuccess: () => void;
}

// Normalize a string for comparison: lowercase, strip punctuation, then collapse whitespace
const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

export function PayAppEntry({ open, onOpenChange, projectId, onSuccess }: PayAppEntryProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("form");
  const [gcCompany, setGcCompany] = useState("");
  const [appNumber, setAppNumber] = useState("");
  const [periodTo, setPeriodTo] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<PayAppFormItem[]>([]);
  const [approverId, setApproverId] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfItems, setPdfItems] = useState<PdfExtractedItem[]>([]);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Download a blank template with line item descriptions
  const handleDownloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const rows = items.map((item) => ({
      "Line Item": item.description,
      "Category": item.categoryName,
      "Budget": item.budget,
      "Previously Billed": item.previouslyBilled,
      "This Period": 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 18 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pay App");
    XLSX.writeFile(wb, `PayApp_Template_${appNumber || "blank"}.xlsx`);
  };

  // Import from Excel — match by line item description
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import("xlsx");
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        // Pre-scan rows outside setItems so we can diagnose without state
        let rowsWithAmount = 0;
        const excelDescs: string[] = [];
        for (const row of rows) {
          const descRaw = String(
            row["Line Item"] ?? row["line item"] ?? row["Description"] ??
            row["description"] ?? row["Item"] ?? row["item"] ?? ""
          ).trim();
          const amountRaw = String(
            row["This Period"] ?? row["this period"] ?? row["Amount"] ??
            row["amount"] ?? row["Current"] ?? row["current"] ??
            row["Billing"] ?? row["billing"] ?? 0
          );
          const amount = parseFloat(amountRaw.replace(/[$,\s]/g, "")) || 0;
          if (descRaw) excelDescs.push(descRaw);
          if (amount > 0) rowsWithAmount++;
        }

        let matched = 0;
        setItems((prev) => {
          const updated = [...prev];
          for (const row of rows) {
            // Accept any plausible column name for the description
            const descRaw = String(
              row["Line Item"] ?? row["line item"] ?? row["Description"] ??
              row["description"] ?? row["Item"] ?? row["item"] ?? ""
            ).trim();

            // Accept any plausible column name for the amount
            const amountRaw = String(
              row["This Period"] ?? row["this period"] ?? row["Amount"] ??
              row["amount"] ?? row["Current"] ?? row["current"] ??
              row["Billing"] ?? row["billing"] ?? 0
            );
            // Strip currency symbols, commas, spaces before parsing (e.g. "$1,234.56" → 1234.56)
            const amount = parseFloat(amountRaw.replace(/[$,\s]/g, "")) || 0;

            if (!descRaw || amount <= 0) continue;

            const descNorm = normalize(descRaw);

            // 1. Exact normalized match
            let idx = updated.findIndex((item) => normalize(item.description) === descNorm);

            // 2. Fallback: one description contains the other
            if (idx < 0) {
              idx = updated.findIndex(
                (item) =>
                  normalize(item.description).includes(descNorm) ||
                  descNorm.includes(normalize(item.description))
              );
            }

            if (idx >= 0) {
              updated[idx] = { ...updated[idx], currentAmount: amount };
              matched++;
            }
          }
          return updated;
        });

        if (matched === 0 && rows.length > 0) {
          const budgetSample = items.slice(0, 2).map((i) => `"${i.description}"`).join(", ");
          const excelSample = excelDescs.slice(0, 2).map((d) => `"${d}"`).join(", ");
          const amountNote = rowsWithAmount === 0
            ? "⚠️ All amount values are 0 or blank — fill in the Amount column before importing."
            : `${rowsWithAmount} rows have amounts > 0.`;
          toast({
            title: "No matches found",
            description: `${amountNote} Excel descriptions: ${excelSample || "none"}. Budget descriptions: ${budgetSample || "none"}.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Excel imported",
            description: `Matched ${matched} line item${matched !== 1 ? "s" : ""} from ${rows.length} rows`,
          });
        }
      } catch {
        toast({ title: "Import failed", description: "Could not read Excel file", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset the input so the same file can be re-imported
    e.target.value = "";
  };

  // Import from PDF — upload to Vercel Blob, then parse via Claude API
  const handlePdfImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side size check (Vercel Blob supports up to 500MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "PDF must be smaller than 50MB.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    setPdfParsing(true);
    (async () => {
      try {
        // Send PDF as FormData — simpler and avoids Blob handshake complexity
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/payapp/parse", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          // Read body as text first so we don't lose Vercel's 413 / plain-text errors
          const body = await res.text().catch(() => "");
          let msg = `HTTP ${res.status}`;
          try {
            const parsed = JSON.parse(body) as { error?: string };
            if (parsed.error) msg = parsed.error;
          } catch {
            if (body) msg = body.slice(0, 200);
          }
          throw new Error(msg);
        }

        const data = await res.json() as { items: Array<{ description: string; amount: number }> };
        const extractedItems = data.items ?? [];

        // Match each extracted item against budget line items
        let autoMatched = 0;
        const matched: PdfExtractedItem[] = extractedItems.map((extracted) => {
          const descNorm = normalize(extracted.description);

          // 1. Exact normalized match
          let found = items.find((item) => normalize(item.description) === descNorm);

          // 2. Fallback: substring match
          if (!found) {
            found = items.find(
              (item) =>
                normalize(item.description).includes(descNorm) ||
                descNorm.includes(normalize(item.description))
            );
          }

          if (found) autoMatched++;

          return {
            description: extracted.description,
            amount: extracted.amount,
            matchedLineItemId: found ? found.lineItemId : null,
            manualLineItemId: "",
          };
        });

        setPdfItems(matched);
        toast({
          title: "PDF parsed",
          description: `Extracted ${matched.length} item${matched.length !== 1 ? "s" : ""}, ${autoMatched} matched automatically`,
        });
      } catch (err) {
        toast({
          title: "PDF import failed",
          description: err instanceof Error ? err.message : "Could not parse PDF",
          variant: "destructive",
        });
      } finally {
        setPdfParsing(false);
      }
    })();
    // Reset the input so the same file can be re-imported
    e.target.value = "";
  };

  // Apply PDF extracted items to the grid
  const applyPdfItems = () => {
    let applied = 0;
    setItems((prev) => {
      const updated = [...prev];
      for (const pdfItem of pdfItems) {
        const targetId = pdfItem.matchedLineItemId ?? pdfItem.manualLineItemId;
        if (!targetId) continue;
        const idx = updated.findIndex((item) => item.lineItemId === targetId);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], currentAmount: pdfItem.amount };
          applied++;
        }
      }
      return updated;
    });
    setPdfItems([]);
    toast({
      title: "Applied to grid",
      description: `Updated ${applied} line item${applied !== 1 ? "s" : ""} from PDF`,
    });
  };

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setStep("form");
        setGcCompany("");
        setAppNumber("");
        setPeriodTo(new Date().toISOString().split("T")[0]);
        setApproverId("");
        setItems([]);
        setPdfItems([]);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange]
  );

  // Fetch hard cost line items from the project budget
  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch("/api/auth/users").then((r) => r.json()),
    ])
      .then(([project, usersData]) => {
        setUsers(usersData);
        if (!approverId) {
          const defaultApprover = usersData.find((u: { id: string; name: string }) => u.name.toLowerCase().includes("porter anderson"));
          if (defaultApprover) setApproverId(defaultApprover.id);
        }

        const categories: BudgetCategory[] = project.budgetCategories || [];
        // Filter to Hard Costs group only
        const hardCostCategories = categories.filter(
          (c) => c.categoryGroup === "Hard Costs" || c.categoryGroup === "Hard Cost"
        );

        const formItems: PayAppFormItem[] = [];
        for (const cat of hardCostCategories) {
          for (const li of cat.lineItems) {
            formItems.push({
              lineItemId: li.id,
              description: li.description,
              categoryName: cat.name,
              budget: li.revisedBudget,
              previouslyBilled: li.actualCost,
              currentAmount: 0,
            });
          }
        }
        setItems(formItems);
      })
      .catch(() => {
        toast({ title: "Error", description: "Failed to load budget data", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [open, projectId, toast]);

  const updateAmount = (index: number, value: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, currentAmount: value } : item))
    );
  };

  const itemsWithAmounts = items.filter((li) => li.currentAmount > 0);
  const totalCurrentBilled = itemsWithAmounts.reduce((sum, li) => sum + li.currentAmount, 0);

  const handleSave = async (submitForApproval = false) => {
    if (itemsWithAmounts.length === 0) {
      toast({ title: "No amounts entered", description: "Enter at least one line item amount", variant: "destructive" });
      return;
    }

    if (!gcCompany.trim()) {
      toast({ title: "GC company required", description: "Enter the GC company name", variant: "destructive" });
      return;
    }

    if (submitForApproval && !approverId) {
      toast({ title: "Approver required", description: "Select an approver to submit for approval", variant: "destructive" });
      return;
    }

    setStep("saving");

    try {
      const approverUser = users.find((u) => u.id === approverId);

      // Build line item breakdown for the description
      const lineBreakdown = itemsWithAmounts
        .map((li) => `${li.description}: ${formatCurrency(li.currentAmount)}`)
        .join("\n");

      // Store line item IDs and amounts as JSON for budget distribution on approval
      const payAppLineItems = itemsWithAmounts.map((li) => ({
        lineItemId: li.lineItemId,
        description: li.description,
        amount: li.currentAmount,
      }));

      const body: Record<string, unknown> = {
        vendorName: gcCompany.trim(),
        invoiceNumber: appNumber ? `PA-${appNumber}` : null,
        amount: totalCurrentBilled,
        date: periodTo,
        description: `Pay Application${appNumber ? ` #${appNumber}` : ""} - ${itemsWithAmounts.length} line items`,
        projectId: projectId || null,
        budgetLineItemId: null,
        aiNotes: `Pay App Line Items:\n${lineBreakdown}\n\n__payAppLineItems__${JSON.stringify(payAppLineItems)}`,
      };

      if (submitForApproval) {
        body.status = "Submitted";
        body.approver = approverUser?.name ?? "";
        body.approverId = approverId;
        body.submittedBy = user?.name ?? "";
        body.submittedById = user?.id ?? null;
        body.submittedDate = new Date().toISOString();
      }

      let res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        const dupeData = await res.json();
        toast({
          title: "⚠️ Possible duplicate detected",
          description: dupeData.message,
          variant: "destructive",
        });
        res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, skipDuplicateCheck: true }),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to create pay app");
      }

      toast({
        title: submitForApproval ? "Pay app submitted for approval" : "Pay app created",
        description: `${formatCurrency(totalCurrentBilled)} across ${itemsWithAmounts.length} line items`,
      });
      onSuccess();
      handleOpenChange(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save pay app",
        variant: "destructive",
      });
      setStep("form");
    }
  };

  const approverOptions = users
    .filter((u) => u.id !== user?.id)
    .map((u) => ({ value: u.id, label: u.name }));

  // Group items by subcategory for display
  const grouped = new Map<string, PayAppFormItem[]>();
  for (const item of items) {
    if (!grouped.has(item.categoryName)) grouped.set(item.categoryName, []);
    grouped.get(item.categoryName)!.push(item);
  }

  // All budget line items as flat options for the unmatched dropdown
  const allLineItemOptions = items.map((item) => ({
    value: item.lineItemId,
    label: `${item.categoryName} › ${item.description}`,
  }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "form" ? "Pay Application Entry" : "Creating Invoices"}
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Enter the current billing amounts for each hard cost line item."
              : "Creating invoices from entered amounts..."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>GC Company *</Label>
                <Input
                  value={gcCompany}
                  onChange={(e) => setGcCompany(e.target.value)}
                  placeholder="General contractor name"
                />
              </div>
              <div className="space-y-2">
                <Label>Application #</Label>
                <Input
                  value={appNumber}
                  onChange={(e) => setAppNumber(e.target.value)}
                  placeholder="Pay app number"
                />
              </div>
              <div className="space-y-2">
                <Label>Period To</Label>
                <Input
                  type="date"
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                />
              </div>
            </div>

            {/* Import/Export buttons */}
            {items.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download Template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => excelInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Import from Excel
                </Button>
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleExcelImport}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={pdfParsing}
                >
                  {pdfParsing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Parsing PDF...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-1" />
                      Upload Pay App PDF
                    </>
                  )}
                </Button>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handlePdfImport}
                />
              </div>
            )}

            {/* Line items table */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Loading budget line items...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hard cost line items found in this project&apos;s budget. Add line items to the budget first.
              </div>
            ) : (
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-muted-foreground">
                      <th className="py-2 px-3">Line Item</th>
                      <th className="py-2 px-3 text-right w-32">Budget</th>
                      <th className="py-2 px-3 text-right w-32">Previously Billed</th>
                      <th className="py-2 px-3 text-right w-36">This Period</th>
                      <th className="py-2 px-3 text-right w-32">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(grouped.entries()).map(([catName, catItems]) => (
                      <tbody key={catName}>
                        {/* Subcategory header */}
                        <tr className="bg-primary/10 border-t-2 border-primary/20">
                          <td colSpan={5} className="py-2 px-3 font-semibold text-foreground">
                            {catName}
                          </td>
                        </tr>
                        {catItems.map((item) => {
                          const idx = items.indexOf(item);
                          const remaining = item.budget - item.previouslyBilled - item.currentAmount;
                          return (
                            <tr key={item.lineItemId} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="py-1.5 px-3">{item.description}</td>
                              <td className="py-1.5 px-3 text-right text-muted-foreground">
                                {formatCurrency(item.budget)}
                              </td>
                              <td className="py-1.5 px-3 text-right text-muted-foreground">
                                {formatCurrency(item.previouslyBilled)}
                              </td>
                              <td className="py-1.5 px-3 text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="w-32 text-right h-7 text-sm"
                                  value={item.currentAmount || ""}
                                  onChange={(e) => updateAmount(idx, parseFloat(e.target.value) || 0)}
                                  placeholder="0.00"
                                />
                              </td>
                              <td className={`py-1.5 px-3 text-right ${remaining < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                                {formatCurrency(remaining)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-primary/20 font-semibold">
                      <td className="py-2 px-3">
                        Total ({itemsWithAmounts.length} items)
                      </td>
                      <td className="py-2 px-3 text-right">
                        {formatCurrency(items.reduce((s, li) => s + li.budget, 0))}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {formatCurrency(items.reduce((s, li) => s + li.previouslyBilled, 0))}
                      </td>
                      <td className="py-2 px-3 text-right text-primary">
                        {formatCurrency(totalCurrentBilled)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {formatCurrency(
                          items.reduce((s, li) => s + li.budget - li.previouslyBilled - li.currentAmount, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* PDF Extracted Items section */}
            {pdfItems.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
                  <span className="text-sm font-semibold text-foreground">PDF Extracted Items</span>
                  <Button type="button" size="sm" onClick={applyPdfItems}>
                    Apply to Grid
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/20 text-left text-muted-foreground">
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right w-32">Amount</th>
                        <th className="py-2 px-3 w-24">Status</th>
                        <th className="py-2 px-3">Budget Line Item</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pdfItems.map((pdfItem, idx) => {
                        const matchedItem = pdfItem.matchedLineItemId
                          ? items.find((i) => i.lineItemId === pdfItem.matchedLineItemId)
                          : null;
                        return (
                          <tr key={idx} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="py-1.5 px-3 text-foreground">{pdfItem.description}</td>
                            <td className="py-1.5 px-3 text-right">{formatCurrency(pdfItem.amount)}</td>
                            <td className="py-1.5 px-3">
                              {matchedItem ? (
                                <span className="flex items-center gap-1 text-green-500">
                                  <CheckCircle className="h-4 w-4" />
                                  <span className="text-xs">Matched</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-yellow-500">
                                  <AlertCircle className="h-4 w-4" />
                                  <span className="text-xs">Unmatched</span>
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-3">
                              {matchedItem ? (
                                <span className="text-muted-foreground text-xs">
                                  {matchedItem.categoryName} › {matchedItem.description}
                                </span>
                              ) : (
                                <SelectNative
                                  value={pdfItem.manualLineItemId}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPdfItems((prev) =>
                                      prev.map((p, i) =>
                                        i === idx ? { ...p, manualLineItemId: val } : p
                                      )
                                    );
                                  }}
                                  placeholder="Select a line item..."
                                  options={allLineItemOptions}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground px-3 py-2 border-t border-border">
                  Unmatched items without a selection will be skipped
                </p>
              </div>
            )}

            {/* Approver */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assign Approver</Label>
                <SelectNative
                  value={approverId}
                  onChange={(e) => setApproverId(e.target.value)}
                  placeholder="Select an approver"
                  options={approverOptions}
                />
              </div>
              <div className="space-y-2">
                <Label>Submitted By</Label>
                <Input value={user?.name ?? ""} disabled className="bg-muted" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button variant="outline" onClick={() => handleSave(false)}>Save as Drafts</Button>
              <Button onClick={() => handleSave(true)}>Submit for Approval</Button>
            </DialogFooter>
          </div>
        )}

        {step === "saving" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-sm font-medium">Creating invoices from pay application...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
