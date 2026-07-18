/**
 * Parser adapter interfaces (see docs/architecture.md §5).
 *
 * Format-specific extraction lives behind these stable ports. Parsers return
 * plain data and never touch the database. Versioned ids (e.g. "fnb-csv-v2")
 * let old documents remember which parser produced them.
 */

export interface FileMeta {
  fileName: string;
  mimeType: string;
  byteSize: number;
}

export interface FileInput extends FileMeta {
  bytes: Uint8Array;
}

export interface Warning {
  code: string;
  message: string;
}

export interface ParseResult<T> {
  status: 'ok' | 'partial' | 'failed';
  data: T | null;
  warnings: Warning[];
  confidence: number;
}

export interface RawTransaction {
  txnDate: string;
  description: string;
  amount: number; // cents
  direction: 'debit' | 'credit';
  balanceAfter?: number | null;
  sourceRow?: number;
}

export interface RawPayslipComponent {
  componentType: 'earning' | 'deduction' | 'contribution' | 'allowance' | 'tax';
  section: string;
  label: string;
  amount: number; // cents
  confidence: number;
}

export interface RawPayslip {
  periodStart?: string;
  periodEnd?: string;
  periodLabel?: string;
  payDate?: string;
  notes?: string;
  grossAmount?: number;
  netAmount?: number;
  employer?: string;
  employee?: string;
  components: RawPayslipComponent[];
}

export interface StatementParser {
  readonly id: string;
  /** Confidence in [0,1] that this parser can handle the file (0 = cannot). */
  canParse(file: FileMeta): number;
  parse(file: FileInput): ParseResult<RawTransaction[]>;
}

export interface PayslipParser {
  readonly id: string;
  canParse(file: FileMeta): number;
  parse(file: FileInput): ParseResult<RawPayslip>;
}
