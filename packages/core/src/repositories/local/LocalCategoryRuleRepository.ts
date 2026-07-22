/**
 * On-device (LocalDbDriver-backed) CategoryRuleRepository. Same SQL/shape as
 * SqliteCategoryRuleRepository.
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { CategoryRule } from '../../models/index.js';
import type { CategoryRuleRepository } from '../CategoryRuleRepository.js';
import { nowIso } from '../../utils/id.js';
import { rowToCategoryRule, type Row } from '../rowMappers.js';

export class LocalCategoryRuleRepository implements CategoryRuleRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async listByTenant(tenantId: string): Promise<CategoryRule[]> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM category_rule WHERE tenant_id = ? AND archived_at IS NULL ORDER BY priority DESC, created_at ASC',
      [tenantId],
    );
    return rows.map(rowToCategoryRule);
  }

  async create(rule: CategoryRule): Promise<CategoryRule> {
    await this.db.run(
      `INSERT INTO category_rule (id, tenant_id, match_type, pattern, category_id, priority, learned, hit_count, created_at, updated_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rule.id,
        rule.tenantId,
        rule.matchType,
        rule.pattern,
        rule.categoryId,
        rule.priority,
        rule.learned ? 1 : 0,
        rule.hitCount,
        rule.createdAt,
        rule.updatedAt,
        rule.archivedAt,
      ],
    );
    return rule;
  }

  async findMatching(
    tenantId: string,
    matchType: CategoryRule['matchType'],
    pattern: string,
    categoryId: string,
  ): Promise<CategoryRule | null> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM category_rule WHERE tenant_id = ? AND match_type = ? AND pattern = ? AND category_id = ?',
      [tenantId, matchType, pattern, categoryId],
    );
    return rows[0] ? rowToCategoryRule(rows[0]) : null;
  }

  async incrementHit(id: string): Promise<void> {
    await this.db.run('UPDATE category_rule SET hit_count = hit_count + 1, updated_at = ? WHERE id = ?', [
      nowIso(),
      id,
    ]);
  }
}
