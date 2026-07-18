/**
 * MerchantCategorizationService (Phase 16 §2, §4, §5, §7).
 *
 * Layered category assignment — every transaction gets a category:
 *   1. merchant_rule (user_override first, then system) → its confidence
 *   2. external enrichment (stubbed → null)
 *   3. keyword/category_rule engine (config-seeded) → rule confidence
 *   4. semantic fallback → Dining/Transport/... at 0.6, else Miscellaneous 0.3
 * Confidence < 0.7 flags the transaction for review.
 */
import type { MerchantRuleRepository } from '../repositories/MerchantRuleRepository.js';
import type { CategoryRepository } from '../repositories/CategoryRepository.js';
import type { CategoryRuleRepository } from '../repositories/CategoryRuleRepository.js';
import type { MerchantDetectionService } from './MerchantDetectionService.js';
import type { LocalCategorizationService } from './LocalCategorizationService.js';
import type { CategoryRule, MerchantRule, Transaction } from '../models/index.js';

const FLAG_THRESHOLD = 0.7;

const SEMANTIC: Array<{ category: string; keywords: string[] }> = [
  { category: 'Dining', keywords: ['restaurant', 'cafe', 'coffee', 'bar', 'eatery', 'grill', 'pizza', 'kitchen', 'diner', 'food'] },
  { category: 'Transport', keywords: ['fuel', 'petrol', 'garage', 'uber', 'bolt', 'taxi', 'parking', 'toll', 'gautrain', 'engen', 'shell'] },
  { category: 'Health', keywords: ['gym', 'fitness', 'pharmacy', 'clinic', 'hospital', 'dischem', 'clicks', 'medical', 'doctor'] },
  { category: 'Financial Services', keywords: ['insurance', 'assurance', 'loan', 'policy', 'broker', 'fund'] },
  { category: 'E-commerce', keywords: ['takealot', 'amazon', 'ebay', 'online', 'checkout'] },
  { category: 'Clothing', keywords: ['clothing', 'apparel', 'fashion', 'h&m', 'zara', 'cotton on'] },
  { category: 'Entertainment', keywords: ['subscription', 'netflix', 'spotify', 'youtube', 'premium', 'plus', 'cinema', 'movie', 'showmax'] },
  { category: 'Utilities', keywords: ['electricity', 'water', 'municipal', 'eskom', 'vodacom', 'mtn', 'telkom', 'airtime', 'prepaid'] },
  { category: 'Retail', keywords: ['shop', 'store', 'mall', 'market', 'retail'] },
];

export interface AssignResult {
  category: string;
  confidence: number;
}

export interface ClassifyResult {
  categoryId: string;
  category: string;
  merchant: string | null;
  confidence: number;
  flagged: boolean;
  source: MerchantRule['source'] | 'rule' | 'fallback';
}

interface TenantContext {
  categoriesByName: Map<string, string>;
  merchants: Map<string, MerchantRule>;
  rules: CategoryRule[];
}

/** Pure semantic fallback — used when no merchant/keyword rule applies. */
export function fallbackCategorization(description: string): AssignResult {
  const d = description.toLowerCase();
  for (const s of SEMANTIC) {
    if (s.keywords.some((k) => d.includes(k))) return { category: s.category, confidence: 0.6 };
  }
  return { category: 'Miscellaneous', confidence: 0.3 };
}

export class MerchantCategorizationService {
  private readonly cache = new Map<string, TenantContext>();

  constructor(
    private readonly merchantRules: MerchantRuleRepository,
    private readonly categories: CategoryRepository,
    private readonly categoryRules: CategoryRuleRepository,
    private readonly detection: MerchantDetectionService,
    private readonly keywordEngine: LocalCategorizationService,
  ) {}

  /** Drop cached rules for a tenant (after a learned override). */
  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  private async context(tenantId: string): Promise<TenantContext> {
    const cached = this.cache.get(tenantId);
    if (cached) return cached;
    const cats = await this.categories.listByTenant(tenantId);
    const merchants = await this.merchantRules.listByTenant(tenantId);
    const rules = await this.categoryRules.listByTenant(tenantId);
    const ctx: TenantContext = {
      categoriesByName: new Map(cats.map((c) => [c.name.toLowerCase(), c.id])),
      merchants: new Map(merchants.map((m) => [m.merchant.toLowerCase(), m])),
      rules,
    };
    this.cache.set(tenantId, ctx);
    return ctx;
  }

  private resolveId(ctx: TenantContext, name: string): string {
    return (
      ctx.categoriesByName.get(name.toLowerCase()) ??
      ctx.categoriesByName.get('miscellaneous') ??
      ctx.categoriesByName.get('uncategorized') ??
      ''
    );
  }

  /** Spec §2 signature: semantic + fallback assignment (no DB). */
  assignCategory(_merchant: string | null, description: string): AssignResult {
    // external enrichment stub would go here (returns null for now)
    return fallbackCategorization(description);
  }

  /** Full tenant-aware classification used by the ingestion pipeline. */
  async classify(tenantId: string, txn: Transaction): Promise<ClassifyResult> {
    const ctx = await this.context(tenantId);
    const merchant = this.detection.detectMerchant(txn.descriptionRaw);

    // 1. merchant_rule (exact, highest priority)
    if (merchant) {
      const rule = ctx.merchants.get(merchant.toLowerCase());
      if (rule) {
        return {
          categoryId: this.resolveId(ctx, rule.category),
          category: rule.category,
          merchant,
          confidence: rule.confidence,
          flagged: rule.confidence < FLAG_THRESHOLD,
          source: rule.source,
        };
      }
    }

    // 2. external enrichment — stubbed (null)

    // 3. keyword / category_rule engine
    const decision = this.keywordEngine.categorize(txn, ctx.rules);
    if (decision.categoryId && decision.confidence >= FLAG_THRESHOLD) {
      const name = [...ctx.categoriesByName.entries()].find(([, id]) => id === decision.categoryId)?.[0] ?? 'unknown';
      return { categoryId: decision.categoryId, category: name, merchant, confidence: decision.confidence, flagged: false, source: 'rule' };
    }

    // 4. semantic fallback (always returns a category)
    const fb = this.assignCategory(merchant, txn.descriptionRaw);
    return {
      categoryId: this.resolveId(ctx, fb.category),
      category: fb.category,
      merchant,
      confidence: fb.confidence,
      flagged: fb.confidence < FLAG_THRESHOLD,
      source: 'fallback',
    };
  }
}
