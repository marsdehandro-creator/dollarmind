/**
 * Bank statement local data access. Calls the on-device
 * statementImportService directly — same shapes the backend used to return.
 */
import { getContainer } from '../local/container.js';

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

export async function uploadStatement(file: File): Promise<StatementUploadResult> {
  const { statementImportService, tenantId } = await getContainer();
  const buffer = new Uint8Array(await file.arrayBuffer());
  const result = await statementImportService.uploadStatement({
    tenantId,
    file: { buffer, originalName: file.name, mimeType: file.type || 'application/octet-stream', size: file.size },
  });
  return result as unknown as StatementUploadResult;
}

export async function getStatementHistory(): Promise<{ statements: StatementSummary[] }> {
  const { statementImportService, tenantId } = await getContainer();
  const statements = await statementImportService.getStatementHistory(tenantId);
  return { statements: statements as unknown as StatementSummary[] };
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

export async function getStatementDetail(id: string): Promise<StatementDetail> {
  const { statementImportService, tenantId } = await getContainer();
  const detail = await statementImportService.getStatementDetail(tenantId, id);
  return detail as unknown as StatementDetail;
}
