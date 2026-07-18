/**
 * CashEntryService port — cash inflow/outflow tracking.
 */
import type { CashEntry } from '../../models/index.js';

export interface CreateCashEntryInput {
  entryDate: string;
  direction: 'inflow' | 'outflow';
  amount: number; // cents
  categoryId?: string | null;
  note?: string | null;
}

export interface CashEntryService {
  create(tenantId: string, input: CreateCashEntryInput): Promise<CashEntry>;
  list(tenantId: string): Promise<CashEntry[]>;
}
