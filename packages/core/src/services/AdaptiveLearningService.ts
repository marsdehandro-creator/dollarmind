/**
 * AdaptiveLearningService (Phase 16 §3).
 *
 * Persists user category choices as high-confidence merchant_rule overrides so
 * future ingestion applies them automatically and never re-flags them.
 */
import type { MerchantRuleRepository } from '../repositories/MerchantRuleRepository.js';
import type { MerchantDetectionService } from './MerchantDetectionService.js';
import type { MerchantCategorizationService } from './MerchantCategorizationService.js';
import type { Transaction } from '../models/index.js';
import { nowIso } from '../utils/id.js';

export class AdaptiveLearningService {
  constructor(
    private readonly merchantRules: MerchantRuleRepository,
    private readonly detection: MerchantDetectionService,
    private readonly categorizer: MerchantCategorizationService,
  ) {}

  /** Store merchant → category as a user override (confidence 1.0). */
  async learnNewRule(tenantId: string, merchant: string, category: string): Promise<void> {
    const key = this.detection.normalize(merchant) || merchant.toLowerCase();
    await this.merchantRules.upsert({
      tenantId,
      merchant: key,
      category,
      source: 'user_override',
      confidence: 1.0,
      lastUpdated: nowIso(),
    });
    this.categorizer.invalidate(tenantId);
  }

  /** Learn from a corrected transaction (detects the merchant automatically). */
  async learnFromTransaction(tenantId: string, txn: Transaction, category: string): Promise<void> {
    const merchant = this.detection.detectMerchant(txn.descriptionRaw);
    if (!merchant) return;
    await this.merchantRules.upsert({
      tenantId,
      merchant: merchant.toLowerCase(),
      category,
      source: 'user_override',
      confidence: 1.0,
      lastUpdated: nowIso(),
    });
    this.categorizer.invalidate(tenantId);
  }
}
