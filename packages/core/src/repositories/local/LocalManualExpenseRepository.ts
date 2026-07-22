/**
 * On-device (LocalDbDriver-backed) ManualExpenseRepository. Same SQL/shape as
 * SqliteManualExpenseRepository.
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { ManualExpense } from '../../models/index.js';
import type { DateRange, ManualExpenseRepository } from '../ManualExpenseRepository.js';
import type { CategoryAggregate, MonthCategoryTotal, MonthTotal } from '../TransactionRepository.js';
import { nowIso } from '../../utils/id.js';
import { rowToManualExpense, type Row } from '../rowMappers.js';

export class LocalManualExpenseRepository implements ManualExpenseRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async create(expense: ManualExpense): Promise<ManualExpense> {
    await this.db.run(
      `INSERT INTO manual_expense (id, tenant_id, txn_date, amount, currency, category_id, note,
         reconciled_transaction_id, created_at, updated_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ],
    );
    return expense;
  }

  async update(expense: ManualExpense): Promise<ManualExpense> {
    await this.db.run(
      `UPDATE manual_expense SET txn_date = ?, amount = ?, category_id = ?, note = ?, updated_at = ?
       WHERE id = ?`,
      [expense.txnDate, expense.amount, expense.categoryId, expense.note, nowIso(), expense.id],
    );
    return expense;
  }

  async findById(id: string): Promise<ManualExpense | null> {
    const rows = await this.db.query<Row>('SELECT * FROM manual_expense WHERE id = ?', [id]);
    return rows[0] ? rowToManualExpense(rows[0]) : null;
  }

  async softDelete(id: string): Promise<void> {
    await this.db.run('UPDATE manual_expense SET archived_at = ?, updated_at = ? WHERE id = ?', [
      nowIso(),
      nowIso(),
      id,
    ]);
  }

  async listByTenant(tenantId: string): Promise<ManualExpense[]> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM manual_expense WHERE tenant_id = ? AND archived_at IS NULL ORDER BY txn_date DESC, created_at DESC',
      [tenantId],
    );
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
    const rows = await this.db.query<{ categoryId: string | null; total: number; count: number }>(
      `SELECT category_id AS categoryId, SUM(amount) AS total, COUNT(*) AS count FROM manual_expense WHERE ${clause} GROUP BY category_id`,
      [tenantId, ...params],
    );
    return rows.map((r) => ({ categoryId: r.categoryId ?? null, total: r.total, count: r.count }));
  }

  async monthlyTotals(tenantId: string, range: DateRange): Promise<MonthTotal[]> {
    const { clause, params } = this.range(range);
    return this.db.query<MonthTotal>(
      `SELECT substr(txn_date,1,7) AS month, SUM(amount) AS total FROM manual_expense WHERE ${clause} GROUP BY month ORDER BY month ASC`,
      [tenantId, ...params],
    );
  }

  async monthlyByCategory(tenantId: string, range: DateRange): Promise<MonthCategoryTotal[]> {
    const { clause, params } = this.range(range);
    const rows = await this.db.query<{ month: string; categoryId: string | null; total: number }>(
      `SELECT substr(txn_date,1,7) AS month, category_id AS categoryId, SUM(amount) AS total FROM manual_expense WHERE ${clause} GROUP BY month, category_id ORDER BY month ASC`,
      [tenantId, ...params],
    );
    return rows.map((r) => ({ month: r.month, categoryId: r.categoryId ?? null, total: r.total }));
  }
}
