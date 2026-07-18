/**
 * SQLite-backed MerchantRuleRepository.
 */
import type { Db } from '../../db/connection.js';
import type { MerchantRule } from '../../models/index.js';
import type { MerchantRuleRepository } from '../MerchantRuleRepository.js';
import { rowToMerchantRule, type Row } from './rowMappers.js';

export class SqliteMerchantRuleRepository implements MerchantRuleRepository {
  constructor(private readonly db: Db) {}

  async find(tenantId: string, merchant: string): Promise<MerchantRule | null> {
    const row = this.db
      .prepare('SELECT * FROM merchant_rule WHERE tenant_id = ? AND merchant = ?')
      .get(tenantId, merchant.toLowerCase()) as Row | undefined;
    return row ? rowToMerchantRule(row) : null;
  }

  async listByTenant(tenantId: string): Promise<MerchantRule[]> {
    const rows = this.db.prepare('SELECT * FROM merchant_rule WHERE tenant_id = ?').all(tenantId) as Row[];
    return rows.map(rowToMerchantRule);
  }

  async upsert(rule: MerchantRule): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO merchant_rule (tenant_id, merchant, category, source, confidence, last_updated)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, merchant) DO UPDATE SET
           category = excluded.category,
           source = excluded.source,
           confidence = excluded.confidence,
           last_updated = excluded.last_updated`,
      )
      .run(rule.tenantId, rule.merchant.toLowerCase(), rule.category, rule.source, rule.confidence, rule.lastUpdated);
  }

  async count(tenantId: string): Promise<number> {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM merchant_rule WHERE tenant_id = ?').get(tenantId) as { n: number };
    return row.n;
  }
}
