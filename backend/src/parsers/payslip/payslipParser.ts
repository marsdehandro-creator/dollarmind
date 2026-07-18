/**
 * Payslip parsing pipeline (Phase 17 — dynamic, section-aware).
 *
 * Instead of forcing fixed component buckets, the parser detects section
 * headers (EARNINGS, DEDUCTIONS, COMPANY CONTRIBUTIONS, …) and groups the
 * label/amount rows that follow, preserving the document's original order and
 * grouping. Unknown sections and field names are kept as-is. Metadata
 * (employer, employee, period, pay date, notes) and gross/net are also
 * detected for the summary header.
 */
import type { FileInput, ParseResult, RawPayslip, RawPayslipComponent, Warning } from '../types.js';
import { toCents } from '../../utils/money.js';
import { detectEmployer } from '../../ingestion/formatDetect.js';

export interface SalaryParserRules {
  fields: { gross: string[]; net: string[] };
  components: Array<{
    code: string;
    componentType: RawPayslipComponent['componentType'];
    isTaxable?: boolean;
    labels: string[];
  }>;
}

export interface ExtractResult {
  text: string;
  warnings: Warning[];
}

const TEXT_MIME = /^(text\/|application\/csv)/i;

/** Section header keywords (matched case-insensitively). */
const HEADER_TERMS = [
  'earnings', 'income', 'deductions', 'contributions', 'company contributions',
  'reimbursements', 'allowances', 'benefits', 'fringe benefits', 'taxes', 'summary',
];

/** Metadata field labels (skipped from sections; used for the header). */
const META_TERMS = ['employee', 'employer', 'name', 'pay period', 'period', 'pay date', 'date paid',
  'payment date', 'notes', 'note', 'comments', 'company', 'department', 'id number', 'employee number'];

/** Stage 1: get raw text out of the uploaded file (kept for compatibility). */
export function extractText(file: FileInput): ExtractResult {
  const isText = TEXT_MIME.test(file.mimeType) || /\.(txt|csv)$/i.test(file.fileName);
  if (isText) return { text: Buffer.from(file.bytes).toString('utf-8'), warnings: [] };
  return { text: '', warnings: [{ code: 'binary_extraction_unsupported', message: 'PDF/image extraction happens in the ingestion layer.' }] };
}

/** Extract the last money-like number on a line, in cents. */
export function extractAmount(line: string): number | null {
  const matches = line.match(/\d{1,3}(?:[ ,]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1].replace(/[ ,]/g, '');
  const cents = toCents(last);
  return Number.isFinite(cents) ? cents : null;
}

function findLabeledAmount(lines: string[], labels: string[]): number | undefined {
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (labels.some((label) => lower.includes(label))) {
      const amount = extractAmount(line);
      if (amount !== null) return amount;
    }
  }
  return undefined;
}

function findLabelledValue(lines: string[], labels: string[]): string | undefined {
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (labels.some((l) => lower.includes(l)) && line.includes(':')) {
      const val = line.split(':').slice(1).join(':').trim();
      if (val) return val;
    }
  }
  return undefined;
}

function findPeriod(text: string): { start?: string; end?: string } {
  const dates = text.match(/\d{4}-\d{2}-\d{2}/g);
  if (dates && dates.length >= 2) return { start: dates[0], end: dates[1] };
  return {};
}

function isMetadataLine(line: string): boolean {
  if (!line.includes(':')) return false;
  const lower = line.toLowerCase();
  return META_TERMS.some((t) => lower.startsWith(t) || lower.includes(`${t}:`));
}

function isKnownHeaderTerm(line: string): boolean {
  const lower = line.trim().toLowerCase();
  return HEADER_TERMS.some((t) => lower === t || lower.startsWith(`${t} `) || lower.endsWith(` ${t}`));
}

function isSectionHeader(line: string): boolean {
  if (extractAmount(line) !== null) return false; // has an amount → an item, not a header
  if (line.includes(':')) return false; // metadata
  if (isKnownHeaderTerm(line)) return true;
  // Heuristic: short ALL-CAPS heading, but not a company name (suffixes excluded).
  const t = line.trim();
  if (/\b(pty|ltd|cc|inc|limited)\b/i.test(t)) return false;
  const words = t.split(/\s+/);
  return words.length <= 5 && t.length <= 40 && /^[A-Z0-9][A-Za-z0-9 &/()\-]*$/.test(t) && t === t.toUpperCase();
}

