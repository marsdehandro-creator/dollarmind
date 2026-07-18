/**
 * DashboardService port (Phase 13 — home overview).
 */
export interface DashboardOverview {
  month: string;
  income: number; // cents
  expense: number; // cents
  net: number; // cents
  savingsRate: number; // % of income saved
  burnRate: number; // % of income spent
}

export interface CategoryBreakdownItem {
  categoryId: string | null;
  name: string;
  total: number; // cents
  pct: number; // share of month's expense
  changePct: number; // vs previous month (+/-)
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

export interface DashboardService {
  overview(tenantId: string, month?: string): Promise<DashboardOverview>;
  categories(tenantId: string, month?: string): Promise<CategoryBreakdown>;
  cashflow(tenantId: string, period?: 'daily' | 'weekly' | 'monthly'): Promise<CashFlow>;
  alerts(tenantId: string): Promise<{ alerts: DashboardAlert[] }>;
}
