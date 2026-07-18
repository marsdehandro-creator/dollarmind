/**
 * BankStatementRepository port.
 */
import type { BankStatement } from '../models/index.js';

export interface BankStatementRepository {
  create(statement: BankStatement): Promise<BankStatement>;
  findById(id: string): Promise<BankStatement | null>;
  /** Statement headers for a tenant, newest first. */
  listByTenant(tenantId: string): Promise<BankStatement[]>;
}
