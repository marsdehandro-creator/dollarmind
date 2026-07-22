/**
 * SQLite-backed CategoryRuleRepository.
 */
import type { Db } from '../../db/connection.js';
import type { CategoryRule } from '@dollarmind/core/models/index.js';
import type { CategoryRuleRepository } from '@dollarmind/core/repositories/CategoryRuleRepository.js';
import { nowIso } from '@dollarmind/core/utils/id.js';
import { rowToCategoryRule, type Row } from '@dollarmind/core/repositories/rowMappers.js';

export class SqliteCategoryRuleRepository implements CategoryRuleRepository {
  constructor(private readonly db: Db) {}

  async listByTenant(tenantId: string): Promise<CategoryRule[]> {
    const rows = this.db
      .prepare('SELECT * FROM category_rule WHERE tenant_id = ? AND archived_at IS NULL ORDER BY priority DESC, created_at ASC')
      .all(tenantId) as Row[];
    return rows.map(rowToCategoryRule);
  }

  async create(rule: CategoryRule): Promise<CategoryRule> {
    this.db
      .prepare(
        `INSERT INTO category_rule (id, tenant_id, match_type, pattern, category_id, priority, learned, hit_count, created_at, updated_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
      );
    return rule;
  }

  async findMatching(
    tenantId: string,
    matchType: CategoryRule['matchType'],
    pattern: string,
    categoryId: string,
  ): Promise<CategoryRule | null> {
    const row = this.db
      .prepare(
        'SELECT * FROM category_rule WHERE tenant_id = ? AND match_type = ? AND pattern = ? AND category_id = ?',
      )
      .get(tenantId, matchType, pattern, categoryId) as Row | undefined;
    return row ? rowToCategoryRule(row) : null;
  }

  async incrementHit(id: string): Promise<void> {
    this.db
      .prepare('UPDATE category_rule SET hit_count = hit_count + 1, updated_at = ? WHERE id = ?')
      .run(nowIso(), id);
  }
}
