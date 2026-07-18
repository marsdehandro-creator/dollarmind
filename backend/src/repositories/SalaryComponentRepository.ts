/**
 * SalaryComponentRepository port.
 */
import type { SalaryComponent } from '../models/index.js';

export interface SalaryComponentRepository {
  createMany(components: SalaryComponent[]): Promise<void>;
  /** Components for a slip, in display order. */
  listBySlip(salarySlipId: string): Promise<SalaryComponent[]>;
}
