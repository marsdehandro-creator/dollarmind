/**
 * SpendingSummaryService port (docs/requirements.md F5).
 */
export interface CategorySpend {
  categoryId: string | null;
  categoryName: string;
  total: number; // cents
  count: number;
}

export interface SpendingSummary {
  dateFrom: string | null;
  dateTo: string | null;
  income: number; // cents
  expense: number; // cents
  net: number; // cents
  averageMonthlyExpense: number; // cents
  byCategory: CategorySpend[];
}

export interface CategoryTrend {
  categoryId: string | null;
  categoryName: string;
  totals: number[]; // aligned to months[]
}

export interface SpendingTrends {
  months: string[]; // YYYY-MM, ascending
  expenseByMonth: number[];
  incomeByMonth: number[];
  categories: CategoryTrend[]; // top categories by total expense
}

export interface SpendingSummaryService {
  monthlySummary(tenantId: string, dateFrom?: string, dateTo?: string): Promise<SpendingSummary>;
  trends(tenantId: string, months?: number): Promise<SpendingTrends>;
}
