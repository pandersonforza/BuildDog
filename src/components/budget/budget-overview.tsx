"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import type { BudgetSummary, BudgetCategoryWithLineItems } from "@/types";

interface BudgetOverviewProps {
  summary: BudgetSummary;
  categories: BudgetCategoryWithLineItems[];
}

export function BudgetOverview({ summary, categories }: BudgetOverviewProps) {
  const remaining = summary.revisedBudget - summary.actualCost;

  // Flatten all line items across every category
  const allLineItems = categories.flatMap((c) => c.lineItems);

  // Contingency = line items whose description matches "contingency"
  const contingencyItems = allLineItems.filter((li) =>
    /contingency/i.test(li.description)
  );
  const contingencyBudget = contingencyItems.reduce(
    (sum, li) => sum + li.revisedBudget,
    0
  );

  // Overages = non-contingency lines where actualCost exceeds revisedBudget
  const totalOverages = allLineItems
    .filter(
      (li) =>
        !/contingency/i.test(li.description) &&
        li.actualCost > li.revisedBudget
    )
    .reduce((sum, li) => sum + (li.actualCost - li.revisedBudget), 0);

  const currentContingency = contingencyItems.length === 0 ? 0 : contingencyBudget - totalOverages;

  const cards = [
    { label: "Original Budget", amount: summary.originalBudget },
    { label: "Current Budget", amount: summary.revisedBudget },
    { label: "Actual Cost", amount: summary.actualCost },
    { label: "Remaining", amount: remaining },
    { label: "Current Contingency", amount: currentContingency, isContingency: true },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CurrencyDisplay
                amount={card.amount}
                size="lg"
                className={
                  card.isContingency
                    ? currentContingency < 0
                      ? "text-destructive"
                      : "text-emerald-600"
                    : undefined
                }
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
