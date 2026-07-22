/**
 * SQLite-backed AccountRepository (minimal).
 */
import type { Db } from '../../db/connection.js';
import type { Account } from '@dollarmind/core/models/index.js';
import type { AccountRepository } from '@dollarmind/core/repositories/AccountRepository.js';
import { newId, nowIso } from '@dollarmind/core/utils/id.js';
import { rowToAccount, type Row } from '@dollarmind/core/repositories/rowMappers.js';

export class SqliteAccountRepository implements AccountRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Account | null> {
    const row = this.db.prepare('SELECT * FROM account WHERE id = ?').get(id) as Row | undefined;
    return row ? rowToAccount(row) : null;
  }

  async getOrCreateIncomeSource(tenantId: string, name: string): Promise<Account> {
    return this.getOrCreate(tenantId, 'income_source', name);
  }

  async getOrCreateBankAccount(tenantId: string, name: string): Promise<Account> {
    return this.getOrCreate(tenantId, 'bank', name);
  }

  private getOrCreate(tenantId: string, kind: Account['kind'], name: string): Account {
    const existing = this.db
      .prepare('SELECT * FROM account WHERE tenant_id = ? AND kind = ? AND name = ?')
      .get(tenantId, kind, name) as Row | undefined;
    if (existing) return rowToAccount(existing);

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
    this.db
      .prepare(
        `INSERT INTO account (id, tenant_id, kind, name, institution, currency, created_at, updated_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        account.id,
        account.tenantId,
        account.kind,
        account.name,
        account.institution,
        account.currency,
        account.createdAt,
        account.updatedAt,
        account.archivedAt,
      );
    return account;
  }
}
