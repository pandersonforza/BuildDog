"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import type { BudgetSummary } from "@/types";

interface BudgetOverviewProps {
  summary: BudgetSummary;
}

export function BudgetOverview({ summary }: BudgetOverviewProps) {
  const remaining = summary.revisedBudget - summary.actualCost;
  const cards = [
    { label: "Original Budget", amount: summary.originalBudget },
    { label: "Current Budget", amount: summary.revisedBudget },
    { label: "Actual Cost", amount: summary.actualCost },
    { label: "Remaining", amount: remaining, isRemaining: true },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CurrencyDisplay amount={card.amount} size="lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
