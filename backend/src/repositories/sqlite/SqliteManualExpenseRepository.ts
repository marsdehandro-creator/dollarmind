/**
 * SQLite-backed ManualExpenseRepository. All amounts are expenses.
 */
import type { Db } from '../../db/connection.js';
import type { ManualExpense } from '@dollarmind/core/models/index.js';
import type { DateRange, ManualExpenseRepository } from '@dollarmind/core/repositories/ManualExpenseRepository.js';
import type { CategoryAggregate, MonthCategoryTotal, MonthTotal } from '@dollarmind/core/repositories/TransactionRepository.js';
import { nowIso } from '@dollarmind/core/utils/id.js';
import { rowToManualExpense, type Row } from '@dollarmind/core/repositories/rowMappers.js';

export class SqliteManualExpenseRepository implements ManualExpenseRepository {
  constructor(private readonly db: Db) {}

  async create(expense: ManualExpense): Promise<ManualExpense> {
    this.db
      .prepare(
        `INSERT INTO manual_expense (id, tenant_id, txn_date, amount, currency, category_id, note,
           reconciled_transaction_id, created_at, updated_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        expense.id,
        expense.tenantId,
        expense.txnDate,
        expense.amount,
        expense.currency,
        expense.categoryId,
        expense.note,
        expense.reconciledTransactionId,
        expense.createdAt,
        expense.updatedAt,
        expense.archivedAt,
      );
    return expense;
  }

  async update(expense: ManualExpense): Promise<ManualExpense> {
    this.db
      .prepare(
        `UPDATE manual_expense SET txn_date = ?, amount = ?, category_id = ?, note = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(expense.txnDate, expense.amount, expense.categoryId, expense.note, nowIso(), expense.id);
    return expense;
  }

  async findById(id: string): Promise<ManualExpense | null> {
    const row = this.db.prepare('SELECT * FROM manual_expense WHERE id = ?').get(id) as Row | undefined;
    return row ? rowToManualExpense(row) : null;
  }

  async softDelete(id: string): Promise<void> {
    this.db.prepare('UPDATE manual_expense SET archived_at = ?, updated_at = ? WHERE id = ?').run(nowIso(), nowIso(), id);
  }

  async listByTenant(tenantId: string): Promise<ManualExpense[]> {
    const rows = this.db
      .prepare('SELECT * FROM manual_expense WHERE tenant_id = ? AND archived_at IS NULL ORDER BY txn_date DESC, created_at DESC')
      .all(tenantId) as Row[];
    return rows.map(rowToManualExpense);
  }

  private range(range: DateRange): { clause: string; params: unknown[] } {
    const clauses = ['tenant_id = ?', 'archived_at IS NULL'];
    const params: unknown[] = [];
    if (range.dateFrom) {
      clauses.push('txn_date >= ?');
      params.push(range.dateFrom);
    }
    if (range.dateTo) {
      clauses.push('txn_date <= ?');
      params.push(range.dateTo);
    }
    return { clause: clauses.join(' AND '), params };
  }

  async sumByCategory(tenantId: string, range: DateRange): Promise<CategoryAggregate[]> {
    const { clause, params } = this.range(range);
    const rows = this.db
      .prepare(`SELECT category_id AS categoryId, SUM(amount) AS total, COUNT(*) AS count FROM manual_expense WHERE ${clause} GROUP BY category_id`)
      .all(tenantId, ...(params as never[])) as { categoryId: string | null; total: number; count: number }[];
    return rows.map((r) => ({ categoryId: r.categoryId ?? null, total: r.total, count: r.count }));
  }

  async monthlyTotals(tenantId: string, range: DateRange): Promise<MonthTotal[]> {
    const { clause, params } = this.range(range);
    return this.db
      .prepare(`SELECT substr(txn_date,1,7) AS month, SUM(amount) AS total FROM manual_expense WHERE ${clause} GROUP BY month ORDER BY month ASC`)
      .all(tenantId, ...(params as never[])) as MonthTotal[];
  }

  async monthlyByCategory(tenantId: string, range: DateRange): Promise<MonthCategoryTotal[]> {
    const { clause, params } = this.range(range);
    const rows = this.db
      .prepare(`SELECT substr(txn_date,1,7) AS month, category_id AS categoryId, SUM(amount) AS total FROM manual_expense WHERE ${clause} GROUP BY month, category_id ORDER BY month ASC`)
      .all(tenantId, ...(params as never[])) as { month: string; categoryId: string | null; total: number }[];
    return rows.map((r) => ({ month: r.month, categoryId: r.categoryId ?? null, total: r.total }));
  }
}
