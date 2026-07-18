/**
 * CategorizationService port.
 *
 * Pluggable: rules today, ML later, same interface (docs/architecture.md §7).
 */
import type { CategoryRule, Transaction, UUID } from '../../models/index.js';

export interface CategoryDecision {
  categoryId: UUID | null;
  source: 'rule' | 'auto' | 'default';
  confidence: number;
}

export interface CategorizationService {
  /** Decide a category for a single transaction given the active rule set. */
  categorize(txn: Transaction, rules: CategoryRule[]): CategoryDecision;

  /** Record a user override and create/promote a learned rule. */
  learnFromOverride(tenantId: UUID, txn: Transaction, categoryId: UUID): Promise<void>;
}
