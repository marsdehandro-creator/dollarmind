/**
 * On-device (LocalDbDriver-backed) CashEntryRepository. Same SQL/shape as
 * SqliteCashEntryRepository.
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { CashEntry } from '../../models/index.js';
import type { CashAggregateOptions, CashEntryRepository } from '../CashEntryRepository.js';
import type { CategoryAggregate, MonthCategoryTotal, MonthTotal } from '../TransactionRepository.js';
import { rowToCashEntry, type Row } from '../rowMappers.js';

export class LocalCashEntryRepository implements CashEntryRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async create(entry: CashEntry): Promise<CashEntry> {
    await this.db.run(
      `INSERT INTO cash_entry (id, tenant_id, entry_date, direction, amount, currency, category_id, note, created_at, updated_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.tenantId,
        entry.entryDate,
        entry.direction,
        entry.amount,
        entry.currency,
        entry.categoryId,
        entry.note,
        entry.createdAt,
        entry.updatedAt,
        entry.archivedAt,
      ],
    );
    return entry;
  }

  async listByTenant(tenantId: string): Promise<CashEntry[]> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM cash_entry WHERE tenant_id = ? AND archived_at IS NULL ORDER BY entry_date DESC, created_at DESC',
      [tenantId],
    );
    return rows.map(rowToCashEntry);
  }

  private range(opts: CashAggregateOptions): { clause: string; params: unknown[] } {
    const clauses = ['tenant_id = ?', 'archived_at IS NULL'];
    const params: unknown[] = [];
    if (opts.direction) {
      clauses.push('direction = ?');
      params.push(opts.direction);
    }
    if (opts.dateFrom) {
      clauses.push('entry_date >= ?');
      params.push(opts.dateFrom);
    }
    if (opts.dateTo) {
      clauses.push('entry_date <= ?');
      params.push(opts.dateTo);
    }
    return { clause: clauses.join(' AND '), params };
  }

  async sumByCategory(tenantId: string, opts: CashAggregateOptions): Promise<CategoryAggregate[]> {
    const { clause, params } = this.range(opts);
    const rows = await this.db.query<{ categoryId: string | null; total: number; count: number }>(
      `SELECT category_id AS categoryId, SUM(amount) AS total, COUNT(*) AS count FROM cash_entry WHERE ${clause} GROUP BY category_id`,
      [tenantId, ...params],
    );
    return rows.map((r) => ({ categoryId: r.categoryId ?? null, total: r.total, count: r.count }));
  }

  async monthlyTotals(tenantId: string, opts: CashAggregateOptions): Promise<MonthTotal[]> {
    const { clause, params } = this.range(opts);
    return this.db.query<MonthTotal>(
      `SELECT substr(entry_date,1,7) AS month, SUM(amount) AS total FROM cash_entry WHERE ${clause} GROUP BY month ORDER BY month ASC`,
      [tenantId, ...params],
    );
  }

  async monthlyByCategory(tenantId: string, opts: CashAggregateOptions): Promise<MonthCategoryTotal[]> {
    const { clause, params } = this.range(opts);
    const rows = await this.db.query<{ month: string; categoryId: string | null; total: number }>(
      `SELECT substr(entry_date,1,7) AS month, category_id AS categoryId, SUM(amount) AS total FROM cash_entry WHERE ${clause} GROUP BY month, category_id ORDER BY month ASC`,
      [tenantId, ...params],
    );
    return rows.map((r) => ({ month: r.month, categoryId: r.categoryId ?? null, total: r.total }));
  }
}
