/**
 * Merchant detection + layered categorization + adaptive learning (Phase 16).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createConfiguredDb, type Db } from '../db/index.js';
import { SqliteMerchantRuleRepository } from '../repositories/sqlite/SqliteMerchantRuleRepository.js';
import { SqliteCategoryRepository } from '../repositories/sqlite/SqliteCategoryRepository.js';
import { SqliteCategoryRuleRepository } from '../repositories/sqlite/SqliteCategoryRuleRepository.js';
import { MerchantDetectionService } from '@dollarmind/core/services/MerchantDetectionService.js';
import { MerchantCategorizationService, fallbackCategorization } from '@dollarmind/core/services/MerchantCategorizationService.js';
import { AdaptiveLearningService } from '@dollarmind/core/services/AdaptiveLearningService.js';
import { LocalCategorizationService } from '@dollarmind/core/services/LocalCategorizationService.js';
import { DEFAULT_TENANT_ID, loadMerchantRules } from '../config/index.js';
import type { Transaction } from '@dollarmind/core/models/index.js';
import type { MerchantRulesConfig } from '@dollarmind/core/services/MerchantDetectionService.js';
import { newId } from '@dollarmind/core/utils/id.js';

const merchantRulesConfig = loadMerchantRules<MerchantRulesConfig>();
const detection = new MerchantDetectionService(merchantRulesConfig);

function txn(desc: string, amount = 10000): Transaction {
  return {
    id: newId(), tenantId: DEFAULT_TENANT_ID, accountId: 'a', bankStatementId: null, sourceDocumentId: 'd',
    sourceRow: null, txnDate: '2026-06-01', descriptionRaw: desc, descriptionNorm: desc.toLowerCase(), amount,
    direction: 'debit', balanceAfter: null, currency: 'ZAR', categoryId: null, categorySource: 'default',
    merchant: null, confidence: 1, flagged: false, dedupGroupId: null, dedupHash: newId(),
    reconciledExpenseId: null, createdAt: 'now', updatedAt: 'now', archivedAt: null,
  };
}

describe('MerchantDetectionService', () => {
  it('normalizes and extracts a stable merchant key', () => {
    expect(detection.detectMerchant('SPOTIFY AB STOCKHOLM')).toBe('spotify');
    expect(detection.detectMerchant('POS PURCHASE TAKEALOT.COM 4823')).toBe('takealot');
    // unknown merchant → stable leading token across branches
    expect(detection.detectMerchant('JOESCOFFEE SANDTON')).toBe('joescoffee');
    expect(detection.detectMerchant('JOESCOFFEE ROSEBANK CARD 9931')).toBe('joescoffee');
    expect(detection.normalize('ACME TRADING (PTY) LTD')).toBe('acme trading');
  });
});

describe('fallbackCategorization', () => {
  it('maps keywords to categories, else Miscellaneous', () => {
    expect(fallbackCategorization('THE CORNER RESTAURANT').category).toBe('Dining');
    expect(fallbackCategorization('SHELL FUEL GARAGE').category).toBe('Transport');
    expect(fallbackCategorization('VIRGIN ACTIVE GYM').category).toBe('Health');
    expect(fallbackCategorization('OUTSURANCE INSURANCE').category).toBe('Financial Services');
    const misc = fallbackCategorization('ZZZQQ UNKNOWN THING');
    expect(misc.category).toBe('Miscellaneous');
    expect(misc.confidence).toBe(0.3);
  });
});

describe('MerchantCategorizationService', () => {
  let db: Db;
  let svc: MerchantCategorizationService;
  let adaptive: AdaptiveLearningService;
  beforeEach(() => {
    db = createConfiguredDb(':memory:');
    const merchantRules = new SqliteMerchantRuleRepository(db);
    const cats = new SqliteCategoryRepository(db);
    const rules = new SqliteCategoryRuleRepository(db);
    svc = new MerchantCategorizationService(merchantRules, cats, rules, detection, new LocalCategorizationService(rules, merchantRulesConfig));
    adaptive = new AdaptiveLearningService(merchantRules, detection, svc);
  });

  it('categorizes a seeded merchant with high confidence, not flagged', async () => {
    const r = await svc.classify(DEFAULT_TENANT_ID, txn('SPOTIFY AB'));
    expect(r.category).toBe('Entertainment');
    expect(r.confidence).toBe(1);
    expect(r.flagged).toBe(false);
  });

  it('never leaves a transaction uncategorized (fallback → flagged)', async () => {
    const r = await svc.classify(DEFAULT_TENANT_ID, txn('ZZZQQ MYSTERY VENDOR'));
    expect(r.categoryId).not.toBe('');
    expect(r.category).toBe('Miscellaneous');
    expect(r.flagged).toBe(true); // low confidence
  });

  it('applies an adaptively-learned override on the next classify (no flag)', async () => {
    const before = await svc.classify(DEFAULT_TENANT_ID, txn('JOESCOFFEE SANDTON'));
    expect(before.flagged).toBe(true); // unknown → fallback

    await adaptive.learnNewRule(DEFAULT_TENANT_ID, 'joescoffee', 'Dining');

    const after = await svc.classify(DEFAULT_TENANT_ID, txn('JOESCOFFEE ROSEBANK'));
    expect(after.category).toBe('Dining');
    expect(after.confidence).toBe(1);
    expect(after.flagged).toBe(false);
    expect(after.source).toBe('user_override');
  });
});
