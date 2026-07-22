/**
 * Cash entry local data access. Amounts are integer cents. Calls the
 * on-device cashEntryService directly.
 */
import { getContainer } from '../local/container.js';

export interface CashEntry {
  id: string;
  entryDate: string;
  direction: 'inflow' | 'outflow';
  amount: number; // cents
  categoryId: string | null;
  note: string | null;
}

export interface CreateCashEntryInput {
  entryDate: string;
  direction: 'inflow' | 'outflow';
  amount: number;
  categoryId?: string | null;
  note?: string | null;
}

export async function listCashEntries(): Promise<CashEntry[]> {
  const { cashEntryService, tenantId } = await getContainer();
  const entries = await cashEntryService.list(tenantId);
  return entries as unknown as CashEntry[];
}

export async function createCashEntry(input: CreateCashEntryInput): Promise<{ entry: CashEntry }> {
  const { cashEntryService, tenantId } = await getContainer();
  const entry = await cashEntryService.create(tenantId, input);
  return { entry: entry as unknown as CashEntry };
}
