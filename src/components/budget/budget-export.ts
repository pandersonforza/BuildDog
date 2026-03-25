import * as XLSX from "xlsx";
import type { BudgetCategoryWithLineItems } from "@/types";

export function exportBudgetToExcel(
  categories: BudgetCategoryWithLineItems[],
  projectName: string
) {
  const rows: Record<string, string | number>[] = [];

  for (const category of categories) {
    // Category header row
    rows.push({
      Category: category.name,
      "Category Group": category.categoryGroup,
      Description: "",
      "Original Budget": "",
      "Current Budget": "",
      "Actual Cost": "",
      Remaining: "",
    });

    for (const li of category.lineItems) {
      rows.push({
        Category: "",
        "Category Group": "",
        Description: li.description,
        "Original Budget": li.originalBudget,
        "Current Budget": li.revisedBudget,
        "Actual Cost": li.actualCost,
        Remaining: li.revisedBudget - li.actualCost,
      });
    }
  }

  // Totals row
  const totalOriginal = categories.reduce((s, c) => s + c.lineItems.reduce((a, li) => a + li.originalBudget, 0), 0);
  const totalRevised = categories.reduce((s, c) => s + c.lineItems.reduce((a, li) => a + li.revisedBudget, 0), 0);
  const totalActual = categories.reduce((s, c) => s + c.lineItems.reduce((a, li) => a + li.actualCost, 0), 0);

  rows.push({
    Category: "",
    "Category Group": "",
    Description: "TOTAL",
    "Original Budget": totalOriginal,
    "Current Budget": totalRevised,
    "Actual Cost": totalActual,
    Remaining: totalRevised - totalActual,
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  ws["!cols"] = [
    { wch: 25 }, // Category
    { wch: 18 }, // Category Group
    { wch: 35 }, // Description
    { wch: 16 }, // Original Budget
    { wch: 16 }, // Current Budget
    { wch: 16 }, // Actual Cost
    { wch: 16 }, // Remaining
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Budget");
  XLSX.writeFile(wb, `${projectName.replace(/[^a-zA-Z0-9]/g, "_")}_Budget.xlsx`);
}
