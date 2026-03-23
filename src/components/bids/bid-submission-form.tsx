"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Send, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface LineItem {
  id: string;
  description: string;
  amount: string;
  category: string;
}

interface BidSubmissionFormProps {
  token: string;
  projectName: string;
  projectAddress: string;
  prefillCompany?: string;
  prefillName?: string;
  prefillEmail?: string;
}

export function BidSubmissionForm({
  token,
  projectName,
  projectAddress,
  prefillCompany,
  prefillName,
  prefillEmail,
}: BidSubmissionFormProps) {
  const [gcCompany, setGcCompany] = useState(prefillCompany || "");
  const [gcName, setGcName] = useState(prefillName || "");
  const [gcEmail, setGcEmail] = useState(prefillEmail || "");
  const [gcPhone, setGcPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    // AIA G702/G703 Standard Schedule of Values
    { id: crypto.randomUUID(), description: "General Conditions", amount: "", category: "General" },
    { id: crypto.randomUUID(), description: "Site Work / Earthwork", amount: "", category: "Site Work" },
    { id: crypto.randomUUID(), description: "Concrete", amount: "", category: "Structure" },
    { id: crypto.randomUUID(), description: "Masonry", amount: "", category: "Structure" },
    { id: crypto.randomUUID(), description: "Metals / Structural Steel", amount: "", category: "Structure" },
    { id: crypto.randomUUID(), description: "Wood & Plastics / Carpentry", amount: "", category: "Structure" },
    { id: crypto.randomUUID(), description: "Thermal & Moisture Protection", amount: "", category: "Envelope" },
    { id: crypto.randomUUID(), description: "Doors & Windows", amount: "", category: "Envelope" },
    { id: crypto.randomUUID(), description: "Finishes", amount: "", category: "Finishes" },
    { id: crypto.randomUUID(), description: "Specialties", amount: "", category: "Finishes" },
    { id: crypto.randomUUID(), description: "Equipment", amount: "", category: "Equipment" },
    { id: crypto.randomUUID(), description: "Furnishings", amount: "", category: "Equipment" },
    { id: crypto.randomUUID(), description: "Special Construction", amount: "", category: "Special" },
    { id: crypto.randomUUID(), description: "Conveying Systems (Elevators)", amount: "", category: "Special" },
    { id: crypto.randomUUID(), description: "Mechanical / HVAC", amount: "", category: "MEP" },
    { id: crypto.randomUUID(), description: "Plumbing", amount: "", category: "MEP" },
    { id: crypto.randomUUID(), description: "Fire Protection", amount: "", category: "MEP" },
    { id: crypto.randomUUID(), description: "Electrical", amount: "", category: "MEP" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), description: "", amount: "", category: "" },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((li) => li.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems(
      lineItems.map((li) => (li.id === id ? { ...li, [field]: value } : li))
    );
  };

  const total = lineItems.reduce(
    (sum, li) => sum + (parseFloat(li.amount) || 0),
    0
  );

  const handleSubmit = async () => {
    setError(null);

    if (!gcCompany.trim()) {
      setError("Company name is required");
      return;
    }

    const validItems = lineItems.filter(
      (li) => li.description.trim() && parseFloat(li.amount) > 0
    );
    if (validItems.length === 0) {
      setError("At least one line item with a description and amount is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/bids/invite/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gcCompany: gcCompany.trim(),
          gcName: gcName.trim() || null,
          gcEmail: gcEmail.trim() || null,
          gcPhone: gcPhone.trim() || null,
          notes: notes.trim() || null,
          lineItems: validItems.map((li) => ({
            description: li.description.trim(),
            amount: parseFloat(li.amount),
            category: li.category.trim() || null,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit bid");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit bid");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
          <h1 className="text-2xl font-bold">Bid Submitted</h1>
          <p className="text-muted-foreground">
            Your bid for <span className="font-medium text-foreground">{projectName}</span> has
            been submitted successfully. The project team will review your submission.
          </p>
          <p className="text-sm text-muted-foreground">
            Total: {formatCurrency(total)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Submit a Bid</h1>
          <p className="text-lg text-muted-foreground">{projectName}</p>
          {projectAddress && (
            <p className="text-sm text-muted-foreground">{projectAddress}</p>
          )}
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Company Info */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Company Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Company Name *
              </label>
              <Input
                value={gcCompany}
                onChange={(e) => setGcCompany(e.target.value)}
                placeholder="Your company name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Contact Name
              </label>
              <Input
                value={gcName}
                onChange={(e) => setGcName(e.target.value)}
                placeholder="Contact person"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Email
              </label>
              <Input
                type="email"
                value={gcEmail}
                onChange={(e) => setGcEmail(e.target.value)}
                placeholder="email@company.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Phone
              </label>
              <Input
                value={gcPhone}
                onChange={(e) => setGcPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Bid Line Items</h2>
            <Button variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
          </div>

          <div className="space-y-3">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_120px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Description</span>
              <span>Category (optional)</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            {lineItems.map((li) => (
              <div
                key={li.id}
                className="grid grid-cols-[1fr_auto_120px_40px] gap-2 items-center"
              >
                <Input
                  value={li.description}
                  onChange={(e) =>
                    updateLineItem(li.id, "description", e.target.value)
                  }
                  placeholder="Line item description"
                />
                <Input
                  value={li.category}
                  onChange={(e) =>
                    updateLineItem(li.id, "category", e.target.value)
                  }
                  placeholder="Category"
                  className="w-32"
                />
                <Input
                  type="number"
                  value={li.amount}
                  onChange={(e) =>
                    updateLineItem(li.id, "amount", e.target.value)
                  }
                  placeholder="0.00"
                  className="text-right"
                  step="0.01"
                  min="0"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLineItem(li.id)}
                  disabled={lineItems.length <= 1}
                  className="h-9 w-9"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t border-border pt-4 flex items-center justify-between">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-lg font-bold">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-2">
          <h2 className="text-lg font-semibold">Notes (optional)</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes, qualifications, or exclusions..."
            className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              "Submitting..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" /> Submit Bid
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
