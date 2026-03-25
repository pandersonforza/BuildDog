"use client";

import { useState, useEffect } from "react";
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
import { useToast } from "@/components/ui/toast";
import { CATEGORY_GROUPS, DEFAULT_SUBCATEGORIES } from "@/lib/constants";

interface EditCategory {
  id: string;
  name: string;
  categoryGroup: string;
}

interface BudgetCategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  category?: EditCategory;
  defaultGroup?: string;
  onSuccess: () => void;
}

export function BudgetCategoryForm({
  open,
  onOpenChange,
  projectId,
  category,
  defaultGroup,
  onSuccess,
}: BudgetCategoryFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [categoryGroup, setCategoryGroup] = useState<string>(CATEGORY_GROUPS[0]);

  const isEditing = !!category;

  useEffect(() => {
    if (open) {
      if (category) {
        setName(category.name);
        setCategoryGroup(category.categoryGroup);
      } else {
        setName("");
        setCategoryGroup(defaultGroup || CATEGORY_GROUPS[0]);
      }
    }
  }, [open, category, defaultGroup]);

  const suggestions = DEFAULT_SUBCATEGORIES[categoryGroup] || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEditing) {
        const res = await fetch(`/api/budget-categories/${category.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, categoryGroup }),
        });
        if (!res.ok) throw new Error("Failed to update category");
        toast({ title: "Subcategory updated" });
      } else {
        const res = await fetch("/api/budget-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, name, categoryGroup }),
        });
        if (!res.ok) throw new Error("Failed to create category");
        toast({ title: "Subcategory created" });
      }
      onSuccess();
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: `Failed to ${isEditing ? "update" : "create"} subcategory`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit" : "Add"} Budget Subcategory</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="catGroup">Category Group</Label>
            <select
              id="catGroup"
              value={categoryGroup}
              onChange={(e) => setCategoryGroup(e.target.value)}
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {CATEGORY_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="catName">Subcategory Name</Label>
            <Input
              id="catName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Building Costs"
              required
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setName(s)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      name === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save" : "Create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
