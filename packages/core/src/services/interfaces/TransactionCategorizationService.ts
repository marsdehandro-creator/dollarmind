/**
 * TransactionCategorizationService port — orchestrates applying the detection
 * engine to the ledger and handling manual overrides + adaptive learning.
 */
import type { CategoryRule, Transaction } from '../../models/index.js';

export interface OverrideResult {
  transaction: Transaction;
  learnedRule: CategoryRule | null;
}

export interface TransactionCategorizationService {
  /** Auto-categorize all currently uncategorized transactions. */
  categorizeUncategorized(tenantId: string): Promise<{ categorized: number; total: number }>;

  /** Manually set a transaction's category and learn a rule from it. */
  overrideCategory(tenantId: string, transactionId: string, categoryId: string): Promise<OverrideResult>;
}
