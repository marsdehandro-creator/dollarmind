/**
 * DeduplicationService port (see docs/architecture.md §6, docs/data-model.md §4.3).
 *
 * Pure matching over incoming vs. existing transactions. No side effects — the
 * import orchestrator decides what to skip, merge, or flag.
 */
import type { Transaction, UUID } from '../../models/index.js';

export type DedupVerdict =
  | { kind: 'new' }
  | { kind: 'exact_duplicate'; existingId: UUID }
  | { kind: 'possible_duplicate'; existingId: UUID; similarity: number };

export interface DeduplicationService {
  /** Deterministic hash for exact-match detection. */
  computeHash(txn: Pick<Transaction, 'accountId' | 'txnDate' | 'amount' | 'direction' | 'descriptionNorm'>): string;

  /** Classify an incoming transaction against the existing ledger. */
  classify(incoming: Transaction, existing: Transaction[]): DedupVerdict;
}
