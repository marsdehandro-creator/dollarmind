/**
 * LocalDashboardService — overview, category breakdown, cash-flow timeline, and
 * alerts. Reuses SpendingSummaryService (which already merges bank transactions,
 * manual expenses, and cash entries) plus the repositories for raw data.
 *
 * NOTE on income: "income" = bank credit transactions + cash inflows (actual
 * money received). Salary slips are surfaced via the "missing salary slip" alert
 * rather than added to income, to avoid double-counting the salary deposit that
 * also appears as a bank credit.
 */
import type {
  CashFlow,
  CashFlowPoint,
  CategoryBreakdown,
  CategoryBreakdownItem,
  DashboardAlert,
  DashboardOverview,
  DashboardService,
} from './interfaces/DashboardService.js';
import type { SpendingSummaryService } from './interfaces/SpendingSummaryService.js';
import type { TransactionRepository } from '../repositories/TransactionRepository.js';
import type { ManualExpenseRepository } from '../repositories/ManualExpenseRepository.js';
import type { CashEntryRepository } from '../repositories/CashEntryRepository.js';
import type { IssueRepository } from '../repositories/IssueRepository.js';
import type { SalarySlipRepository } from '../repositories/SalarySlipRepository.js';

function monthRange(month?: string): { from: string; to: string; label: string } {
  const base = month ? new Date(`${month}-01T00:00:00Z`) : new Date();
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const from = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { from, to, label: from.slice(0, 7) };
}

