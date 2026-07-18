/**
 * Manual expense API client. Amounts are integer cents.
 */
import { apiGet, apiPost } from './apiClient.js';

export interface ManualExpense {
  id: string;
  txnDate: string;
  amount: number; // cents
  categoryId: string | null;
  note: string | null;
}

export interface CreateExpenseInput {
  txnDate: string;
  amount: number;
  categoryId?: string | null;
  note?: string | null;
}

export async function listExpenses(): Promise<ManualExpense[]> {
  const { expenses } = await apiGet<{ expenses: ManualExpense[] }>('/expenses/list');
  return expenses;
}

export function createExpense(input: CreateExpenseInput): Promise<{ expense: ManualExpense }> {
  return apiPost('/expenses/create', input);
}

export function updateExpense(id: string, patch: Partial<CreateExpenseInput>): Promise<{ expense: ManualExpense }> {
  return apiPost('/expenses/update', { id, ...patch });
}

export function deleteExpense(id: string): Promise<{ ok: boolean }> {
  return apiPost('/expenses/delete', { id });
}
