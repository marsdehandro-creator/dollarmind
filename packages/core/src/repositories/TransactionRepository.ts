/**
 * TransactionRepository port.
 */
import type { Transaction } from '../models/index.js';

export interface TransactionFilterCriteria {
  accountId?: string;
  dateFrom?: string; // ISO date inclusive
  dateTo?: string; // ISO date inclusive
  merchant?: string; // matched against description
  amountMin?: number; // cents
  amountMax?: number; // cents
  direction?: 'debit' | 'credit';
  categoryId?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface CategoryAggregate {
  categoryId: string | null;
  total: number;
  count: number;
}

export interface MonthTotal {
  month: string; // YYYY-MM
  total: number;
}

export interface MonthCategoryTotal {
  month: string;
  categoryId: string | null;
  total: number;
}

export interface AggregateOptions {
  direction?: 'debit' | 'credit';
  dateFrom?: string;
  dateTo?: string;
}

export interface TransactionRepository {
  create(txn: Transaction): Promise<Transaction>;
  findById(id: string): Promise<Transaction | null>;
  /** All non-archived transactions for an account (used by dedup). */
  listByAccount(tenantId: string, accountId: string): Promise<Transaction[]>;
  /** Newest-first list for a tenant. */
  listByTenant(tenantId: string, limit?: number, offset?: number): Promise<Transaction[]>;
  /** Non-archived transactions with no category assigned. */
  listUncategorized(tenantId: string): Promise<Transaction[]>;
  /** Non-archived transactions flagged for category review. */
  listFlagged(tenantId: string): Promise<Transaction[]>;
  /** Transactions belonging to a bank statement, chronological. */
  listByStatement(statementId: string): Promise<Transaction[]>;
  /** Filtered query (parameterized). */
  filter(tenantId: string, criteria: TransactionFilterCriteria): Promise<Transaction[]>;
  /** Assign a dedup cluster id to a transaction. */
  setDedupGroup(id: string, dedupGroupId: string): Promise<void>;
  /** Set a transaction's category + provenance, flagged state, and confidence. */
  updateCategory(
    id: string,
    categoryId: string,
    source: Transaction['categorySource'],
    flagged?: boolean,
    confidence?: number,
  ): Promise<void>;
  /** Count transactions imported from a given statement. */
  countByStatement(statementId: string): Promise<number>;

  // Aggregates (spending summaries + trends).
  sumByCategory(tenantId: string, opts: AggregateOptions): Promise<CategoryAggregate[]>;
  monthlyTotals(tenantId: string, opts: AggregateOptions): Promise<MonthTotal[]>;
  monthlyByCategory(tenantId: string, opts: AggregateOptions): Promise<MonthCategoryTotal[]>;
}
