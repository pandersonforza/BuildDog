"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { SelectNative, SearchableSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Loader2, Upload, FileText, Sparkles, Check } from "lucide-react";
import { useAuth, type AuthUser } from "@/hooks/use-auth";
import type { AIInvoiceResult, Project, BudgetLineItemWithCategory } from "@/types";

interface UserOption {
  id: string;
  name: string;
  email: string;
}

type UploadStep = "upload" | "processing" | "review" | "multi-review" | "saving";

interface InvoiceUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onSuccess: () => void;
}

export function InvoiceUpload({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: InvoiceUploadProps) {
  const { toast } = useToast();
  const { user, canEdit } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<UploadStep>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileQueue, setFileQueue] = useState<File[]>([]);
  const fileQueueRef = useRef<File[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const currentFileIndexRef = useRef(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Queued reviewed invoices (for multi-file submit-all-at-end flow)
  interface ReviewedInvoice {
    vendorName: string;
    invoiceNumber: string;
    amount: number;
    date: string;
    description: string;
    projectId: string;
    budgetLineItemId: string;
    filePath: string;
    aiConfidence: number | null;
    aiNotes: string | null;
  }
  const [reviewedInvoices, setReviewedInvoices] = useState<ReviewedInvoice[]>([]);

  // AI result + form state
  const [aiResult, setAiResult] = useState<AIInvoiceResult | null>(null);
  const [multiInvoices, setMultiInvoices] = useState<AIInvoiceResult[]>([]);
  const [multiSelected, setMultiSelected] = useState<boolean[]>([]);
  const [vendorName, setVendorName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedLineItemId, setSelectedLineItemId] = useState<string>("");
  const [filePath, setFilePath] = useState("");
  const [approverId, setApproverId] = useState("");
  const [approver, setApprover] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");

  // Lookups
  const [projects, setProjects] = useState<Project[]>([]);
  const [lineItems, setLineItems] = useState<BudgetLineItemWithCategory[]>([]);
  const [loadingLineItems, setLoadingLineItems] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  // Reset all state when dialog closes
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setStep("upload");
        setSelectedFile(null);
        setFileQueue([]);
        fileQueueRef.current = [];
        setCurrentFileIndex(0);
        currentFileIndexRef.current = 0;
        setTotalFiles(0);
        setAiResult(null);
        setReviewedInvoices([]);
        setProcessedFiles([]);
        setProcessingProgress(0);
        setMultiInvoices([]);
        setMultiSelected([]);
        setVendorName("");
        setInvoiceNumber("");
        setAmount(0);
        setDate("");
        setDescription("");
        setSelectedProjectId(projectId ?? "");
        setSelectedLineItemId("");
        setFilePath("");
        setApproverId("");
        setApprover("");
        setSubmittedBy(user?.name ?? "");
        setIsDragging(false);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, projectId]
  );

  // Fetch projects and users on dialog open
  useEffect(() => {
    if (!open) return;
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data: Project[]) => {
        setProjects(data);
        if (projectId) {
          setSelectedProjectId(projectId);
        }
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Failed to load projects",
          variant: "destructive",
        });
      });
    fetch("/api/auth/users")
      .then((res) => res.json())
      .then((data: UserOption[]) => {
        setUsers(data);
        if (!approverId) {
          const defaultApprover = data.find((u: UserOption) => u.name.toLowerCase().includes("porter anderson"));
          if (defaultApprover) setApproverId(defaultApprover.id);
        }
      })
      .catch(() => {});
    if (user) {
      setSubmittedBy(user.name);
    }
  }, [open, projectId, toast, user]);

  // Fetch line items when selected project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setLineItems([]);
      setSelectedLineItemId("");
      return;
    }

    setLoadingLineItems(true);
    fetch(`/api/projects/${selectedProjectId}`)
      .then((res) => res.json())
      .then((project) => {
        // Flatten line items from budget categories
        const items: BudgetLineItemWithCategory[] = [];
        for (const cat of project.budgetCategories || []) {
          for (const li of cat.lineItems || []) {
            items.push({ ...li, category: cat });
          }
        }
        setLineItems(items);
        // If AI suggested a line item for this project, pre-select it
        if (
          aiResult?.suggestedLineItemId &&
          items.some((li) => li.id === aiResult.suggestedLineItemId)
        ) {
          setSelectedLineItemId(aiResult.suggestedLineItemId);
        } else {
          setSelectedLineItemId("");
        }
      })
      .catch(() => {
        setLineItems([]);
      })
      .finally(() => {
        setLoadingLineItems(false);
      });
  }, [selectedProjectId, aiResult]);

  // File selection — supports multiple files
  const handleFilesSelect = (files: FileList | File[]) => {
    const pdfs = Array.from(files).filter((f) => f.type === "application/pdf");
    if (pdfs.length === 0) {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF files",
        variant: "destructive",
      });
      return;
    }
    setFileQueue(pdfs);
    fileQueueRef.current = pdfs;
    setTotalFiles(pdfs.length);
    setCurrentFileIndex(0);
    currentFileIndexRef.current = 0;
    setSelectedFile(pdfs[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFilesSelect(files);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) handleFilesSelect(files);
  };

  // Processed results for each file (stored after batch AI processing)
  interface ProcessedFile {
    aiResult: AIInvoiceResult;
    filePath: string;
    fileName: string;
  }
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [processingProgress, setProcessingProgress] = useState(0);

  // Load a processed result into the form for review
  const loadProcessedFile = (index: number, files: ProcessedFile[]) => {
    const pf = files[index];
    setAiResult(pf.aiResult);
    setFilePath(pf.filePath);
    setVendorName(pf.aiResult.vendorName);
    setInvoiceNumber(pf.aiResult.invoiceNumber ?? "");
    setAmount(pf.aiResult.amount);
    setDate(pf.aiResult.date);
    setDescription(pf.aiResult.description);
    if (!projectId && pf.aiResult.suggestedProjectId) setSelectedProjectId(pf.aiResult.suggestedProjectId);
    if (pf.aiResult.suggestedLineItemId) setSelectedLineItemId(pf.aiResult.suggestedLineItemId);
    else setSelectedLineItemId("");
  };

  // Upload ALL files and process with AI in parallel, then start review
  const handleUploadAndProcess = async () => {
    const queue = fileQueueRef.current;
    if (queue.length === 0) return;

    setStep("processing");
    setProcessingProgress(0);

    try {
      const { upload } = await import("@vercel/blob/client");

      // Process all files concurrently
      const results = await Promise.all(
        queue.map(async (file, idx) => {
          // Upload
          const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const pathname = `invoices/${Date.now()}-${idx}-${originalName}`;
          const blob = await upload(pathname, file, {
            access: "private",
            handleUploadUrl: "/api/invoices/upload",
          });

          // Process with AI — failures are non-fatal; push through with empty fields
          let invoices: AIInvoiceResult[];
          try {
            const processRes = await fetch("/api/invoices/process", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filePath: blob.url }),
            });

            if (!processRes.ok) throw new Error("AI processing failed");

            const raw = await processRes.json();
            invoices = (raw.invoices || [raw]).map((inv: Record<string, unknown>) => ({
              ...inv,
              suggestedLineItemId: inv.suggestedLineItemId || inv.suggestedBudgetLineItemId || null,
            }));
          } catch {
            // AI couldn't extract data — let the user fill in the fields manually
            invoices = [{
              vendorName: "",
              invoiceNumber: null,
              amount: 0,
              date: new Date().toISOString().slice(0, 10),
              description: "",
              confidence: 0,
              reasoning: "AI could not extract invoice data. Please fill in the fields manually.",
              suggestedProjectId: null,
              suggestedProjectName: null,
              suggestedLineItemId: null,
              suggestedLineItemName: null,
            }];
          }

          setProcessingProgress((prev) => prev + 1);

          // If a single PDF contains multiple invoices, expand them
          return invoices.map((ai) => ({
            aiResult: ai,
            filePath: blob.url,
            fileName: file.name,
          }));
        })
      );

      // Flatten in case any PDF had multiple invoices
      const allProcessed = results.flat();

      if (allProcessed.length === 0) {
        throw new Error("No invoices could be extracted");
      }

      // If we ended up with multiple from multi-invoice PDFs and only 1 file, use multi-review
      if (queue.length === 1 && allProcessed.length > 1) {
        setMultiInvoices(allProcessed.map((p) => p.aiResult));
        setMultiSelected(allProcessed.map(() => true));
        setStep("multi-review");
        return;
      }

      // Store all processed files and start reviewing the first one
      setProcessedFiles(allProcessed);
      setTotalFiles(allProcessed.length);
      setCurrentFileIndex(0);
      currentFileIndexRef.current = 0;
      fileQueueRef.current = queue; // keep for ref
      loadProcessedFile(0, allProcessed);
      setStep("review");
    } catch (err) {
      toast({
        title: "Processing failed",
        description: err instanceof Error ? err.message : "Could not process invoices",
        variant: "destructive",
      });
      setStep("upload");
    }
  };

  // Capture current form data as a reviewed invoice — no hard validation,
  // so partially-extracted invoices can always be pushed through to review.
  const captureCurrentInvoice = (): ReviewedInvoice => {
    return {
      vendorName: vendorName.trim() || "",
      invoiceNumber: invoiceNumber.trim(),
      amount,
      date,
      description: description.trim(),
      projectId: selectedProjectId,
      budgetLineItemId: selectedLineItemId,
      filePath,
      aiConfidence: aiResult?.confidence ?? null,
      aiNotes: aiResult?.reasoning ?? null,
    };
  };

  // "Next" — save current form data and advance to next processed file
  const handleNext = () => {
    const invoice = captureCurrentInvoice();
    const updated = [...reviewedInvoices, invoice];
    setReviewedInvoices(updated);

    // Advance to next already-processed file (instant, no AI wait)
    const nextIndex = currentFileIndexRef.current + 1;
    currentFileIndexRef.current = nextIndex;
    setCurrentFileIndex(nextIndex);
    loadProcessedFile(nextIndex, processedFiles);
  };

  // Skip current invoice without saving it
  const handleSkip = async () => {
    const remaining = processedFiles.filter((_, i) => i !== currentFileIndex);

    if (remaining.length === 0) {
      // Skipped the last/only invoice
      if (reviewedInvoices.length === 0) {
        toast({ title: "Invoice skipped" });
        handleOpenChange(false);
      } else {
        // Save previously reviewed invoices without this one
        await handleSave(false, true);
      }
    } else {
      // More files — advance without capturing current
      const nextIndex = Math.min(currentFileIndex, remaining.length - 1);
      setProcessedFiles(remaining);
      setTotalFiles(remaining.length);
      currentFileIndexRef.current = nextIndex;
      setCurrentFileIndex(nextIndex);
      loadProcessedFile(nextIndex, remaining);
    }
  };

  // "Submit" — save current + submit all reviewed invoices
  const handleSave = async (submitForApproval = false, skipCurrent = false) => {
    let allInvoices: ReviewedInvoice[];
    if (skipCurrent) {
      if (reviewedInvoices.length === 0) { handleOpenChange(false); return; }
      allInvoices = reviewedInvoices;
    } else {
      const current = captureCurrentInvoice();
      allInvoices = [...reviewedInvoices, current];
    }

    if (submitForApproval) {
      if (!approverId || !submittedBy.trim()) {
        toast({ title: "Validation error", description: "Approver is required when submitting for approval", variant: "destructive" });
        return;
      }
    }

    setStep("saving");

    try {
      let created = 0;
      const dupeWarnings: string[] = [];
      const approverUser = users.find((u) => u.id === approverId);

      for (const inv of allInvoices) {
        const body: Record<string, unknown> = {
          vendorName: inv.vendorName,
          invoiceNumber: inv.invoiceNumber || null,
          amount: inv.amount,
          date: inv.date,
          description: inv.description,
          projectId: projectId || inv.projectId || null,
          budgetLineItemId: inv.budgetLineItemId || null,
          filePath: inv.filePath,
          aiConfidence: inv.aiConfidence,
          aiNotes: inv.aiNotes,
        };

        if (submitForApproval) {
          body.status = "Submitted";
          body.approver = approverUser?.name ?? "";
          body.approverId = approverId;
          body.submittedBy = submittedBy.trim();
          body.submittedById = user?.id ?? null;
          body.submittedDate = new Date().toISOString();
        }

        const res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.status === 409) {
          const dupeData = await res.json();
          // Auto-proceed but warn the user
          const retryRes = await fetch("/api/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, skipDuplicateCheck: true }),
          });
          if (retryRes.ok) {
            created++;
            dupeWarnings.push(dupeData.message);
          }
        } else if (res.ok) {
          created++;
        }
      }

      if (dupeWarnings.length > 0) {
        toast({
          title: "⚠️ Possible duplicates detected",
          description: dupeWarnings.join("; "),
          variant: "destructive",
        });
      }

      toast({
        title: submitForApproval
          ? `${created} invoice${created !== 1 ? "s" : ""} submitted for approval`
          : `${created} invoice${created !== 1 ? "s" : ""} created`,
      });
      onSuccess();
      handleOpenChange(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save invoices",
        variant: "destructive",
      });
      setStep("review");
    }
  };

  // Save multiple invoices
  const handleSaveMulti = async (submitForApproval = false) => {
    const selected = multiInvoices.filter((_, i) => multiSelected[i]);
    if (selected.length === 0) {
      toast({ title: "No invoices selected", variant: "destructive" });
      return;
    }

    if (submitForApproval && (!approverId || !submittedBy.trim())) {
      toast({ title: "Approver required", variant: "destructive" });
      return;
    }

    setStep("saving");
    try {
      let created = 0;
      const dupeWarnings: string[] = [];
      const approverUser = users.find((u) => u.id === approverId);

      for (const inv of selected) {
        const body: Record<string, unknown> = {
          vendorName: inv.vendorName,
          invoiceNumber: inv.invoiceNumber || null,
          amount: inv.amount,
          date: inv.date,
          description: inv.description,
          projectId: projectId || selectedProjectId || inv.suggestedProjectId || null,
          budgetLineItemId: inv.suggestedLineItemId || null,
          filePath,
          aiConfidence: inv.confidence ?? null,
          aiNotes: inv.reasoning ?? null,
        };

        if (submitForApproval) {
          body.status = "Submitted";
          body.approver = approverUser?.name ?? "";
          body.approverId = approverId;
          body.submittedBy = submittedBy.trim();
          body.submittedById = user?.id ?? null;
          body.submittedDate = new Date().toISOString();
        }

        const res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.status === 409) {
          const dupeData = await res.json();
          const retryRes = await fetch("/api/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, skipDuplicateCheck: true }),
          });
          if (retryRes.ok) {
            created++;
            dupeWarnings.push(dupeData.message);
          }
        } else if (res.ok) {
          created++;
        }
      }

      if (dupeWarnings.length > 0) {
        toast({
          title: "⚠️ Possible duplicates detected",
          description: dupeWarnings.join("; "),
          variant: "destructive",
        });
      }

      toast({
        title: submitForApproval ? "Invoices submitted for approval" : "Invoices created",
        description: `Created ${created} invoice${created !== 1 ? "s" : ""}`,
      });
      onSuccess();
      handleOpenChange(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save invoices",
        variant: "destructive",
      });
      setStep("multi-review");
    }
  };

  const confidenceBadge = (confidence: number) => {
    const pct = Math.round(confidence * 100);
    const color =
      pct >= 80
        ? "bg-emerald-100 text-emerald-800"
        : pct >= 50
          ? "bg-amber-100 text-amber-800"
          : "bg-red-100 text-red-800";
    return (
      <Badge variant="secondary" className={`${color} border-transparent`}>
        {pct}% confidence
      </Badge>
    );
  };

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: p.address ? `${p.name} - ${p.address}` : p.name,
  }));

  const lineItemOptions = lineItems.map((li) => ({
    value: li.id,
    label: `${li.category.name} - ${li.description}`,
  }));

  const approverOptions = users
    .filter((u) => u.id !== user?.id)
    .map((u) => ({ value: u.id, label: u.name }));

  const isLastFile = processedFiles.length <= 1 || currentFileIndex >= processedFiles.length - 1;

  if (!canEdit) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`max-h-[90vh] overflow-y-auto ${step === "review" && filePath ? "max-w-6xl" : step === "multi-review" ? "max-w-4xl" : "max-w-2xl"}`}>
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Upload Invoice"}
            {step === "processing" && "Processing Invoice(s)"}
            {step === "review" && (totalFiles > 1 ? `Review Invoice (${currentFileIndex + 1} of ${totalFiles})` : "Review Invoice Details")}
            {step === "multi-review" && `Review ${multiInvoices.length} Invoices Found`}
            {step === "saving" && "Saving Invoice(s)"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a PDF — it can contain one or multiple invoices."}
            {step === "processing" && "Please wait while we analyze your invoice(s)."}
            {step === "review" &&
              "Review and confirm the AI-extracted information below."}
            {step === "multi-review" &&
              "Multiple invoices were detected. Select which ones to create."}
            {step === "saving" && "Saving your invoice(s)..."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : selectedFile
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-border hover:border-primary/50"
              }`}
            >
              {fileQueue.length > 0 ? (
                <>
                  <FileText className="h-10 w-10 text-emerald-600 mb-2" />
                  <p className="text-sm font-medium">
                    {fileQueue.length === 1
                      ? fileQueue[0].name
                      : `${fileQueue.length} PDFs selected`}
                  </p>
                  {fileQueue.length > 1 && (
                    <div className="text-xs text-muted-foreground mt-1 max-h-16 overflow-y-auto">
                      {fileQueue.map((f, i) => (
                        <div key={i}>{f.name}</div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Click or drag to replace
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    Drag and drop invoice PDFs here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click to browse — you can select multiple files
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={handleInputChange}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleUploadAndProcess} disabled={fileQueue.length === 0}>
                <Upload className="h-4 w-4 mr-2" />
                Upload &amp; Analyze{fileQueue.length > 1 ? ` (${fileQueue.length} files)` : ""}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-sm font-medium">
              {totalFiles > 1
                ? `Analyzing invoices with AI... (${processingProgress} of ${totalFiles})`
                : "Analyzing invoice with AI..."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalFiles > 1 ? "All files are being processed in parallel" : "This may take a few seconds"}
            </p>
            {totalFiles > 1 && (
              <div className="w-48 h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(processingProgress / totalFiles) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {step === "review" && aiResult && (
          <div className={`${filePath ? "grid grid-cols-2 gap-6" : ""}`}>
            {/* PDF Preview */}
            {filePath && (
              <div className="border border-border rounded-lg overflow-hidden h-[65vh]">
                <iframe
                  src={filePath.startsWith('http') ? `/api/invoices/file?url=${encodeURIComponent(filePath)}` : filePath}
                  className="w-full h-full"
                  title="Invoice PDF Preview"
                />
              </div>
            )}

            {/* Form fields */}
            <div className="space-y-4 overflow-y-auto max-h-[65vh] pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendorName">Vendor Name</Label>
                <Input
                  id="vendorName"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Vendor name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">Invoice Number</Label>
                <Input
                  id="invoiceNumber"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Invoice #"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Invoice description"
                rows={3}
              />
            </div>

            {/* Project selector — only shown if not already in a project context */}
            {!projectId && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="project">Project</Label>
                  {aiResult.suggestedProjectName && (
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs text-muted-foreground">
                        AI suggested: {aiResult.suggestedProjectName}
                      </span>
                      {confidenceBadge(aiResult.confidence)}
                    </div>
                  )}
                </div>
                <SearchableSelect
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  placeholder="Select a project"
                  options={projectOptions}
                />
              </div>
            )}

            {/* AI Suggested Line Item */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="lineItem">Budget Line Item</Label>
                {aiResult.suggestedLineItemName && (
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs text-muted-foreground">
                      AI suggested: {aiResult.suggestedLineItemName}
                    </span>
                    {confidenceBadge(aiResult.confidence)}
                  </div>
                )}
              </div>
              {selectedProjectId ? (
                loadingLineItems ? (
                  <div className="h-10 flex items-center text-sm text-muted-foreground">
                    Loading line items...
                  </div>
                ) : lineItemOptions.length === 0 ? (
                  <div className="h-10 flex items-center text-sm text-amber-600">
                    No budget line items found.{" "}
                    <a
                      href={`/projects/${selectedProjectId}/budget`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline ml-1"
                    >
                      Add line items in the budget page first.
                    </a>
                  </div>
                ) : (
                  <SearchableSelect
                    value={selectedLineItemId}
                    onChange={setSelectedLineItemId}
                    placeholder="Search line items..."
                    options={lineItemOptions}
                  />
                )
              ) : !selectedProjectId ? (
                <p className="text-sm text-muted-foreground">
                  Select a project first to choose a line item
                </p>
              ) : null}
            </div>

            {/* Approval Workflow */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="approver">Assign Approver</Label>
                <SelectNative
                  id="approver"
                  value={approverId}
                  onChange={(e) => setApproverId(e.target.value)}
                  placeholder="Select an approver"
                  options={approverOptions}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submittedBy">Submitted By</Label>
                <Input
                  id="submittedBy"
                  value={submittedBy}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            {/* AI Reasoning */}
            {aiResult.reasoning && (
              <div className="rounded-md bg-muted/50 border border-border p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">AI Reasoning</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {aiResult.reasoning}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" className="mr-auto text-muted-foreground" onClick={handleSkip}>
                Skip
              </Button>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              {isLastFile ? (
                <>
                  <Button variant="outline" onClick={() => handleSave(false)}>
                    Save {reviewedInvoices.length > 0 ? `All ${reviewedInvoices.length + 1} as Drafts` : "as Draft"}
                  </Button>
                  <Button onClick={() => handleSave(true)}>
                    Submit {reviewedInvoices.length > 0 ? `All ${reviewedInvoices.length + 1}` : ""} for Approval
                  </Button>
                </>
              ) : (
                <Button onClick={handleNext}>
                  Next →
                </Button>
              )}
            </DialogFooter>
            </div>{/* close form fields wrapper */}
          </div>
        )}

        {/* Step: Multi-invoice review */}
        {step === "multi-review" && multiInvoices.length > 0 && (
          <div className="space-y-4">
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-muted-foreground">
                    <th className="py-2 px-3 w-8"></th>
                    <th className="py-2 px-3">Vendor</th>
                    <th className="py-2 px-3">Invoice #</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {multiInvoices.map((inv, idx) => (
                    <tr key={idx} className={`border-b border-border/50 ${multiSelected[idx] ? "" : "opacity-40"}`}>
                      <td className="py-2 px-3">
                        <button onClick={() => setMultiSelected(prev => prev.map((v, i) => i === idx ? !v : v))}>
                          <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                            multiSelected[idx] ? "bg-primary border-primary" : "border-muted-foreground/40"
                          }`}>
                            {multiSelected[idx] && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                        </button>
                      </td>
                      <td className="py-2 px-3 font-medium">{inv.vendorName}</td>
                      <td className="py-2 px-3">{inv.invoiceNumber || "—"}</td>
                      <td className="py-2 px-3 text-right">${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-3">{inv.date}</td>
                      <td className="py-2 px-3 max-w-[200px] truncate">{inv.description}</td>
                      <td className="py-2 px-3">{confidenceBadge(inv.confidence)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-primary/20 font-semibold">
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3" colSpan={2}>
                      {multiSelected.filter(Boolean).length} of {multiInvoices.length} selected
                    </td>
                    <td className="py-2 px-3 text-right text-primary">
                      ${multiInvoices.filter((_, i) => multiSelected[i]).reduce((s, inv) => s + inv.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3" colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Project selection for unmatched invoices */}
            {!projectId && (
              <div className="space-y-2">
                <Label>Default Project (for invoices without a match)</Label>
                <SearchableSelect
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  placeholder="Select a project"
                  options={projectOptions}
                />
              </div>
            )}

            {/* Approval */}
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
                <Input value={submittedBy} disabled className="bg-muted" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button variant="outline" onClick={() => handleSaveMulti(false)}>Save as Drafts</Button>
              <Button onClick={() => handleSaveMulti(true)}>Submit All for Approval</Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Saving */}
        {step === "saving" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-sm font-medium">Saving invoice(s)...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