function prevMonthRange(month?: string): { from: string; to: string } {
  const base = month ? new Date(`${month}-01T00:00:00Z`) : new Date();
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { from, to };
}

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export class LocalDashboardService implements DashboardService {
  constructor(
    private readonly summary: SpendingSummaryService,
    private readonly transactions: TransactionRepository,
    private readonly manualExpenses: ManualExpenseRepository,
    private readonly cashEntries: CashEntryRepository,
    private readonly issues: IssueRepository,
    private readonly salarySlips: SalarySlipRepository,
  ) {}

  async overview(tenantId: string, month?: string): Promise<DashboardOverview> {
    const { from, to, label } = monthRange(month);
    const s = await this.summary.monthlySummary(tenantId, from, to);
    const savingsRate = s.income > 0 ? Math.round((s.net / s.income) * 100) : 0;
    const burnRate = s.income > 0 ? Math.round((s.expense / s.income) * 100) : 0;
    return { month: label, income: s.income, expense: s.expense, net: s.net, savingsRate, burnRate };
  }

  async categories(tenantId: string, month?: string): Promise<CategoryBreakdown> {
    const { from, to, label } = monthRange(month);
    const prev = prevMonthRange(month);
    const cur = await this.summary.monthlySummary(tenantId, from, to);
    const previous = await this.summary.monthlySummary(tenantId, prev.from, prev.to);
    const prevByCat = new Map(previous.byCategory.map((c) => [c.categoryId, c.total]));
    const total = cur.byCategory.reduce((sum, c) => sum + c.total, 0);

    const items: CategoryBreakdownItem[] = cur.byCategory.map((c) => {
      const prevTotal = prevByCat.get(c.categoryId) ?? 0;
      const changePct = prevTotal > 0 ? Math.round(((c.total - prevTotal) / prevTotal) * 100) : c.total > 0 ? 100 : 0;
      return {
        categoryId: c.categoryId,
        name: c.categoryName,
        total: c.total,
        pct: total > 0 ? Math.round((c.total / total) * 100) : 0,
        changePct,
      };
    });
    items.sort((a, b) => b.total - a.total);
    return { month: label, total, items, top3: items.slice(0, 3) };
  }

  async cashflow(tenantId: string, period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<CashFlow> {
    const now = new Date();
    let windowStart: Date;
    let keys: string[];
    const keyFor = (dateStr: string): string =>
      period === 'daily' ? dateStr.slice(0, 10) : period === 'weekly' ? mondayOf(dateStr) : dateStr.slice(0, 7);

    if (period === 'daily') {
      windowStart = new Date(now.getTime() - 29 * 86_400_000);
      keys = Array.from({ length: 30 }, (_, i) =>
        new Date(now.getTime() - (29 - i) * 86_400_000).toISOString().slice(0, 10),
      );
    } else if (period === 'weekly') {
      windowStart = new Date(now.getTime() - 11 * 7 * 86_400_000);
      keys = Array.from({ length: 12 }, (_, i) =>
        mondayOf(new Date(now.getTime() - (11 - i) * 7 * 86_400_000).toISOString().slice(0, 10)),
      );
    } else {
      windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
      keys = Array.from({ length: 6 }, (_, i) =>
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1)).toISOString().slice(0, 7),
      );
    }

    const from = windowStart.toISOString().slice(0, 10);
    const buckets = new Map<string, { income: number; expense: number }>();
    for (const k of keys) buckets.set(k, { income: 0, expense: 0 });

    const add = (dateStr: string, income: number, expense: number) => {
      const k = keyFor(dateStr);
      const b = buckets.get(k);
      if (b) { b.income += income; b.expense += expense; }
    };

    const txns = await this.transactions.filter(tenantId, { dateFrom: from, limit: 5000 });
    for (const t of txns) add(t.txnDate, t.direction === 'credit' ? t.amount : 0, t.direction === 'debit' ? t.amount : 0);
    const manual = await this.manualExpenses.listByTenant(tenantId);
    for (const m of manual) if (m.txnDate >= from) add(m.txnDate, 0, m.amount);
    const cash = await this.cashEntries.listByTenant(tenantId);
    for (const c of cash) if (c.entryDate >= from) add(c.entryDate, c.direction === 'inflow' ? c.amount : 0, c.direction === 'outflow' ? c.amount : 0);

    const points: CashFlowPoint[] = keys.map((k) => {
      const b = buckets.get(k)!;
      return { label: k, income: b.income, expense: b.expense, net: b.income - b.expense };
    });
    return { period, points };
  }

  async alerts(tenantId: string): Promise<{ alerts: DashboardAlert[] }> {
    const alerts: DashboardAlert[] = [];
    const openIssues = (await this.issues.listByTenant(tenantId)).filter((i) => i.status === 'open');

    const dupCount = openIssues.filter((i) => i.kind === 'possible_duplicate').length;
    if (dupCount > 0) alerts.push({ kind: 'duplicates', severity: 'warning', count: dupCount, message: `${dupCount} possible duplicate transaction${dupCount > 1 ? 's' : ''} to review.` });

    const parseCount = openIssues.filter((i) => i.kind === 'parse_fail' || i.kind === 'partial_parse').length;
    if (parseCount > 0) alerts.push({ kind: 'unparsed', severity: 'error', count: parseCount, message: `${parseCount} document${parseCount > 1 ? 's' : ''} failed or partially parsed.` });

    const flagged = (await this.transactions.listFlagged(tenantId)).length;
    if (flagged > 0) alerts.push({ kind: 'flagged', severity: 'warning', count: flagged, message: `${flagged} transaction${flagged > 1 ? 's need' : ' needs'} a category review.` });

    const { label } = monthRange();
    const slips = await this.salarySlips.listByTenant(tenantId);
    const hasSlip = slips.some((s) => s.periodStart.slice(0, 7) === label || s.periodEnd.slice(0, 7) === label);
    if (!hasSlip) alerts.push({ kind: 'missing_salary', severity: 'info', message: `No salary slip uploaded for ${label}.` });

    const ov = await this.overview(tenantId);
    if (ov.income > 0 && ov.expense > ov.income) {
      alerts.push({ kind: 'overspending', severity: 'warning', message: `You've spent more than you earned this month (burn rate ${ov.burnRate}%).` });
    }

    const order = { error: 0, warning: 1, info: 2 } as const;
    alerts.sort((a, b) => order[a.severity] - order[b.severity]);
    return { alerts };
  }
}
