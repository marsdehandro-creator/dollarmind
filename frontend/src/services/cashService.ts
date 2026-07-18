/**
 * Cash entry API client. Amounts are integer cents.
 */
import { apiGet, apiPost } from './apiClient.js';

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
  const { entries } = await apiGet<{ entries: CashEntry[] }>('/cash/list');
  return entries;
}

export function createCashEntry(input: CreateCashEntryInput): Promise<{ entry: CashEntry }> {
  return apiPost('/cash/create', input);
}
