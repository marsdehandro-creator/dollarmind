/**
 * On-device (LocalDbDriver-backed) MerchantRuleRepository. Same SQL/shape as
 * SqliteMerchantRuleRepository.
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { MerchantRule } from '../../models/index.js';
import type { MerchantRuleRepository } from '../MerchantRuleRepository.js';
import { rowToMerchantRule, type Row } from '../rowMappers.js';

export class LocalMerchantRuleRepository implements MerchantRuleRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async find(tenantId: string, merchant: string): Promise<MerchantRule | null> {
    const rows = await this.db.query<Row>('SELECT * FROM merchant_rule WHERE tenant_id = ? AND merchant = ?', [
      tenantId,
      merchant.toLowerCase(),
    ]);
    return rows[0] ? rowToMerchantRule(rows[0]) : null;
  }

  async listByTenant(tenantId: string): Promise<MerchantRule[]> {
    const rows = await this.db.query<Row>('SELECT * FROM merchant_rule WHERE tenant_id = ?', [tenantId]);
    return rows.map(rowToMerchantRule);
  }

  async upsert(rule: MerchantRule): Promise<void> {
    await this.db.run(
      `INSERT INTO merchant_rule (tenant_id, merchant, category, source, confidence, last_updated)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, merchant) DO UPDATE SET
         category = excluded.category,
         source = excluded.source,
         confidence = excluded.confidence,
         last_updated = excluded.last_updated`,
      [rule.tenantId, rule.merchant.toLowerCase(), rule.category, rule.source, rule.confidence, rule.lastUpdated],
    );
  }

  async count(tenantId: string): Promise<number> {
    const rows = await this.db.query<{ n: number }>('SELECT COUNT(*) AS n FROM merchant_rule WHERE tenant_id = ?', [
      tenantId,
    ]);
    return rows[0].n;
  }
}
