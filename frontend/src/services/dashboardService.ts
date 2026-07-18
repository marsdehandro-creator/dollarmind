/**
 * Dashboard API client.
 */
import { apiGet } from './apiClient.js';

export interface DashboardOverview {
  month: string;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  burnRate: number;
}

export interface CategoryBreakdownItem {
  categoryId: string | null;
  name: string;
  total: number;
  pct: number;
  changePct: number;
}

export interface CategoryBreakdown {
  month: string;
  total: number;
  items: CategoryBreakdownItem[];
  top3: CategoryBreakdownItem[];
}

export interface CashFlowPoint {
  label: string;
  income: number;
  expense: number;
  net: number;
}

export interface CashFlow {
  period: 'daily' | 'weekly' | 'monthly';
  points: CashFlowPoint[];
}

export interface DashboardAlert {
  kind: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  count?: number;
}

export function getOverview(month?: string): Promise<DashboardOverview> {
  return apiGet<DashboardOverview>(`/dashboard/overview${month ? `?month=${month}` : ''}`);
}

export function getCategories(month?: string): Promise<CategoryBreakdown> {
  return apiGet<CategoryBreakdown>(`/dashboard/categories${month ? `?month=${month}` : ''}`);
}

export function getCashflow(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<CashFlow> {
  return apiGet<CashFlow>(`/dashboard/cashflow?period=${period}`);
}

export function getAlerts(): Promise<{ alerts: DashboardAlert[] }> {
  return apiGet<{ alerts: DashboardAlert[] }>('/dashboard/alerts');
}

/** Unified, range-driven dashboard (Phase 18). */
export interface DashboardCashflowPoint {
  label: string;
  income: number;
  expense: number;
  net: number;
}

export interface DashboardPayload {
  range: { from: string; to: string };
  hasData: boolean;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  burnRate: number;
  categories: CategorySpend[];
  cashflow: { granularity: 'daily' | 'weekly' | 'monthly'; points: DashboardCashflowPoint[] };
  alerts: DashboardAlert[];
}

export interface CategorySpend {
  categoryId: string | null;
  categoryName: string;
  total: number;
  count: number;
}

export function getDashboard(from: string, to: string): Promise<DashboardPayload> {
  return apiGet<DashboardPayload>(`/dashboard?from=${from}&to=${to}`);
}
