/**
 * TransactionService port (docs/requirements.md F3).
 */
import type { Transaction } from '../../models/index.js';
import type { TransactionFilterCriteria } from '../../repositories/TransactionRepository.js';

export interface TransactionService {
  list(tenantId: string, opts?: { limit?: number; offset?: number }): Promise<Transaction[]>;
  filter(tenantId: string, criteria: TransactionFilterCriteria): Promise<Transaction[]>;
}
