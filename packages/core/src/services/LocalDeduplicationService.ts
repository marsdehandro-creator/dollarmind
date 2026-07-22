/**
 * LocalDeduplicationService — pilot implementation of the DeduplicationService
 * port (docs/architecture.md §6, docs/data-model.md §4.3).
 *
 * Layered matching:
 *   - exact:    identical dedup_hash.
 *   - possible: same amount, date within tolerance, fuzzy description overlap.
 * Pure logic — the import orchestrator decides what to skip / flag / cluster.
 */
import type { DeduplicationService, DedupVerdict } from './interfaces/DeduplicationService.js';
import type { Transaction } from '../models/index.js';
import { sha256Hex } from '../utils/hash.js';

const FUZZY_DATE_TOLERANCE_DAYS = 2;
const FUZZY_SIMILARITY_THRESHOLD = 0.6;

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return ms / 86_400_000;
}

/** Jaccard similarity over description word tokens. */
export function descriptionSimilarity(a: string, b: string): number {
  const sa = new Set(a.split(/\s+/).filter(Boolean));
  const sb = new Set(b.split(/\s+/).filter(Boolean));
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}

export class LocalDeduplicationService implements DeduplicationService {
  computeHash(
    txn: Pick<Transaction, 'accountId' | 'txnDate' | 'amount' | 'direction' | 'descriptionNorm'>,
  ): string {
    return sha256Hex(
      `${txn.accountId}|${txn.txnDate}|${txn.amount}|${txn.direction}|${txn.descriptionNorm}`,
    );
  }

  classify(incoming: Transaction, existing: Transaction[]): DedupVerdict {
    for (const e of existing) {
      if (e.dedupHash === incoming.dedupHash) {
        return { kind: 'exact_duplicate', existingId: e.id };
      }
    }

    let best: Transaction | null = null;
    let bestSim = 0;
    for (const e of existing) {
      if (e.amount !== incoming.amount) continue;
      if (daysBetween(e.txnDate, incoming.txnDate) > FUZZY_DATE_TOLERANCE_DAYS) continue;
      const sim = descriptionSimilarity(e.descriptionNorm, incoming.descriptionNorm);
      if (sim >= FUZZY_SIMILARITY_THRESHOLD && sim > bestSim) {
        best = e;
        bestSim = sim;
      }
    }
    if (best) return { kind: 'possible_duplicate', existingId: best.id, similarity: bestSim };
    return { kind: 'new' };
  }
}
