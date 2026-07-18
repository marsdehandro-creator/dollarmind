/**
 * StatementImportService port (docs/requirements.md F2, F4).
 *
 * Orchestrates: store file -> parse -> normalize -> deduplicate -> persist ->
 * log issues.
 */
import type { BankStatement, IssueLog, Transaction } from '../../models/index.js';
import type { UploadedFile } from './SalarySlipService.js';

export interface StatementUploadResult {
  statement: BankStatement | null;
  imported: number;
  duplicatesSkipped: number;
  possibleDuplicates: number;
  parseStatus: 'ok' | 'partial' | 'failed';
  fileAlreadyImported: boolean;
  issues: IssueLog[];
  bank?: string | null;
  source?: 'text' | 'pdf' | 'ocr';
  warnings?: string[];
  diagnostics?: string[];
}

export interface StatementSummary {
  statement: BankStatement;
  transactionCount: number;
}

export interface StatementDetail {
  statement: BankStatement;
  transactions: Transaction[];
  totals: { income: number; expense: number; count: number };
}

export interface StatementImportService {
  uploadStatement(input: { tenantId: string; file: UploadedFile }): Promise<StatementUploadResult>;
  getStatementHistory(tenantId: string): Promise<StatementSummary[]>;
  getStatementDetail(tenantId: string, statementId: string): Promise<StatementDetail>;
}
