"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Upload, FileSpreadsheet, Loader2, Trash2, ChevronDown, ChevronRight } from "lucide-react";

interface LineItem {
  description: string;
  originalBudget: number;
  revisedBudget: number;
}

interface Category {
  name: string;
  categoryGroup: string;
  lineItems: LineItem[];
}

interface BudgetImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

export function BudgetImport({ open, onOpenChange, projectId, onSuccess }: BudgetImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "processing" | "review">("upload");
  const [fileName, setFileName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [aiNotes, setAiNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [clearExisting, setClearExisting] = useState(true);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setCategories([]);
    setAiNotes("");
    setSaving(false);
    setExpandedCategories(new Set());
    setClearExisting(true);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const toggleCategory = (index: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStep("processing");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", projectId);

    try {
      const res = await fetch("/api/budget-import", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to process file");
      }

      const result = await res.json();
      setCategories(result.categories);
      setAiNotes(result.notes || "");
      setExpandedCategories(new Set(result.categories.map((_: Category, i: number) => i)));
      setStep("review");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process file",
        variant: "destructive",
      });
      setStep("upload");
      setFileName("");
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeLineItem = (catIndex: number, itemIndex: number) => {
    setCategories((prev) => {
      const next = [...prev];
      const cat = { ...next[catIndex], lineItems: [...next[catIndex].lineItems] };
      cat.lineItems.splice(itemIndex, 1);
      // Remove category if no line items left
      if (cat.lineItems.length === 0) {
        next.splice(catIndex, 1);
      } else {
        next[catIndex] = cat;
      }
      return next;
    });
  };

  const removeCategory = (catIndex: number) => {
    setCategories((prev) => {
      const next = [...prev];
      next.splice(catIndex, 1);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/budget-import/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, categories, clearExisting }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save budget");
      }

      toast({ title: "Budget imported successfully" });
      onSuccess();
      handleClose(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save budget",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const totalLineItems = categories.reduce((sum, cat) => sum + cat.lineItems.length, 0);
  const totalBudget = categories.reduce(
    (sum, cat) => sum + cat.lineItems.reduce((s, li) => s + li.originalBudget, 0),
    0
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Budget from Excel</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload an Excel file (.xlsx, .xls) containing your project budget.
              AI will analyze the spreadsheet and organize it into budget categories and line items.
            </p>
            <div
              className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm font-medium">Click to select an Excel file</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx or .xls files</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Processing {fileName}...</p>
            <p className="text-xs text-muted-foreground">AI is analyzing your spreadsheet and organizing the budget</p>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {categories.length} subcategories, {totalLineItems} line items
                </p>
                <p className="text-sm text-muted-foreground">
                  Total Budget: {formatCurrency(totalBudget)}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                  className="rounded border-border"
                />
                Replace existing budget
              </label>
            </div>

            {aiNotes && (
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                <span className="font-medium">AI Notes:</span> {aiNotes}
              </div>
            )}

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {categories.map((cat, catIndex) => {
                const catTotal = cat.lineItems.reduce((s, li) => s + li.originalBudget, 0);
                const isExpanded = expandedCategories.has(catIndex);

                return (
                  <div key={catIndex} className="border border-border rounded-md">
                    <div
                      className="flex items-center justify-between px-3 py-2 bg-muted/50 cursor-pointer"
                      onClick={() => toggleCategory(catIndex)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium text-sm">{cat.name}</span>
                        <span className="text-xs text-muted-foreground">({cat.categoryGroup})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{formatCurrency(catTotal)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCategory(catIndex);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="divide-y divide-border">
                        {cat.lineItems.map((li, itemIndex) => (
                          <div
                            key={itemIndex}
                            className="flex items-center justify-between px-3 py-1.5 pl-9 text-sm"
                          >
                            <span className="flex-1 truncate">{li.description}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-muted-foreground w-28 text-right">
                                {formatCurrency(li.originalBudget)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => removeLineItem(catIndex, itemIndex)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || categories.length === 0}>
                {saving ? "Saving..." : "Import Budget"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
