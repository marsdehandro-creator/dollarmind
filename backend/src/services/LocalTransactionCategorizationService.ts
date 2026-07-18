/**
 * LocalTransactionCategorizationService — applies the detection engine and
 * handles manual overrides + adaptive learning.
 */
import type {
  OverrideResult,
  TransactionCategorizationService,
} from './interfaces/TransactionCategorizationService.js';
import type { LocalCategorizationService } from './LocalCategorizationService.js';
import type { AdaptiveLearningService } from './AdaptiveLearningService.js';
import type { AuditService } from './interfaces/AuditService.js';
import type { TransactionRepository } from '../repositories/TransactionRepository.js';
import type { CategoryRuleRepository } from '../repositories/CategoryRuleRepository.js';
import type { CategoryRepository } from '../repositories/CategoryRepository.js';
import { ValidationError } from '../utils/errors.js';

export class LocalTransactionCategorizationService implements TransactionCategorizationService {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly rules: CategoryRuleRepository,
    private readonly categorizer: LocalCategorizationService,
    private readonly audit: AuditService,
    private readonly categories: CategoryRepository,
    private readonly adaptiveLearning: AdaptiveLearningService,
  ) {}

  /**
   * Re-run categorization over flagged (and any legacy uncategorized) rows,
   * clearing the flag on those a rule now confidently matches.
   */
  async categorizeUncategorized(tenantId: string): Promise<{ categorized: number; total: number }> {
    const rules = await this.rules.listByTenant(tenantId);
    const flagged = await this.transactions.listFlagged(tenantId);
    const legacy = await this.transactions.listUncategorized(tenantId);
    const pending = [...flagged, ...legacy];
    let categorized = 0;
    for (const txn of pending) {
      const decision = this.categorizer.categorize(txn, rules);
      if (decision.categoryId && decision.confidence >= 0.7) {
        await this.transactions.updateCategory(txn.id, decision.categoryId, 'rule', false);
        categorized++;
      }
    }
    await this.audit.record({
      tenantId,
      actor: `user:${tenantId}`,
      action: 'transactions.categorized',
      context: { categorized, total: pending.length },
    });
    return { categorized, total: pending.length };
  }

  async overrideCategory(tenantId: string, transactionId: string, categoryId: string): Promise<OverrideResult> {
    const txn = await this.transactions.findById(transactionId);
    if (!txn || txn.tenantId !== tenantId) throw new ValidationError('Transaction not found');

    await this.transactions.updateCategory(transactionId, categoryId, 'manual', false, 1);
    // Adaptive learning: keyword rule (legacy) + dedicated merchant_rule override.
    const learnedRule = await this.categorizer.createLearnedRule(tenantId, txn, categoryId);
    const category = await this.categories.findById(categoryId);
    if (category) await this.adaptiveLearning.learnFromTransaction(tenantId, txn, category.name);

    await this.audit.record({
      tenantId,
      actor: `user:${tenantId}`,
      action: 'transaction.recategorize',
      entityType: 'transaction',
      entityId: transactionId,
      after: { categoryId, learnedRuleId: learnedRule?.id ?? null },
    });

    const updated = await this.transactions.findById(transactionId);
    return { transaction: updated!, learnedRule };
  }
}
