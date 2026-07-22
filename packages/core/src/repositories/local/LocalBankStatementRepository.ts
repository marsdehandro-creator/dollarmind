/**
 * On-device (LocalDbDriver-backed) BankStatementRepository. Same SQL/shape as
 * SqliteBankStatementRepository.
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { BankStatement } from '../../models/index.js';
import type { BankStatementRepository } from '../BankStatementRepository.js';
import { rowToBankStatement, type Row } from '../rowMappers.js';

export class LocalBankStatementRepository implements BankStatementRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async create(statement: BankStatement): Promise<BankStatement> {
    await this.db.run(
      `INSERT INTO bank_statement (id, tenant_id, account_id, source_document_id, period_start,
         period_end, opening_balance, closing_balance, currency, created_at, updated_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ],
    );
    return statement;
  }

  async findById(id: string): Promise<BankStatement | null> {
    const rows = await this.db.query<Row>('SELECT * FROM bank_statement WHERE id = ?', [id]);
    return rows[0] ? rowToBankStatement(rows[0]) : null;
  }

  async listByTenant(tenantId: string): Promise<BankStatement[]> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM bank_statement WHERE tenant_id = ? AND archived_at IS NULL ORDER BY created_at DESC',
      [tenantId],
    );
    return rows.map(rowToBankStatement);
  }
}
