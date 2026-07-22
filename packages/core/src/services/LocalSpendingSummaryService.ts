/**
 * LocalSpendingSummaryService — monthly totals, category totals, averages, and
 * month-over-month trends (docs/requirements.md F5).
 *
 * Sources merged (Phase 10):
 *   - transactions:      debit = expense, credit = income
 *   - manual expenses:   always expense
 *   - cash entries:      outflow = expense, inflow = income
 */
import type {
  CategorySpend,
  CategoryTrend,
  SpendingSummary,
  SpendingSummaryService,
  SpendingTrends,
} from './interfaces/SpendingSummaryService.js';
import type {
  CategoryAggregate,
  MonthCategoryTotal,
  MonthTotal,
  TransactionRepository,
} from '../repositories/TransactionRepository.js';
import type { CategoryRepository } from '../repositories/CategoryRepository.js';
import type { ManualExpenseRepository } from '../repositories/ManualExpenseRepository.js';
import type { CashEntryRepository } from '../repositories/CashEntryRepository.js';

const TOP_CATEGORIES = 5;

/** Merge category aggregates by categoryId (summing totals + counts). */
function mergeByCategory(groups: CategoryAggregate[][]): CategoryAggregate[] {
  const map = new Map<string | null, CategoryAggregate>();
  for (const group of groups) {
    for (const a of group) {
      const cur = map.get(a.categoryId) ?? { categoryId: a.categoryId, total: 0, count: 0 };
      cur.total += a.total;
      cur.count += a.count;
      map.set(a.categoryId, cur);
    }
  }
  return [...map.values()];
}

/** Merge month totals by month. */
function mergeByMonth(groups: MonthTotal[][]): Map<string, number> {
  const map = new Map<string, number>();
  for (const group of groups) {
    for (const m of group) map.set(m.month, (map.get(m.month) ?? 0) + m.total);
  }
  return map;
}

/** Merge (month, category) totals. */
function mergeByMonthCategory(groups: MonthCategoryTotal[][]): MonthCategoryTotal[] {
  const map = new Map<string, MonthCategoryTotal>();
  for (const group of groups) {
    for (const r of group) {
      const key = `${r.month}|${r.categoryId ?? ''}`;
      const cur = map.get(key) ?? { month: r.month, categoryId: r.categoryId, total: 0 };
      cur.total += r.total;
      map.set(key, cur);
    }
  }
  return [...map.values()];
}

export class LocalSpendingSummaryService implements SpendingSummaryService {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly categories: CategoryRepository,
    private readonly manualExpenses: ManualExpenseRepository,
    private readonly cashEntries: CashEntryRepository,
  ) {}

  private async categoryNameMap(tenantId: string): Promise<Map<string, string>> {
    const cats = await this.categories.listByTenant(tenantId);
    return new Map(cats.map((c) => [c.id, c.name]));
  }

  private nameFor(names: Map<string, string>, id: string | null): string {
    return id ? names.get(id) ?? 'Unknown' : 'Uncategorized';
  }

  async monthlySummary(tenantId: string, dateFrom?: string, dateTo?: string): Promise<SpendingSummary> {
    const names = await this.categoryNameMap(tenantId);
    const range = { dateFrom, dateTo };

    // Expenses: transaction debits + manual expenses + cash outflows.
    const expenseByCat = mergeByCategory([
      await this.transactions.sumByCategory(tenantId, { direction: 'debit', dateFrom, dateTo }),
      await this.manualExpenses.sumByCategory(tenantId, range),
      await this.cashEntries.sumByCategory(tenantId, { direction: 'outflow', dateFrom, dateTo }),
    ]);
    const byCategory: CategorySpend[] = expenseByCat
      .map((a) => ({
        categoryId: a.categoryId,
        categoryName: this.nameFor(names, a.categoryId),
        total: a.total,
        count: a.count,
      }))
      .sort((a, b) => b.total - a.total);
    const expense = byCategory.reduce((sum, c) => sum + c.total, 0);

    // Income: transaction credits + cash inflows.
    const incomeMonths = mergeByMonth([
      await this.transactions.monthlyTotals(tenantId, { direction: 'credit', dateFrom, dateTo }),
      await this.cashEntries.monthlyTotals(tenantId, { direction: 'inflow', dateFrom, dateTo }),
    ]);
    const income = [...incomeMonths.values()].reduce((sum, v) => sum + v, 0);

    // Average monthly expense over distinct expense months across all sources.
    const expenseMonths = mergeByMonth([
      await this.transactions.monthlyTotals(tenantId, { direction: 'debit', dateFrom, dateTo }),
      await this.manualExpenses.monthlyTotals(tenantId, range),
      await this.cashEntries.monthlyTotals(tenantId, { direction: 'outflow', dateFrom, dateTo }),
    ]);
    const monthCount = Math.max(expenseMonths.size, 1);
    const averageMonthlyExpense = Math.round(expense / monthCount);

    return {
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      income,
      expense,
      net: income - expense,
      averageMonthlyExpense,
      byCategory,
    };
  }

  async trends(tenantId: string, months = 6): Promise<SpendingTrends> {
    const names = await this.categoryNameMap(tenantId);

    const expenseMonthMap = mergeByMonth([
      await this.transactions.monthlyTotals(tenantId, { direction: 'debit' }),
      await this.manualExpenses.monthlyTotals(tenantId, {}),
      await this.cashEntries.monthlyTotals(tenantId, { direction: 'outflow' }),
    ]);
    const incomeMonthMap = mergeByMonth([
      await this.transactions.monthlyTotals(tenantId, { direction: 'credit' }),
      await this.cashEntries.monthlyTotals(tenantId, { direction: 'inflow' }),
    ]);

    const allMonths = Array.from(new Set([...expenseMonthMap.keys(), ...incomeMonthMap.keys()])).sort();
    const window = allMonths.slice(-months);
    const monthIndex = new Map(window.map((m, i) => [m, i]));

    const expenseByMonth = new Array(window.length).fill(0);
    for (const [month, total] of expenseMonthMap) {
      const i = monthIndex.get(month);
      if (i !== undefined) expenseByMonth[i] = total;
    }
    const incomeByMonth = new Array(window.length).fill(0);
    for (const [month, total] of incomeMonthMap) {
      const i = monthIndex.get(month);
      if (i !== undefined) incomeByMonth[i] = total;
    }

    // Per-category monthly expense across all sources, top N categories.
    const byCatMonth = mergeByMonthCategory([
      await this.transactions.monthlyByCategory(tenantId, { direction: 'debit' }),
      await this.manualExpenses.monthlyByCategory(tenantId, {}),
      await this.cashEntries.monthlyByCategory(tenantId, { direction: 'outflow' }),
    ]);
    const totalsByCat = new Map<string | null, number>();
    for (const row of byCatMonth) {
      if (!monthIndex.has(row.month)) continue;
      totalsByCat.set(row.categoryId, (totalsByCat.get(row.categoryId) ?? 0) + row.total);
    }
    const topCatIds = [...totalsByCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_CATEGORIES)
      .map(([id]) => id);

    const categories: CategoryTrend[] = topCatIds.map((catId) => {
      const totals = new Array(window.length).fill(0);
      for (const row of byCatMonth) {
        if (row.categoryId !== catId) continue;
        const i = monthIndex.get(row.month);
        if (i !== undefined) totals[i] += row.total;
      }
      return { categoryId: catId, categoryName: this.nameFor(names, catId), totals };
    });

    return { months: window, expenseByMonth, incomeByMonth, categories };
  }
}
