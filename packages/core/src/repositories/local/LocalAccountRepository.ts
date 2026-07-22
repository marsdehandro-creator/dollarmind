/**
 * On-device (LocalDbDriver-backed) AccountRepository. Same SQL/shape as
 * SqliteAccountRepository — only the driver call style differs (async
 * run/query vs. node:sqlite's sync prepare().run()/.get()).
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { Account } from '../../models/index.js';
import type { AccountRepository } from '../AccountRepository.js';
import { newId, nowIso } from '../../utils/id.js';
import { rowToAccount, type Row } from '../rowMappers.js';

export class LocalAccountRepository implements AccountRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async findById(id: string): Promise<Account | null> {
    const rows = await this.db.query<Row>('SELECT * FROM account WHERE id = ?', [id]);
    return rows[0] ? rowToAccount(rows[0]) : null;
  }

  async getOrCreateIncomeSource(tenantId: string, name: string): Promise<Account> {
    return this.getOrCreate(tenantId, 'income_source', name);
  }

  async getOrCreateBankAccount(tenantId: string, name: string): Promise<Account> {
    return this.getOrCreate(tenantId, 'bank', name);
  }

  private async getOrCreate(tenantId: string, kind: Account['kind'], name: string): Promise<Account> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM account WHERE tenant_id = ? AND kind = ? AND name = ?',
      [tenantId, kind, name],
    );
    if (rows[0]) return rowToAccount(rows[0]);

    const now = nowIso();
    const account: Account = {
      id: newId(),
      tenantId,
      kind,
      name,
      institution: null,
      currency: 'ZAR',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await this.db.run(
      `INSERT INTO account (id, tenant_id, kind, name, institution, currency, created_at, updated_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.tenantId,
        account.kind,
        account.name,
        account.institution,
        account.currency,
        account.createdAt,
        account.updatedAt,
        account.archivedAt,
      ],
    );
    return account;
  }
}
