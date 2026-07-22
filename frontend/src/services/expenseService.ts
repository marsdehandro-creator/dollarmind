/**
 * Manual expense local data access. Amounts are integer cents. Calls the
 * on-device manualExpenseService directly.
 */
import { getContainer } from '../local/container.js';

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
  const { manualExpenseService, tenantId } = await getContainer();
  const expenses = await manualExpenseService.list(tenantId);
  return expenses as unknown as ManualExpense[];
}

export async function createExpense(input: CreateExpenseInput): Promise<{ expense: ManualExpense }> {
  const { manualExpenseService, tenantId } = await getContainer();
  const expense = await manualExpenseService.create(tenantId, input);
  return { expense: expense as unknown as ManualExpense };
}

export async function updateExpense(
  id: string,
  patch: Partial<CreateExpenseInput>,
): Promise<{ expense: ManualExpense }> {
  const { manualExpenseService, tenantId } = await getContainer();
  const expense = await manualExpenseService.update(tenantId, id, patch);
  return { expense: expense as unknown as ManualExpense };
}

export async function deleteExpense(id: string): Promise<{ ok: boolean }> {
  const { manualExpenseService, tenantId } = await getContainer();
  await manualExpenseService.delete(tenantId, id);
  return { ok: true };
}
