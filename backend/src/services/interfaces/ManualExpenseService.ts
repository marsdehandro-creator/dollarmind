/**
 * ManualExpenseService port (docs/requirements.md F6).
 */
import type { ManualExpense } from '../../models/index.js';

export interface CreateExpenseInput {
  txnDate: string;
  amount: number; // cents
  categoryId?: string | null;
  note?: string | null;
}

export interface UpdateExpenseInput {
  txnDate?: string;
  amount?: number;
  categoryId?: string | null;
  note?: string | null;
}

export interface ManualExpenseService {
  create(tenantId: string, input: CreateExpenseInput): Promise<ManualExpense>;
  update(tenantId: string, id: string, patch: UpdateExpenseInput): Promise<ManualExpense>;
  delete(tenantId: string, id: string): Promise<void>;
  list(tenantId: string): Promise<ManualExpense[]>;
}
