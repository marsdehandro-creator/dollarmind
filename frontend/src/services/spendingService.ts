/**
 * Spending summary + trends API client.
 */
import { apiGet } from './apiClient.js';

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

export function getSummary(from?: string, to?: string): Promise<SpendingSummary> {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  const qs = q.toString();
  return apiGet<SpendingSummary>(`/transactions/summary${qs ? `?${qs}` : ''}`);
}

export function getTrends(months = 6): Promise<SpendingTrends> {
  return apiGet<SpendingTrends>(`/transactions/trends?months=${months}`);
}
