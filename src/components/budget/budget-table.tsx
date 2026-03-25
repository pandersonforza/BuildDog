"use client";

import { useState, useMemo, Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { BudgetLineItemForm } from "@/components/budget/budget-line-item-form";
import { BudgetCategoryForm } from "@/components/budget/budget-category-form";
import { useToast } from "@/components/ui/toast";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { CATEGORY_GROUPS } from "@/lib/constants";
import type { BudgetCategoryWithLineItems, BudgetLineItem } from "@/types";

interface BudgetTableProps {
  projectId: string;
  categories: BudgetCategoryWithLineItems[];
  onMutate: () => void;
}

interface GroupedCategories {
  group: string;
  categories: BudgetCategoryWithLineItems[];
  totals: {
    original: number;
    revised: number;
    committed: number;
    actual: number;
    variance: number;
    pct: number;
  };
}

export function BudgetTable({ projectId, categories, onMutate }: BudgetTableProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.id))
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(CATEGORY_GROUPS)
  );
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [lineItemFormOpen, setLineItemFormOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [editLineItem, setEditLineItem] = useState<BudgetLineItem | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<{ type: "category" | "lineItem"; id: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { toast } = useToast();
  const { canEdit } = useAuth();

  // Group categories by categoryGroup
  const grouped = useMemo<GroupedCategories[]>(() => {
    const groupOrder = [...CATEGORY_GROUPS];
    const map = new Map<string, BudgetCategoryWithLineItems[]>();

    for (const cat of categories) {
      const group = cat.categoryGroup || "Other";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(cat);
    }

    // Sort groups by CATEGORY_GROUPS order, then any extras
    const allGroups = [...new Set([...groupOrder, ...map.keys()])];

    return allGroups
      .filter((g) => map.has(g))
      .map((group) => {
        const cats = map.get(group)!;
        const original = cats.reduce((s, c) => s + c.lineItems.reduce((a, li) => a + li.originalBudget, 0), 0);
        const revised = cats.reduce((s, c) => s + c.lineItems.reduce((a, li) => a + li.revisedBudget, 0), 0);
        const committed = cats.reduce((s, c) => s + c.lineItems.reduce((a, li) => a + li.committedCost, 0), 0);
        const actual = cats.reduce((s, c) => s + c.lineItems.reduce((a, li) => a + li.actualCost, 0), 0);
        return {
          group,
          categories: cats,
          totals: {
            original,
            revised,
            committed,
            actual,
            variance: revised - actual,
            pct: revised > 0 ? (actual / revised) * 100 : 0,
          },
        };
      });
  }, [categories]);

  const toggleCategory = (id: string) => {
    const next = new Set(expandedCategories);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCategories(next);
  };

  const toggleGroup = (group: string) => {
    const next = new Set(expandedGroups);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    setExpandedGroups(next);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const url =
        deleteTarget.type === "category"
          ? `/api/budget-categories/${deleteTarget.id}`
          : `/api/budget-line-items/${deleteTarget.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Deleted successfully" });
      onMutate();
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Description</TableHead>
              <TableHead className="text-right">Original</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.map(({ group, categories: groupCats, totals }) => {
              const isGroupExpanded = expandedGroups.has(group);

              return (
                <Fragment key={group}>
                  {/* Group Header Row */}
                  <TableRow className="bg-primary/15 font-bold border-t-2 border-primary/30">
                    <TableCell>
                      <button
                        type="button"
                        className="flex items-center gap-2"
                        onClick={() => toggleGroup(group)}
                      >
                        {isGroupExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="text-base">{group}</span>
                        <span className="text-xs text-muted-foreground font-normal ml-1">
                          ({groupCats.length} {groupCats.length === 1 ? "subcategory" : "subcategories"})
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.original)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.revised)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.committed)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.actual)}</TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay amount={totals.variance} showVariance baseAmount={0} />
                    </TableCell>
                    <TableCell className="text-right">{formatPercent(totals.pct)}</TableCell>
                    <TableCell />
                  </TableRow>

                  {/* Subcategories under this group */}
                  {isGroupExpanded &&
                    groupCats.map((category) => {
                      const isExpanded = expandedCategories.has(category.id);
                      const catOriginal = category.lineItems.reduce((s, li) => s + li.originalBudget, 0);
                      const catRevised = category.lineItems.reduce((s, li) => s + li.revisedBudget, 0);
                      const catCommitted = category.lineItems.reduce((s, li) => s + li.committedCost, 0);
                      const catActual = category.lineItems.reduce((s, li) => s + li.actualCost, 0);
                      const catRemaining = catRevised - catActual;
                      const catPct = catRevised > 0 ? (catActual / catRevised) * 100 : 0;

                      return (
                        <Fragment key={category.id}>
                          {/* Subcategory Row */}
                          <TableRow className="bg-muted/40 font-semibold border-t border-border/50">
                            <TableCell>
                              <button
                                type="button"
                                className="flex items-center gap-2 pl-6"
                                onClick={() => toggleCategory(category.id)}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                                <span>{category.name}</span>
                              </button>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(catOriginal)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(catRevised)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(catActual)}</TableCell>
                            <TableCell className="text-right">
                              <CurrencyDisplay amount={catRemaining} showVariance baseAmount={0} />
                            </TableCell>
                            <TableCell className="text-right">{formatPercent(catPct)}</TableCell>
                            <TableCell>
                              {canEdit && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      setSelectedCategoryId(category.id);
                                      setEditLineItem(undefined);
                                      setLineItemFormOpen(true);
                                    }}
                                    title="Add line item"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      setDeleteTarget({ type: "category", id: category.id });
                                      setDeleteOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>

                          {/* Line Item Rows */}
                          {isExpanded &&
                            category.lineItems.map((li) => {
                              const variance = li.revisedBudget - li.actualCost;
                              const pct = li.revisedBudget > 0 ? (li.actualCost / li.revisedBudget) * 100 : 0;
                              return (
                                <TableRow key={li.id} className="hover:bg-muted/30">
                                  <TableCell className="pl-16 text-muted-foreground">{li.description}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(li.originalBudget)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(li.revisedBudget)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(li.actualCost)}</TableCell>
                                  <TableCell className="text-right">
                                    <CurrencyDisplay amount={variance} showVariance baseAmount={0} />
                                  </TableCell>
                                  <TableCell className="text-right">{formatPercent(pct)}</TableCell>
                                  <TableCell>
                                    {canEdit && (
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => {
                                            setSelectedCategoryId(category.id);
                                            setEditLineItem(li);
                                            setLineItemFormOpen(true);
                                          }}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => {
                                            setDeleteTarget({ type: "lineItem", id: li.id });
                                            setDeleteOpen(true);
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3 text-destructive" />
                                        </Button>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </Fragment>
                      );
                    })}
                </Fragment>
              );
            })}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No budget categories. Add one to get started.
                </TableCell>
              </TableRow>
            )}
            {categories.length > 0 && (() => {
              const totalOriginal = categories.reduce((s, c) => s + c.lineItems.reduce((a, li) => a + li.originalBudget, 0), 0);
              const totalRevised = categories.reduce((s, c) => s + c.lineItems.reduce((a, li) => a + li.revisedBudget, 0), 0);
              const totalCommitted = categories.reduce((s, c) => s + c.lineItems.reduce((a, li) => a + li.committedCost, 0), 0);
              const totalActual = categories.reduce((s, c) => s + c.lineItems.reduce((a, li) => a + li.actualCost, 0), 0);
              const totalRemaining = totalRevised - totalActual;
              const totalPct = totalRevised > 0 ? (totalActual / totalRevised) * 100 : 0;
              return (
                <TableRow className="bg-muted font-bold border-t-2 border-border">
                  <TableCell>Total Budget</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalOriginal)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalRevised)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalActual)}</TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay amount={totalRemaining} showVariance baseAmount={0} />
                  </TableCell>
                  <TableCell className="text-right">{formatPercent(totalPct)}</TableCell>
                  <TableCell />
                </TableRow>
              );
            })()}
          </TableBody>
        </Table>
      </div>

      <BudgetCategoryForm
        open={categoryFormOpen}
        onOpenChange={setCategoryFormOpen}
        projectId={projectId}
        onSuccess={onMutate}
      />

      <BudgetLineItemForm
        open={lineItemFormOpen}
        onOpenChange={(open) => {
          setLineItemFormOpen(open);
          if (!open) setEditLineItem(undefined);
        }}
        categoryId={selectedCategoryId}
        lineItem={editLineItem}
        onSuccess={onMutate}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete"
        description={
          deleteTarget?.type === "category"
            ? "Delete this subcategory and all its line items?"
            : "Delete this line item?"
        }
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />
    </div>
  );
}
