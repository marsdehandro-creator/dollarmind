/**
 * CategoryRuleRepository port.
 */
import type { CategoryRule } from '../models/index.js';

export interface CategoryRuleRepository {
  /** Active rules for a tenant, ordered by priority (highest first). */
  listByTenant(tenantId: string): Promise<CategoryRule[]>;
  create(rule: CategoryRule): Promise<CategoryRule>;
  /** Find an existing rule with the same match (used to avoid duplicate learned rules). */
  findMatching(
    tenantId: string,
    matchType: CategoryRule['matchType'],
    pattern: string,
    categoryId: string,
  ): Promise<CategoryRule | null>;
  incrementHit(id: string): Promise<void>;
}
