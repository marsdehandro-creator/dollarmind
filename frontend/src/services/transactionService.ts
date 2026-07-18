/**
 * Transaction API client.
 */
import { apiGet, apiPost } from './apiClient.js';

export interface TransactionDto {
  id: string;
  txnDate: string;
  descriptionRaw: string;
  amount: number; // cents
  direction: 'debit' | 'credit';
  balanceAfter: number | null;
  categoryId: string | null;
  merchant: string | null;
  confidence: number;
  flagged: boolean;
  dedupGroupId: string | null;
}

export interface TransactionFilterCriteria {
  dateFrom?: string;
  dateTo?: string;
  merchant?: string;
  amountMin?: number; // cents
  amountMax?: number; // cents
  direction?: 'debit' | 'credit';
  categoryId?: string;
}

export async function listTransactions(): Promise<TransactionDto[]> {
  const { transactions } = await apiGet<{ transactions: TransactionDto[] }>('/transactions/list');
  return transactions;
}

export async function filterTransactions(criteria: TransactionFilterCriteria): Promise<TransactionDto[]> {
  const { transactions } = await apiPost<{ transactions: TransactionDto[] }>('/transactions/filter', criteria);
  return transactions;
}
