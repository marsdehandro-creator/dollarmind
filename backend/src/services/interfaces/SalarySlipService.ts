/**
 * SalarySlipService port (docs/requirements.md F1).
 *
 * Orchestrates payslip ingestion: store file -> extract text -> parse ->
 * map to salary_slip + salary_component -> persist -> log parsing issues.
 */
import type { IssueLog, SalaryComponent, SalarySlip } from '../../models/index.js';
import type { RawPayslip } from '../../parsers/types.js';
import type { ParseResult } from '../../parsers/types.js';

export interface UploadedFile {
  buffer: Uint8Array;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface ParsedComponent {
  componentType: SalaryComponent['componentType'];
  section: string | null;
  code: string | null;
  label: string;
  amount: number;
  isTaxable: boolean | null;
  confidence: number;
}

export interface ParsedSlip {
  accountId: string;
  sourceDocumentId: string;
  periodStart: string;
  periodEnd: string;
  payDate?: string | null;
  grossAmount: number;
  netAmount: number;
  currency: string;
  employerName?: string | null;
  employeeName?: string | null;
  periodLabel?: string | null;
  notes?: string | null;
  components: ParsedComponent[];
}

export interface SlipWithComponents {
  slip: SalarySlip;
  components: SalaryComponent[];
}

export interface UploadResult extends SlipWithComponents {
  issues: IssueLog[];
  parseStatus: ParseResult<RawPayslip>['status'];
  confidence: number;
  warnings?: string[];
  source?: 'text' | 'pdf' | 'ocr';
  employer?: string | null;
  diagnostics?: string[];
}

export interface SalarySlipService {
  /** Full pipeline for an uploaded file. */
  uploadSlip(input: { tenantId: string; file: UploadedFile }): Promise<UploadResult>;

  /** Pure parse of already-extracted text. */
  parseSlip(rawText: string): ParseResult<RawPayslip>;

  /** Persist a parsed slip + its components (draft, unconfirmed). */
  saveSlip(tenantId: string, parsed: ParsedSlip): Promise<SlipWithComponents>;

  /** Slip history for a tenant, newest first, with components. */
  getSlipHistory(tenantId: string): Promise<SlipWithComponents[]>;
}
