/**
 * MerchantRuleRepository port — dedicated merchant → category store
 * (docs Phase 16 §6). System rules are seeded; user overrides upsert here.
 */
import type { MerchantRule } from '../models/index.js';

export interface MerchantRuleRepository {
  find(tenantId: string, merchant: string): Promise<MerchantRule | null>;
  listByTenant(tenantId: string): Promise<MerchantRule[]>;
  /** Insert or replace the rule for (tenant, merchant). */
  upsert(rule: MerchantRule): Promise<void>;
  count(tenantId: string): Promise<number>;
}