function inferSectionByKeyword(label: string): string {
  const l = label.toLowerCase();
  if (/(paye|tax|uif|deduct|loan|garnish)/.test(l)) return 'Deductions';
  if (/(pension|provident|retirement|contribution)/.test(l)) return 'Contributions';
  if (/(allowance|reimburs|benefit)/.test(l)) return 'Allowances';
  return 'Earnings';
}

function inferType(section: string, label: string): RawPayslipComponent['componentType'] {
  const l = label.toLowerCase();
  if (/(paye|tax)/.test(l)) return 'tax';
  if (/(uif|deduct|loan|garnish|medical)/.test(l)) return 'deduction';
  if (/(pension|provident|retirement)/.test(l)) return 'contribution';
  if (/(allowance|reimburs|benefit)/.test(l)) return 'allowance';
  const s = section.toLowerCase();
  if (s.includes('deduction') || s.includes('tax')) return 'deduction';
  if (s.includes('contribution')) return 'contribution';
  if (s.includes('allowance') || s.includes('reimburs') || s.includes('benefit')) return 'allowance';
  return 'earning';
}

function cleanLabel(line: string): string {
  return line.replace(/[R\s]*-?\(?[\d ,]+(?:\.\d{1,2})?\)?\s*$/, '').replace(/[:.]$/, '').trim();
}

/** Stages 2-3: normalize + section-aware identify. Pure function. */
export function parsePayslipText(text: string, rules: SalaryParserRules): ParseResult<RawPayslip> {
  const warnings: Warning[] = [];
  const trimmed = text.trim();
  if (!trimmed) return { status: 'failed', data: null, warnings, confidence: 0 };

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const grossAmount = findLabeledAmount(lines, rules.fields.gross);
  const netAmount = findLabeledAmount(lines, rules.fields.net);
  const grossNetLabels = [...rules.fields.gross, ...rules.fields.net];

  let employer = detectEmployer(trimmed) ?? undefined;
  const employee = findLabelledValue(lines, ['employee', 'name']);
  const periodLabel = findLabelledValue(lines, ['pay period', 'period', 'month']);
  const payDate = findLabelledValue(lines, ['pay date', 'date paid', 'payment date']);
  const notes = findLabelledValue(lines, ['notes', 'note', 'comments']);
  const { start, end } = findPeriod(trimmed);

  const components: RawPayslipComponent[] = [];
  let currentSection: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // The first line is the employer/title (metadata), unless it's a real header.
    if (i === 0 && !isKnownHeaderTerm(line)) {
      if (!employer && !line.includes(':') && extractAmount(line) === null && line.length <= 60) employer = line;
      continue;
    }
    if (isMetadataLine(line)) continue;
    if (isSectionHeader(line)) {
      currentSection = line.trim();
      continue;
    }
    const amount = extractAmount(line);
    if (amount === null) continue; // non-item text
    const lower = line.toLowerCase();
    // Gross/net go to the summary, not a line item (avoid duplication).
    if (grossNetLabels.some((l) => lower.includes(l))) continue;

    const label = cleanLabel(line) || 'Item';
    const section = currentSection ?? inferSectionByKeyword(label);
    components.push({ section, componentType: inferType(section, label), label, amount, confidence: 0.8 });
  }

  let confidence = 0.4;
  if (grossAmount !== undefined) confidence += 0.3;
  if (netAmount !== undefined) confidence += 0.3;
  const status: ParseResult<RawPayslip>['status'] =
    grossAmount !== undefined && netAmount !== undefined ? 'ok' : 'partial';
  if (grossAmount === undefined) warnings.push({ code: 'missing_gross', message: 'Gross pay not found' });
  if (netAmount === undefined) warnings.push({ code: 'missing_net', message: 'Net pay not found' });

  return {
    status,
    data: {
      periodStart: start,
      periodEnd: end,
      periodLabel,
      payDate,
      notes,
      grossAmount,
      netAmount,
      employer,
      employee,
      components,
    },
    warnings,
    confidence: Math.min(confidence, 1),
  };
}
