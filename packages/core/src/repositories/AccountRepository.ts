/**
 * AccountRepository port (minimal — extended in later phases).
 */
import type { Account } from '../models/index.js';

export interface AccountRepository {
  findById(id: string): Promise<Account | null>;
  /** Get (or create) a named income-source account for the tenant. */
  getOrCreateIncomeSource(tenantId: string, name: string): Promise<Account>;
  /** Get (or create) a named bank account for the tenant. */
  getOrCreateBankAccount(tenantId: string, name: string): Promise<Account>;
}
