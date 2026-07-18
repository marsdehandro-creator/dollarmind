/**
 * LocalTransactionService — pilot implementation of TransactionService.
 */
import type { TransactionService } from './interfaces/TransactionService.js';
import type { TransactionRepository, TransactionFilterCriteria } from '../repositories/TransactionRepository.js';
import type { Transaction } from '../models/index.js';

export class LocalTransactionService implements TransactionService {
  constructor(private readonly transactions: TransactionRepository) {}

  list(tenantId: string, opts?: { limit?: number; offset?: number }): Promise<Transaction[]> {
    return this.transactions.listByTenant(tenantId, opts?.limit, opts?.offset);
  }

  filter(tenantId: string, criteria: TransactionFilterCriteria): Promise<Transaction[]> {
    return this.transactions.filter(tenantId, criteria);
  }
}
