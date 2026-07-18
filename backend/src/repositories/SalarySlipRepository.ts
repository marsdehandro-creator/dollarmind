/**
 * SalarySlipRepository port.
 */
import type { SalarySlip } from '../models/index.js';

export interface SalarySlipRepository {
  create(slip: SalarySlip): Promise<SalarySlip>;
  findById(id: string): Promise<SalarySlip | null>;
  /** Slip headers for a tenant, newest first. */
  listByTenant(tenantId: string): Promise<SalarySlip[]>;
}
