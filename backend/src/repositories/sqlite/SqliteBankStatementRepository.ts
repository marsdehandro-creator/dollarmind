/**
 * SQLite-backed BankStatementRepository.
 */
import type { Db } from '../../db/connection.js';
import type { BankStatement } from '@dollarmind/core/models/index.js';
import type { BankStatementRepository } from '@dollarmind/core/repositories/BankStatementRepository.js';
import { rowToBankStatement, type Row } from '@dollarmind/core/repositories/rowMappers.js';

export class SqliteBankStatementRepository implements BankStatementRepository {
  constructor(private readonly db: Db) {}

  async create(statement: BankStatement): Promise<BankStatement> {
    this.db
      .prepare(
        `INSERT INTO bank_statement (id, tenant_id, account_id, source_document_id, period_start,
           period_end, opening_balance, closing_balance, currency, created_at, updated_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        statement.id,
        statement.tenantId,
        statement.accountId,
        statement.sourceDocumentId,
        statement.periodStart,
        statement.periodEnd,
        statement.openingBalance,
        statement.closingBalance,
        statement.currency,
        statement.createdAt,
        statement.updatedAt,
        statement.archivedAt,
      );
    return statement;
  }

  async findById(id: string): Promise<BankStatement | null> {
    const row = this.db.prepare('SELECT * FROM bank_statement WHERE id = ?').get(id) as Row | undefined;
    return row ? rowToBankStatement(row) : null;
  }

  async listByTenant(tenantId: string): Promise<BankStatement[]> {
    const rows = this.db
      .prepare('SELECT * FROM bank_statement WHERE tenant_id = ? AND archived_at IS NULL ORDER BY created_at DESC')
      .all(tenantId) as Row[];
    return rows.map(rowToBankStatement);
  }
}
