/**
 * LocalDashboardAggregationService — unified, range-driven dashboard computed
 * straight from the DB (Phase 18). Resilient: partial data → partial dashboard.
 */
import type {
  DashboardAggregationService,
  DashboardCashflow,
  DashboardCashflowPoint,
  DashboardPayload,
} from './interfaces/DashboardAggregationService.js';
import type { CategorySpend, SpendingSummaryService } from './interfaces/SpendingSummaryService.js';
import type { DashboardService } from './interfaces/DashboardService.js';
import type { SalarySlipRepository } from '../repositories/SalarySlipRepository.js';
import type { TransactionRepository } from '../repositories/TransactionRepository.js';
import type { ManualExpenseRepository } from '../repositories/ManualExpenseRepository.js';
import type { CashEntryRepository } from '../repositories/CashEntryRepository.js';

const MS_PER_DAY = 86_400_000;

function inRange(date: string | null | undefined, from: string, to: string): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= from && d <= to;
}

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export class LocalDashboardAggregationService implements DashboardAggregationService {
  constructor(
    private readonly summary: SpendingSummaryService,
    private readonly dashboard: DashboardService, // for alerts
    private readonly salarySlips: SalarySlipRepository,
    private readonly transactions: TransactionRepository,
    private readonly manualExpenses: ManualExpenseRepository,
    private readonly cashEntries: CashEntryRepository,
  ) {}

  async getIncome(tenantId: string, from: string, to: string): Promise<number> {
    const slips = await this.salarySlips.listByTenant(tenantId);
    const salaryNet = slips
      .filter((s) => inRange(s.payDate ?? s.periodEnd ?? s.periodStart, from, to))
      .reduce((sum, s) => sum + s.netAmount, 0);
    const cash = await this.cashEntries.listByTenant(tenantId);
    const cashIn = cash
      .filter((c) => c.direction === 'inflow' && inRange(c.entryDate, from, to))
      .reduce((sum, c) => sum + c.amount, 0);
    return salaryNet + cashIn;
  }

  async getExpenses(tenantId: string, from: string, to: string): Promise<number> {
    return (await this.summary.monthlySummary(tenantId, from, to)).expense;
  }

  async getCategoryTotals(tenantId: string, from: string, to: string): Promise<CategorySpend[]> {
    return (await this.summary.monthlySummary(tenantId, from, to)).byCategory;
  }

  async getNetPosition(tenantId: string, from: string, to: string): Promise<number> {
    return (await this.getIncome(tenantId, from, to)) - (await this.getExpenses(tenantId, from, to));
  }

  async getSavingsRate(tenantId: string, from: string, to: string): Promise<number> {
    const income = await this.getIncome(tenantId, from, to);
    if (income <= 0) return 0;
    const net = income - (await this.getExpenses(tenantId, from, to));
    return Math.round((net / income) * 100);
  }

  async getBurnRate(tenantId: string, from: string, to: string): Promise<number> {
    const income = await this.getIncome(tenantId, from, to);
    if (income <= 0) return 0;
    return Math.round(((await this.getExpenses(tenantId, from, to)) / income) * 100);
  }

  async getCashflow(tenantId: string, from: string, to: string): Promise<DashboardCashflow> {
    const spanDays = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / MS_PER_DAY) + 1);
    const granularity: DashboardCashflow['granularity'] = spanDays <= 45 ? 'daily' : spanDays <= 180 ? 'weekly' : 'monthly';
    const keyFor = (d: string): string =>
      granularity === 'daily' ? d.slice(0, 10) : granularity === 'weekly' ? mondayOf(d) : d.slice(0, 7);

    const keys = this.generateKeys(from, to, granularity);
    const buckets = new Map<string, { income: number; expense: number }>();
    for (const k of keys) buckets.set(k, { income: 0, expense: 0 });
    const add = (date: string, income: number, expense: number) => {
      const b = buckets.get(keyFor(date));
      if (b) { b.income += income; b.expense += expense; }
    };

    // Bank credits are not counted as income here (income = salary + cash inflows).
    const txns = await this.transactions.filter(tenantId, { dateFrom: from, dateTo: to, limit: 100_000 });
    for (const t of txns) add(t.txnDate, 0, t.direction === 'debit' ? t.amount : 0);
    const manual = await this.manualExpenses.listByTenant(tenantId);
    for (const m of manual) if (inRange(m.txnDate, from, to)) add(m.txnDate, 0, m.amount);
    const cash = await this.cashEntries.listByTenant(tenantId);
    for (const c of cash) if (inRange(c.entryDate, from, to)) add(c.entryDate, c.direction === 'inflow' ? c.amount : 0, c.direction === 'outflow' ? c.amount : 0);
    const slips = await this.salarySlips.listByTenant(tenantId);
    for (const s of slips) {
      const d = s.payDate ?? s.periodEnd ?? s.periodStart;
      if (inRange(d, from, to)) add(d, s.netAmount, 0);
    }

    const points: DashboardCashflowPoint[] = keys.map((k) => {
      const b = buckets.get(k)!;
      return { label: k, income: b.income, expense: b.expense, net: b.income - b.expense };
    });
    return { granularity, points };
  }

  private generateKeys(from: string, to: string, granularity: DashboardCashflow['granularity']): string[] {
    const keys: string[] = [];
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    if (granularity === 'monthly') {
      const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      while (cur <= end) { keys.push(cur.toISOString().slice(0, 7)); cur.setUTCMonth(cur.getUTCMonth() + 1); }
    } else if (granularity === 'weekly') {
      const cur = new Date(`${mondayOf(from)}T00:00:00Z`);
      while (cur <= end) { keys.push(cur.toISOString().slice(0, 10)); cur.setUTCDate(cur.getUTCDate() + 7); }
    } else {
      const cur = new Date(start);
      while (cur <= end) { keys.push(cur.toISOString().slice(0, 10)); cur.setUTCDate(cur.getUTCDate() + 1); }
    }
    return keys;
  }

  async getDashboard(tenantId: string, from: string, to: string): Promise<DashboardPayload> {
    const income = await this.getIncome(tenantId, from, to);
    const s = await this.summary.monthlySummary(tenantId, from, to);
    const expense = s.expense;
    const net = income - expense;
    const savingsRate = income > 0 ? Math.round((net / income) * 100) : 0;
    const burnRate = income > 0 ? Math.round((expense / income) * 100) : 0;
    const cashflow = await this.getCashflow(tenantId, from, to);
    const alerts = (await this.dashboard.alerts(tenantId)).alerts;
    const hasData = income > 0 || expense > 0 || s.byCategory.length > 0 || cashflow.points.some((p) => p.income > 0 || p.expense > 0);

    return {
      range: { from, to },
      hasData,
      income,
      expense,
      net,
      savingsRate,
      burnRate,
      categories: s.byCategory,
      cashflow,
      alerts,
    };
  }
}
