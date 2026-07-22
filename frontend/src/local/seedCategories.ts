/**
 * On-device port of backend/src/db/seedCategories.ts — same seeding logic
 * (categories, category_rule, merchant_rule from the bundled config JSON),
 * just async against a LocalDbDriver instead of sync against node:sqlite.
 * Idempotent: safe to call on every app start.
 */
import type { LocalDbDriver } from '@dollarmind/core/db/LocalDbDriver.js';
import { newId, nowIso } from '@dollarmind/core/utils/id.js';
import { loadCategoryRules, loadMerchantRules } from './config.js';

const EXTRA_CATEGORIES = ['Financial Services', 'Retail', 'E-commerce', 'Clothing', 'Miscellaneous'];

export async function seedCategories(db: LocalDbDriver, tenantId: string): Promise<void> {
  const catConfig = loadCategoryRules();
  const merchantConfig = loadMerchantRules();

  const now = nowIso();
  const names = new Set<string>([
    ...catConfig.categories,
    ...merchantConfig.merchants.map((m) => m.category),
    ...EXTRA_CATEGORIES,
    'Uncategorized',
  ]);

  const nameToId = new Map<string, string>();
  for (const name of names) {
    const existing = await db.query<{ id: string }>('SELECT id FROM category WHERE tenant_id = ? AND name = ?', [
      tenantId,
      name,
    ]);
    if (existing[0]) {
      nameToId.set(name, existing[0].id);
    } else {
      const id = newId();
      await db.run(
        `INSERT INTO category (id, tenant_id, name, parent_id, is_system, color, created_at, updated_at, archived_at)
         VALUES (?, ?, ?, NULL, 1, NULL, ?, ?, NULL)`,
        [id, tenantId, name, now, now],
      );
      nameToId.set(name, id);
    }
  }

  const ruleCountRows = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM category_rule WHERE tenant_id = ?', [
    tenantId,
  ]);
  if (ruleCountRows[0].n > 0) return;

  const insertRuleSql = `INSERT INTO category_rule (id, tenant_id, match_type, pattern, category_id, priority, learned, hit_count, created_at, updated_at, archived_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, NULL)`;

  for (const rule of catConfig.rules) {
    const categoryId = nameToId.get(rule.category);
    if (!categoryId) continue;
    await db.run(insertRuleSql, [
      newId(),
      tenantId,
      rule.matchType,
      rule.pattern.toLowerCase(),
      categoryId,
      rule.priority ?? 100,
      now,
      now,
    ]);
  }

  for (const merchant of merchantConfig.merchants) {
    const categoryId = nameToId.get(merchant.category);
    if (!categoryId) continue;
    for (const keyword of merchant.keywords) {
      await db.run(insertRuleSql, [newId(), tenantId, 'merchant', keyword.toLowerCase(), categoryId, 110, now, now]);
    }
  }

  await seedMerchantRules(db, tenantId, now);
}

async function seedMerchantRules(db: LocalDbDriver, tenantId: string, now: string): Promise<void> {
  const merchantConfig = loadMerchantRules();
  const countRows = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM merchant_rule WHERE tenant_id = ?', [
    tenantId,
  ]);
  if (countRows[0].n > 0) return;

  for (const m of merchantConfig.merchants) {
    await db.run(
      `INSERT OR IGNORE INTO merchant_rule (tenant_id, merchant, category, source, confidence, last_updated)
       VALUES (?, ?, ?, 'system', 1.0, ?)`,
      [tenantId, m.merchant.toLowerCase(), m.category, now],
    );
  }
}
