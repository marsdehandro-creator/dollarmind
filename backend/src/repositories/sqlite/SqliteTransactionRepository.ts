/**
 * SQLite-backed TransactionRepository. All queries are parameterized
 * (docs/security.md §4.1).
 */
import type { Db } from '../../db/connection.js';
import type { Transaction } from '../../models/index.js';
import type {
  AggregateOptions,
  CategoryAggregate,
  MonthCategoryTotal,
  MonthTotal,
  TransactionFilterCriteria,
  TransactionRepository,
} from '../TransactionRepository.js';
import { nowIso } from '../../utils/id.js';
import { rowToTransaction, type Row } from './rowMappers.js';

export class SqliteTransactionRepository implements TransactionRepository {
  constructor(private readonly db: Db) {}

  async create(txn: Transaction): Promise<Transaction> {
    this.db
      .prepare(
        `INSERT INTO "transaction" (id, tenant_id, account_id, bank_statement_id, source_document_id,
           source_row, txn_date, description_raw, description_norm, amount, direction, balance_after,
           currency, category_id, category_source, merchant, confidence, flagged, dedup_group_id, dedup_hash,
           reconciled_expense_id, created_at, updated_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        txn.id,
        txn.tenantId,
        txn.accountId,
        txn.bankStatementId,
        txn.sourceDocumentId,
        txn.sourceRow,
        txn.txnDate,
        txn.descriptionRaw,
        txn.descriptionNorm,
        txn.amount,
        txn.direction,
        txn.balanceAfter,
        txn.currency,
        txn.categoryId,
        txn.categorySource,
        txn.merchant,
        txn.confidence,
        txn.flagged ? 1 : 0,
        txn.dedupGroupId,
        txn.dedupHash,
        txn.reconciledExpenseId,
        txn.createdAt,
        txn.updatedAt,
        txn.archivedAt,
      );
    return txn;
  }

  async findById(id: string): Promise<Transaction | null> {
    const row = this.db.prepare('SELECT * FROM "transaction" WHERE id = ?').get(id) as Row | undefined;
    return row ? rowToTransaction(row) : null;
  }

  async listByAccount(tenantId: string, accountId: string): Promise<Transaction[]> {
    const rows = this.db
      .prepare(
        'SELECT * FROM "transaction" WHERE tenant_id = ? AND account_id = ? AND archived_at IS NULL',
      )
      .all(tenantId, accountId) as Row[];
    return rows.map(rowToTransaction);
  }

  async listByTenant(tenantId: string, limit = 500, offset = 0): Promise<Transaction[]> {
    const rows = this.db
      .prepare(
        'SELECT * FROM "transaction" WHERE tenant_id = ? AND archived_at IS NULL ORDER BY txn_date DESC, created_at DESC LIMIT ? OFFSET ?',
      )
      .all(tenantId, limit, offset) as Row[];
    return rows.map(rowToTransaction);
  }

  async filter(tenantId: string, criteria: TransactionFilterCriteria): Promise<Transaction[]> {
    const clauses: string[] = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];

    if (!criteria.includeArchived) clauses.push('archived_at IS NULL');
    if (criteria.accountId) {
      clauses.push('account_id = ?');
      params.push(criteria.accountId);
    }
    if (criteria.dateFrom) {
      clauses.push('txn_date >= ?');
      params.push(criteria.dateFrom);
    }
    if (criteria.dateTo) {
      clauses.push('txn_date <= ?');
      params.push(criteria.dateTo);
    }
    if (criteria.merchant) {
      clauses.push('description_norm LIKE ?');
      params.push(`%${criteria.merchant.toLowerCase()}%`);
    }
    if (typeof criteria.amountMin === 'number') {
      clauses.push('amount >= ?');
      params.push(criteria.amountMin);
    }
    if (typeof criteria.amountMax === 'number') {
      clauses.push('amount <= ?');
      params.push(criteria.amountMax);
    }
    if (criteria.direction) {
      clauses.push('direction = ?');
      params.push(criteria.direction);
    }
    if (criteria.categoryId) {
      clauses.push('category_id = ?');
      params.push(criteria.categoryId);
    }

    const limit = criteria.limit ?? 500;
    const offset = criteria.offset ?? 0;
    params.push(limit, offset);

    const sql = `SELECT * FROM "transaction" WHERE ${clauses.join(' AND ')} ORDER BY txn_date DESC, created_at DESC LIMIT ? OFFSET ?`;
    const rows = this.db.prepare(sql).all(...(params as never[])) as Row[];
    return rows.map(rowToTransaction);
  }

  async listUncategorized(tenantId: string): Promise<Transaction[]> {
    const rows = this.db
      .prepare('SELECT * FROM "transaction" WHERE tenant_id = ? AND category_id IS NULL AND archived_at IS NULL')
      .all(tenantId) as Row[];
    return rows.map(rowToTransaction);
  }

  async listFlagged(tenantId: string): Promise<Transaction[]> {
    const rows = this.db
      .prepare('SELECT * FROM "transaction" WHERE tenant_id = ? AND flagged = 1 AND archived_at IS NULL')
      .all(tenantId) as Row[];
    return rows.map(rowToTransaction);
  }

  async listByStatement(statementId: string): Promise<Transaction[]> {
    const rows = this.db
      .prepare('SELECT * FROM "transaction" WHERE bank_statement_id = ? AND archived_at IS NULL ORDER BY txn_date ASC, source_row ASC')
      .all(statementId) as Row[];
    return rows.map(rowToTransaction);
  }

  async setDedupGroup(id: string, dedupGroupId: string): Promise<void> {
    this.db
      .prepare('UPDATE "transaction" SET dedup_group_id = ?, updated_at = ? WHERE id = ?')
      .run(dedupGroupId, nowIso(), id);
  }

  async updateCategory(
    id: string,
    categoryId: string,
    source: Transaction['categorySource'],
    flagged = false,
    confidence = 1,
  ): Promise<void> {
    this.db
      .prepare('UPDATE "transaction" SET category_id = ?, category_source = ?, flagged = ?, confidence = ?, updated_at = ? WHERE id = ?')
      .run(categoryId, source, flagged ? 1 : 0, confidence, nowIso(), id);
  }

  async countByStatement(statementId: string): Promise<number> {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM "transaction" WHERE bank_statement_id = ?')
      .get(statementId) as { n: number };
    return row.n;
  }

  private rangeClause(opts: AggregateOptions): { clause: string; params: unknown[] } {
    const clauses: string[] = ['tenant_id = ?', 'archived_at IS NULL'];
    const params: unknown[] = [];
    // tenant_id param is prepended by the caller.
    if (opts.direction) {
      clauses.push('direction = ?');
      params.push(opts.direction);
    }
    if (opts.dateFrom) {
      clauses.push('txn_date >= ?');
      params.push(opts.dateFrom);
    }
    if (opts.dateTo) {
      clauses.push('txn_date <= ?');
      params.push(opts.dateTo);
    }
    return { clause: clauses.join(' AND '), params };
  }

  async sumByCategory(tenantId: string, opts: AggregateOptions): Promise<CategoryAggregate[]> {
    const { clause, params } = this.rangeClause(opts);
    const sql = `SELECT category_id AS categoryId, SUM(amount) AS total, COUNT(*) AS count
                 FROM "transaction" WHERE ${clause} GROUP BY category_id`;
    const rows = this.db.prepare(sql).all(tenantId, ...(params as never[])) as {
      categoryId: string | null;
      total: number;
      count: number;
    }[];
    return rows.map((r) => ({ categoryId: r.categoryId ?? null, total: r.total, count: r.count }));
  }

  async monthlyTotals(tenantId: string, opts: AggregateOptions): Promise<MonthTotal[]> {
    const { clause, params } = this.rangeClause(opts);
    const sql = `SELECT substr(txn_date, 1, 7) AS month, SUM(amount) AS total
                 FROM "transaction" WHERE ${clause} GROUP BY month ORDER BY month ASC`;
    const rows = this.db.prepare(sql).all(tenantId, ...(params as never[])) as MonthTotal[];
    return rows;
  }

  async monthlyByCategory(tenantId: string, opts: AggregateOptions): Promise<MonthCategoryTotal[]> {
    const { clause, params } = this.rangeClause(opts);
    const sql = `SELECT substr(txn_date, 1, 7) AS month, category_id AS categoryId, SUM(amount) AS total
                 FROM "transaction" WHERE ${clause} GROUP BY month, category_id ORDER BY month ASC`;
    const rows = this.db.prepare(sql).all(tenantId, ...(params as never[])) as {
      month: string;
      categoryId: string | null;
      total: number;
    }[];
    return rows.map((r) => ({ month: r.month, categoryId: r.categoryId ?? null, total: r.total }));
  }
}
