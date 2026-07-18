/**
 * Bank statement API client.
 */
import { apiGet, apiUpload } from './apiClient.js';

export interface BankStatement {
  id: string;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  createdAt: string;
}

export interface StatementSummary {
  statement: BankStatement;
  transactionCount: number;
}

export interface StatementUploadResult {
  statement: BankStatement | null;
  imported: number;
  duplicatesSkipped: number;
  possibleDuplicates: number;
  parseStatus: 'ok' | 'partial' | 'failed';
  fileAlreadyImported: boolean;
  issues: Array<{ id: string; kind: string; severity: string; detail: unknown }>;
  bank?: string | null;
  source?: 'text' | 'pdf' | 'ocr';
  warnings?: string[];
  diagnostics?: string[];
}

export function uploadStatement(file: File): Promise<StatementUploadResult> {
  const form = new FormData();
  form.append('file', file);
  return apiUpload<StatementUploadResult>('/statements/upload', form);
}

export function getStatementHistory(): Promise<{ statements: StatementSummary[] }> {
  return apiGet<{ statements: StatementSummary[] }>('/statements/history');
}

export interface StatementTransaction {
  id: string;
  txnDate: string;
  descriptionRaw: string;
  merchant: string | null;
  amount: number;
  direction: 'debit' | 'credit';
  balanceAfter: number | null;
  flagged: boolean;
}

export interface StatementDetail {
  statement: BankStatement;
  transactions: StatementTransaction[];
  totals: { income: number; expense: number; count: number };
}

export function getStatementDetail(id: string): Promise<StatementDetail> {
  return apiGet<StatementDetail>(`/statements/${id}`);
}
