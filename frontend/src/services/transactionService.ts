/**
 * Transaction local data access. Calls the on-device transactionService
 * directly.
 */
import { getContainer } from '../local/container.js';

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
  const { transactionService, tenantId } = await getContainer();
  const transactions = await transactionService.list(tenantId);
  return transactions as unknown as TransactionDto[];
}

export async function filterTransactions(criteria: TransactionFilterCriteria): Promise<TransactionDto[]> {
  const { transactionService, tenantId } = await getContainer();
  const transactions = await transactionService.filter(tenantId, criteria);
  return transactions as unknown as TransactionDto[];
}
