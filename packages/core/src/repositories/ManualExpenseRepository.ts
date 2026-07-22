/**
 * ManualExpenseRepository port. Manual expenses are always outflows (expenses).
 */
import type { ManualExpense } from '../models/index.js';
import type { CategoryAggregate, MonthCategoryTotal, MonthTotal } from './TransactionRepository.js';

export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

export interface ManualExpenseRepository {
  create(expense: ManualExpense): Promise<ManualExpense>;
  update(expense: ManualExpense): Promise<ManualExpense>;
  findById(id: string): Promise<ManualExpense | null>;
  /** Soft-delete (archive) — never hard-delete financial records. */
  softDelete(id: string): Promise<void>;
  listByTenant(tenantId: string): Promise<ManualExpense[]>;

  // Aggregates (feed spending summaries as expenses).
  sumByCategory(tenantId: string, range: DateRange): Promise<CategoryAggregate[]>;
  monthlyTotals(tenantId: string, range: DateRange): Promise<MonthTotal[]>;
  monthlyByCategory(tenantId: string, range: DateRange): Promise<MonthCategoryTotal[]>;
}
