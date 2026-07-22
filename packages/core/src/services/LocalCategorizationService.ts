/**
 * LocalCategorizationService — the detection engine (docs/architecture.md §7).
 *
 * Matching strategies (simple, structured for future ML expansion):
 *   - contains      keyword substring on the normalized description
 *   - merchant      merchant keyword substring (from merchant-rules.json seed)
 *   - regex         regular expression on the normalized description
 *   - amount_range  pattern "minCents:maxCents"
 * Rules are applied in priority order (highest first); first match wins.
 *
 * Adaptive learning: a manual override creates a high-priority `learned` rule so
 * the correction sticks and generalizes to future transactions.
 */
import type { CategorizationService, CategoryDecision } from './interfaces/CategorizationService.js';
import type { CategoryRuleRepository } from '../repositories/CategoryRuleRepository.js';
import type { CategoryRule, Transaction } from '../models/index.js';
import type { MerchantRulesConfig } from './MerchantDetectionService.js';
import { newId, nowIso } from '../utils/id.js';

const LEARNED_RULE_PRIORITY = 200;

export interface MerchantMatch {
  merchant: string;
  keyword: string;
}

export class LocalCategorizationService implements CategorizationService {
  private readonly merchantKeywords: MerchantMatch[];

  /**
   * Takes already-loaded rule data rather than reading config files itself, so
   * this class stays portable across Node (fs-backed loader) and the browser
   * (bundled JSON import) — see docs/v2-migration-spec.md's core principle.
   */
  constructor(
    private readonly rules: CategoryRuleRepository,
    merchantRulesConfig: MerchantRulesConfig,
  ) {
    this.merchantKeywords = merchantRulesConfig.merchants.flatMap((m) =>
      m.keywords.map((k) => ({ merchant: m.merchant, keyword: k.toLowerCase() })),
    );
  }

  categorize(txn: Transaction, rules: CategoryRule[]): CategoryDecision {
    for (const rule of rules) {
      if (this.matches(rule, txn)) {
        return { categoryId: rule.categoryId, source: 'rule', confidence: this.confidence(rule) };
      }
    }
    return { categoryId: null, source: 'default', confidence: 0 };
  }

  private matches(rule: CategoryRule, txn: Transaction): boolean {
    const desc = txn.descriptionNorm;
    switch (rule.matchType) {
      case 'contains':
      case 'merchant':
        return desc.includes(rule.pattern.toLowerCase());
      case 'regex':
        try {
          return new RegExp(rule.pattern, 'i').test(desc);
        } catch {
          return false;
        }
      case 'amount_range': {
        const [min, max] = rule.pattern.split(':').map((n) => Number(n));
        return txn.amount >= (min || 0) && txn.amount <= (max || Number.MAX_SAFE_INTEGER);
      }
      default:
        return false;
    }
  }

  private confidence(rule: CategoryRule): number {
    if (rule.learned) return 0.95;
    if (rule.matchType === 'merchant') return 0.85;
    if (rule.matchType === 'contains') return 0.75;
    if (rule.matchType === 'regex') return 0.7;
    return 0.5;
  }

  /**
   * Import-time classification: always returns a category. A confident rule
   * match is assigned unflagged; anything else falls back to the Uncategorized
   * category and is flagged for review (Phase 15 — no more uncategorised rows).
   */
  classifyForImport(
    txn: Transaction,
    rules: CategoryRule[],
    uncategorizedCategoryId: string,
  ): { categoryId: string; source: CategoryDecision['source']; flagged: boolean; merchant: string | null } {
    const decision = this.categorize(txn, rules);
    const merchant = this.detectMerchant(txn.descriptionNorm)?.merchant ?? null;
    if (decision.categoryId && decision.confidence >= 0.7) {
      return { categoryId: decision.categoryId, source: decision.source, flagged: false, merchant };
    }
    return { categoryId: uncategorizedCategoryId, source: 'default', flagged: true, merchant };
  }

  /** Basic keyword-based merchant detection. */
  detectMerchant(descriptionNorm: string): MerchantMatch | null {
    for (const m of this.merchantKeywords) {
      if (descriptionNorm.includes(m.keyword)) return m;
    }
    return null;
  }

  async learnFromOverride(tenantId: string, txn: Transaction, categoryId: string): Promise<void> {
    // Prefer a merchant keyword; fall back to a significant description token.
    const merchant = this.detectMerchant(txn.descriptionNorm);
    const matchType: CategoryRule['matchType'] = merchant ? 'merchant' : 'contains';
    const pattern = (merchant?.keyword ?? this.significantToken(txn.descriptionNorm)).toLowerCase();
    if (!pattern) return;

    const existing = await this.rules.findMatching(tenantId, matchType, pattern, categoryId);
    if (existing) return; // already learned

    const now = nowIso();
    const rule: CategoryRule = {
      id: newId(),
      tenantId,
      matchType,
      pattern,
      categoryId,
      priority: LEARNED_RULE_PRIORITY,
      learned: true,
      hitCount: 0,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await this.rules.create(rule);
  }

  private significantToken(descriptionNorm: string): string {
    const tokens = descriptionNorm.split(/\s+/).filter((t) => t.length >= 4);
    return tokens[0] ?? descriptionNorm.trim();
  }

  /** Expose the rule that would be created by an override (for API responses). */
  async createLearnedRule(tenantId: string, txn: Transaction, categoryId: string): Promise<CategoryRule | null> {
    const before = await this.rules.listByTenant(tenantId);
    await this.learnFromOverride(tenantId, txn, categoryId);
    const after = await this.rules.listByTenant(tenantId);
    if (after.length === before.length) return null;
    const beforeIds = new Set(before.map((r) => r.id));
    return after.find((r) => !beforeIds.has(r.id)) ?? null;
  }
}
