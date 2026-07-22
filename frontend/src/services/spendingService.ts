/**
 * Spending summary + trends local data access. Calls the on-device
 * spendingSummaryService directly.
 */
import { getContainer } from '../local/container.js';

export interface CategorySpend {
  categoryId: string | null;
  categoryName: string;
  total: number; // cents
  count: number;
}

export interface SpendingSummary {
  dateFrom: string | null;
  dateTo: string | null;
  income: number;
  expense: number;
  net: number;
  averageMonthlyExpense: number;
  byCategory: CategorySpend[];
}

export interface CategoryTrend {
  categoryId: string | null;
  categoryName: string;
  totals: number[];
}

export interface SpendingTrends {
  months: string[];
  expenseByMonth: number[];
  incomeByMonth: number[];
  categories: CategoryTrend[];
}

export async function getSummary(from?: string, to?: string): Promise<SpendingSummary> {
  const { spendingSummaryService, tenantId } = await getContainer();
  const result = await spendingSummaryService.monthlySummary(tenantId, from, to);
  return result as unknown as SpendingSummary;
}

export async function getTrends(months = 6): Promise<SpendingTrends> {
  const { spendingSummaryService, tenantId } = await getContainer();
  const result = await spendingSummaryService.trends(tenantId, months);
  return result as unknown as SpendingTrends;
}
