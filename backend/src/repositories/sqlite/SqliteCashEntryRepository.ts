/**
 * SQLite-backed CashEntryRepository.
 */
import type { Db } from '../../db/connection.js';
import type { CashEntry } from '@dollarmind/core/models/index.js';
import type { CashAggregateOptions, CashEntryRepository } from '@dollarmind/core/repositories/CashEntryRepository.js';
import type { CategoryAggregate, MonthCategoryTotal, MonthTotal } from '@dollarmind/core/repositories/TransactionRepository.js';
import { rowToCashEntry, type Row } from '@dollarmind/core/repositories/rowMappers.js';

export class SqliteCashEntryRepository implements CashEntryRepository {
  constructor(private readonly db: Db) {}

  async create(entry: CashEntry): Promise<CashEntry> {
    this.db
      .prepare(
        `INSERT INTO cash_entry (id, tenant_id, entry_date, direction, amount, currency, category_id, note, created_at, updated_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
      );
    return entry;
  }

  async listByTenant(tenantId: string): Promise<CashEntry[]> {
    const rows = this.db
      .prepare('SELECT * FROM cash_entry WHERE tenant_id = ? AND archived_at IS NULL ORDER BY entry_date DESC, created_at DESC')
      .all(tenantId) as Row[];
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
    const rows = this.db
      .prepare(`SELECT category_id AS categoryId, SUM(amount) AS total, COUNT(*) AS count FROM cash_entry WHERE ${clause} GROUP BY category_id`)
      .all(tenantId, ...(params as never[])) as { categoryId: string | null; total: number; count: number }[];
    return rows.map((r) => ({ categoryId: r.categoryId ?? null, total: r.total, count: r.count }));
  }

  async monthlyTotals(tenantId: string, opts: CashAggregateOptions): Promise<MonthTotal[]> {
    const { clause, params } = this.range(opts);
    return this.db
      .prepare(`SELECT substr(entry_date,1,7) AS month, SUM(amount) AS total FROM cash_entry WHERE ${clause} GROUP BY month ORDER BY month ASC`)
      .all(tenantId, ...(params as never[])) as MonthTotal[];
  }

  async monthlyByCategory(tenantId: string, opts: CashAggregateOptions): Promise<MonthCategoryTotal[]> {
    const { clause, params } = this.range(opts);
    const rows = this.db
      .prepare(`SELECT substr(entry_date,1,7) AS month, category_id AS categoryId, SUM(amount) AS total FROM cash_entry WHERE ${clause} GROUP BY month, category_id ORDER BY month ASC`)
      .all(tenantId, ...(params as never[])) as { month: string; categoryId: string | null; total: number }[];
    return rows.map((r) => ({ month: r.month, categoryId: r.categoryId ?? null, total: r.total }));
  }
}
