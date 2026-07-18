/**
 * CashEntryRepository port. Cash entries have a direction: inflow (income) or
 * outflow (expense).
 */
import type { CashEntry } from '../models/index.js';
import type { CategoryAggregate, MonthCategoryTotal, MonthTotal } from './TransactionRepository.js';
import type { DateRange } from './ManualExpenseRepository.js';

export interface CashAggregateOptions extends DateRange {
  direction?: 'inflow' | 'outflow';
}

export interface CashEntryRepository {
  create(entry: CashEntry): Promise<CashEntry>;
  listByTenant(tenantId: string): Promise<CashEntry[]>;

  sumByCategory(tenantId: string, opts: CashAggregateOptions): Promise<CategoryAggregate[]>;
  monthlyTotals(tenantId: string, opts: CashAggregateOptions): Promise<MonthTotal[]>;
  monthlyByCategory(tenantId: string, opts: CashAggregateOptions): Promise<MonthCategoryTotal[]>;
}
