/**
 * DashboardAggregationService port (Phase 18).
 *
 * A unified, date-range-driven dashboard computed directly from the database —
 * independent of any upload's success. Every metric degrades gracefully: if a
 * data source is empty the corresponding figure is simply 0 / empty, and
 * `hasData` reports whether anything exists for the range.
 *
 * Income model (Phase 18 §2.5): income = net salary (from salary slips) + cash
 * inflows. Expenses = debit transactions + manual expenses + cash outflows.
 */
import type { CategorySpend } from './SpendingSummaryService.js';
import type { DashboardAlert } from './DashboardService.js';

export interface DashboardCashflowPoint {
  label: string;
  income: number;
  expense: number;
  net: number;
}

export interface DashboardCashflow {
  granularity: 'daily' | 'weekly' | 'monthly';
  points: DashboardCashflowPoint[];
}

export interface DashboardPayload {
  range: { from: string; to: string };
  hasData: boolean;
  income: number;
  expense: number;
  net: number;
  savingsRate: number; // %
  burnRate: number; // %
  categories: CategorySpend[];
  cashflow: DashboardCashflow;
  alerts: DashboardAlert[];
}

export interface DashboardAggregationService {
  getDashboard(tenantId: string, from: string, to: string): Promise<DashboardPayload>;
  getIncome(tenantId: string, from: string, to: string): Promise<number>;
  getExpenses(tenantId: string, from: string, to: string): Promise<number>;
  getCategoryTotals(tenantId: string, from: string, to: string): Promise<CategorySpend[]>;
  getCashflow(tenantId: string, from: string, to: string): Promise<DashboardCashflow>;
  getNetPosition(tenantId: string, from: string, to: string): Promise<number>;
  getSavingsRate(tenantId: string, from: string, to: string): Promise<number>;
  getBurnRate(tenantId: string, from: string, to: string): Promise<number>;
}
