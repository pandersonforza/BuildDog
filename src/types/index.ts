import type {
  Project,
  BudgetCategory,
  BudgetLineItem,
  Vendor,
  Contract,
  DrawRequest,
  DrawLineItem,
  Document,
  Invoice,
  User,
  Task,
} from "@prisma/client";

export type {
  Project,
  BudgetCategory,
  BudgetLineItem,
  Vendor,
  Contract,
  DrawRequest,
  DrawLineItem,
  Document,
  Invoice,
  User,
  Task,
};

export type InvoiceWithRelations = Invoice & {
  project: Project | null;
  lineItem: (BudgetLineItem & { category: BudgetCategory }) | null;
};

export interface AIInvoiceResult {
  vendorName: string;
  invoiceNumber: string | null;
  amount: number;
  date: string;
  description: string;
  suggestedProjectId: string | null;
  suggestedProjectName: string | null;
  suggestedLineItemId: string | null;
  suggestedLineItemName: string | null;
  confidence: number;
  reasoning: string;
}

export type BudgetLineItemWithCategory = BudgetLineItem & {
  category: BudgetCategory;
};

export type BudgetCategoryWithLineItems = BudgetCategory & {
  lineItems: BudgetLineItem[];
};

export type ProjectWithBudget = Project & {
  budgetCategories: BudgetCategoryWithLineItems[];
};

export type ProjectWithRelations = Project & {
  budgetCategories: BudgetCategoryWithLineItems[];
  contracts: ContractWithVendor[];
  drawRequests: DrawRequestWithLineItems[];
  documents: Document[];
};

export type ContractWithVendor = Contract & {
  vendor: Vendor;
};

export type ContractWithRelations = Contract & {
  vendor: Vendor;
  project: Project;
  lineItem: BudgetLineItem | null;
};

export type DrawLineItemWithBudget = DrawLineItem & {
  budgetLineItem: BudgetLineItem;
};

export type DrawRequestWithLineItems = DrawRequest & {
  lineItems: DrawLineItemWithBudget[];
};

export type DrawRequestWithRelations = DrawRequest & {
  lineItems: DrawLineItemWithBudget[];
  project: Project;
};

export interface PortfolioKPIs {
  totalProjects: number;
  activeProjects: number;
  totalBudget: number;
  totalCommitted: number;
  totalActualCost: number;
  totalDrawsFunded: number;
  budgetVariance: number;
  budgetVariancePercent: number;
  monthlyPaid?: number;
}

export interface BudgetSummary {
  originalBudget: number;
  revisedBudget: number;
  committedCost: number;
  actualCost: number;
  variance: number;
  variancePercent: number;
  percentComplete: number;
}

export interface CategorySummary extends BudgetSummary {
  id: string;
  name: string;
  categoryGroup: string;
  lineItemCount: number;
}
