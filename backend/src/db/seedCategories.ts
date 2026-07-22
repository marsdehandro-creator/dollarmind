/**
 * Seed system categories + starter categorization rules for a tenant.
 *
 * Idempotent: categories are ensured by name; rules are seeded only on first
 * run (when the tenant has no rules yet). Sources:
 *   - config/category-rules.json  (categories + contains/regex rules)
 *   - config/merchant-rules.json  (merchant keyword rules)
 */
import type { Db } from './connection.js';
import { loadCategoryRules, loadMerchantRules } from '../config/index.js';
import { newId, nowIso } from '@dollarmind/core/utils/id.js';

interface CategoryRulesConfig {
  categories: string[];
  rules: Array<{ matchType: string; pattern: string; category: string; priority?: number }>;
}
interface MerchantRulesConfig {
  merchants: Array<{ merchant: string; category: string; keywords: string[] }>;
}

/** Categories used by the semantic fallback layer (Phase 16). */
const EXTRA_CATEGORIES = ['Financial Services', 'Retail', 'E-commerce', 'Clothing', 'Miscellaneous'];

export function seedCategories(db: Db, tenantId: string): void {
  const catConfig = loadCategoryRules() as CategoryRulesConfig;
  const merchantConfig = loadMerchantRules() as MerchantRulesConfig;

  const now = nowIso();
  const names = new Set<string>([
    ...catConfig.categories,
    ...merchantConfig.merchants.map((m) => m.category),
    ...EXTRA_CATEGORIES,
    'Uncategorized',
  ]);

  // Ensure each category exists (by name); build a name -> id map.
  const nameToId = new Map<string, string>();
  const findStmt = db.prepare('SELECT id FROM category WHERE tenant_id = ? AND name = ?');
  const insertCat = db.prepare(
    `INSERT INTO category (id, tenant_id, name, parent_id, is_system, color, created_at, updated_at, archived_at)
     VALUES (?, ?, ?, NULL, 1, NULL, ?, ?, NULL)`,
  );
  for (const name of names) {
    const existing = findStmt.get(tenantId, name) as { id: string } | undefined;
    if (existing) {
      nameToId.set(name, existing.id);
    } else {
      const id = newId();
      insertCat.run(id, tenantId, name, now, now);
      nameToId.set(name, id);
    }
  }

  // Seed rules only if the tenant has none yet.
  const ruleCount = db.prepare('SELECT COUNT(*) AS n FROM category_rule WHERE tenant_id = ?').get(tenantId) as {
    n: number;
  };
  if (ruleCount.n > 0) return;

  const insertRule = db.prepare(
    `INSERT INTO category_rule (id, tenant_id, match_type, pattern, category_id, priority, learned, hit_count, created_at, updated_at, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, NULL)`,
  );

  for (const rule of catConfig.rules) {
    const categoryId = nameToId.get(rule.category);
    if (!categoryId) continue;
    insertRule.run(newId(), tenantId, rule.matchType, rule.pattern.toLowerCase(), categoryId, rule.priority ?? 100, now, now);
  }

  for (const merchant of merchantConfig.merchants) {
    const categoryId = nameToId.get(merchant.category);
    if (!categoryId) continue;
    for (const keyword of merchant.keywords) {
      insertRule.run(newId(), tenantId, 'merchant', keyword.toLowerCase(), categoryId, 110, now, now);
    }
  }

  seedMerchantRules(db, tenantId, merchantConfig, now);
}

/** Seed the dedicated merchant_rule table (Phase 16) from config, first run only. */
function seedMerchantRules(db: Db, tenantId: string, merchantConfig: MerchantRulesConfig, now: string): void {
  const count = db.prepare('SELECT COUNT(*) AS n FROM merchant_rule WHERE tenant_id = ?').get(tenantId) as { n: number };
  if (count.n > 0) return;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO merchant_rule (tenant_id, merchant, category, source, confidence, last_updated)
     VALUES (?, ?, ?, 'system', 1.0, ?)`,
  );
  for (const m of merchantConfig.merchants) {
    insert.run(tenantId, m.merchant.toLowerCase(), m.category, now);
  }
}
