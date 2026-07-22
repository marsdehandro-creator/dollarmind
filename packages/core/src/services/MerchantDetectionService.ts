/**
 * MerchantDetectionService (Phase 16 §1).
 *
 * Extracts a stable, normalized merchant key from a raw transaction
 * description. Known merchants (from merchant-rules.json keywords) resolve to a
 * canonical name; unknown merchants fall back to the leading significant token,
 * which stays stable across branches (e.g. "JOESCOFFEE SANDTON" and
 * "JOESCOFFEE ROSEBANK" both → "joescoffee").
 */
export interface MerchantRulesConfig {
  merchants: Array<{ merchant: string; category: string; keywords: string[] }>;
}

const COMPANY_SUFFIXES = /\b(pty|ltd|limited|proprietary|cc|inc|incorporated|the|co)\b/g;
const BANK_NOISE = /\b(pos|card|purchase|payment|paymt|eft|debit|credit|ref|reference|txn|trans|transaction|fee|fees|dr|cr)\b/g;

export class MerchantDetectionService {
  private readonly keywords: Array<{ merchant: string; keyword: string }>;

  /**
   * Takes already-loaded rule data rather than reading config files itself, so
   * this class stays portable across Node (fs-backed loader) and the browser
   * (bundled JSON import) — see docs/v2-migration-spec.md's core principle.
   */
  constructor(config: MerchantRulesConfig) {
    this.keywords = config.merchants
      .flatMap((m) => m.keywords.map((k) => ({ merchant: m.merchant.toLowerCase(), keyword: k.toLowerCase() })))
      // longer keywords first so "pick n pay" wins over "pay"
      .sort((a, b) => b.keyword.length - a.keyword.length);
  }

  normalize(description: string): string {
    return description
      .toLowerCase()
      .replace(/[^a-z0-9&\s]/g, ' ')
      .replace(COMPANY_SUFFIXES, ' ')
      .replace(BANK_NOISE, ' ')
      .replace(/\b\d{4,}\b/g, ' ') // card/reference numbers
      .replace(/\s+/g, ' ')
      .trim();
  }

  detectMerchant(description: string): string | null {
    const norm = this.normalize(description);
    if (!norm) return null;
    for (const { merchant, keyword } of this.keywords) {
      if (norm.includes(keyword)) return merchant;
    }
    const tokens = norm.split(' ').filter((t) => t.length >= 3);
    return tokens[0] ?? null;
  }
}
