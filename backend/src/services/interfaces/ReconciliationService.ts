/**
 * ReconciliationService port.
 *
 * Links a manual expense to a bank transaction (1:1) so a reconciled pair is
 * counted once (docs/requirements.md F6).
 */
import type { UUID } from '../../models/index.js';

export interface ReconciliationService {
  /** Suggest candidate bank transactions for a manual expense. */
  suggestMatches(tenantId: UUID, manualExpenseId: UUID): Promise<UUID[]>;

  /** Reconcile a manual expense with a transaction. */
  reconcile(tenantId: UUID, manualExpenseId: UUID, transactionId: UUID): Promise<void>;

  /** Undo a reconciliation. */
  unreconcile(tenantId: UUID, manualExpenseId: UUID): Promise<void>;
}
