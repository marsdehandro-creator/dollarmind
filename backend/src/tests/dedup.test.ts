/**
 * Deduplication engine tests (pure).
 */
import { describe, it, expect } from 'vitest';
import { LocalDeduplicationService, descriptionSimilarity } from '@dollarmind/core/services/LocalDeduplicationService.js';
import type { Transaction } from '@dollarmind/core/models/index.js';

const dedup = new LocalDeduplicationService();

function txn(overrides: Partial<Transaction>): Transaction {
  const base: Transaction = {
    id: 'id',
    tenantId: 't',
    accountId: 'acc',
    bankStatementId: null,
    sourceDocumentId: 'doc',
    sourceRow: null,
    txnDate: '2026-06-01',
    descriptionRaw: 'WOOLWORTHS SANDTON',
    descriptionNorm: 'woolworths sandton',
    amount: 35000,
    direction: 'debit',
    balanceAfter: null,
    currency: 'ZAR',
    categoryId: null,
    categorySource: 'default',
    merchant: null,
    confidence: 1,
    flagged: false,
    dedupGroupId: null,
    dedupHash: '',
    reconciledExpenseId: null,
    createdAt: 'now',
    updatedAt: 'now',
    archivedAt: null,
  };
  const merged = { ...base, ...overrides };
  merged.dedupHash = dedup.computeHash(merged);
  return merged;
}

describe('descriptionSimilarity', () => {
  it('is 1 for identical, lower for partial overlap', () => {
    expect(descriptionSimilarity('woolworths sandton', 'woolworths sandton')).toBe(1);
    expect(descriptionSimilarity('woolworths sandton', 'woolworths rosebank')).toBeGreaterThan(0);
    expect(descriptionSimilarity('woolworths sandton', 'woolworths rosebank')).toBeLessThan(1);
  });
});

describe('DeduplicationService.classify', () => {
  it('flags an exact duplicate (identical hash)', () => {
    const existing = txn({ id: 'a' });
    const incoming = txn({ id: 'b' });
    expect(dedup.classify(incoming, [existing])).toEqual({ kind: 'exact_duplicate', existingId: 'a' });
  });

  it('treats a genuinely new transaction as new', () => {
    const existing = txn({ id: 'a' });
    const incoming = txn({ id: 'b', descriptionRaw: 'CHECKERS', descriptionNorm: 'checkers', amount: 9999 });
    expect(dedup.classify(incoming, [existing]).kind).toBe('new');
  });

  it('flags a possible duplicate on pending->posted date drift (same amount + description, ±1 day)', () => {
    // Different date => different dedup_hash (not exact), but same amount and
    // description within the date tolerance => a near-duplicate to review.
    const existing = txn({ id: 'a', txnDate: '2026-06-01' });
    const incoming = txn({ id: 'b', txnDate: '2026-06-02' });
    const verdict = dedup.classify(incoming, [existing]);
    expect(verdict.kind).toBe('possible_duplicate');
    if (verdict.kind === 'possible_duplicate') expect(verdict.existingId).toBe('a');
  });
});
