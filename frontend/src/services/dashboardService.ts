/**
 * Dashboard local data access. Calls the on-device dashboardAggregationService
 * directly instead of an HTTP endpoint — same DashboardPayload shape the
 * backend's unified /dashboard endpoint used to return (Phase 18).
 */
import { getContainer } from '../local/container.js';

export interface DashboardCashflowPoint {
  label: string;
  income: number;
  expense: number;
  net: number;
}

export interface DashboardAlert {
  kind: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  count?: number;
}

export interface CategorySpend {
  categoryId: string | null;
  categoryName: string;
  total: number;
  count: number;
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

export async function getDashboard(from: string, to: string): Promise<DashboardPayload> {
  const { dashboardAggregationService, tenantId } = await getContainer();
  return dashboardAggregationService.getDashboard(tenantId, from, to);
}
