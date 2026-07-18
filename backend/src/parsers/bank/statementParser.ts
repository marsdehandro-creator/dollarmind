/**
 * Bank statement parsing (Section 6). Works on already-extracted text (CSV,
 * TXT, or PDF-extracted). Handles comma-separated and whitespace/fixed-width
 * tables, wrapped descriptions, running balances, bank detection, and a large-
 * dataset guard. Raises business errors on unrecoverable failures.
 */
import type { ParseResult, RawTransaction, Warning } from '../types.js';
import { toCents } from '../../utils/money.js';
import { ingestError } from '../../utils/ingestErrors.js';
import { detectBank, detectTableShape } from '../../ingestion/formatDetect.js';
import { joinWrappedLines, normalizeText, splitColumns } from '../../ingestion/normalize.js';

export interface StatementParserRules {
  csv: {
    columns: {
      date: string[];
      description: string[];
      amount: string[];
      debit: string[];
      credit: string[];
      balance: string[];
    };
    dateFormats: string[];
  };
}

/** Hard cap so a runaway/huge file returns a clean business error, not a hang. */
const MAX_ROWS = 60_000;

const DATE_RE = /(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})/;

/** A single token that is a money value (optional R, thousands, decimals, parens=negative). */
function isMoneyToken(tok: string): boolean {
  const t = tok.trim();
  return /\d/.test(t) && /^-?\(?\s*R?\s*[\d ,]+(?:\.\d{1,2})?\)?$/.test(t);
}

export interface StatementParseResult extends ParseResult<RawTransaction[]> {
  bank: string | null;
  shape: 'csv' | 'delimited' | 'unknown';
}

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function toIsoDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function moneyToCents(token: string): number {
  const negative = /^-|^\(/.test(token.trim());
  const cents = toCents(token.replace(/[()]/g, ''));
  return negative && cents > 0 ? -cents : cents;
}

function matchColumn(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const cand of candidates) {
    const idx = lower.indexOf(cand.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function toRow(isoDate: string, description: string, amountCents: number, balance: number | null, rowNo: number): RawTransaction {
  return {
    txnDate: isoDate,
    description: description.trim(),
    amount: Math.abs(amountCents),
    direction: amountCents < 0 ? 'debit' : 'credit',
    balanceAfter: balance,
    sourceRow: rowNo,
  };
}

function parseCsv(lines: string[], rules: StatementParserRules, warnings: Warning[]): RawTransaction[] {
  const headers = splitCsvLine(lines[0]);
  const cols = rules.csv.columns;
  const dateIdx = matchColumn(headers, cols.date);
  const descIdx = matchColumn(headers, cols.description);
  const amountIdx = matchColumn(headers, cols.amount);
  const debitIdx = matchColumn(headers, cols.debit);
  const creditIdx = matchColumn(headers, cols.credit);
  const balanceIdx = matchColumn(headers, cols.balance);

  if (dateIdx < 0 || descIdx < 0 || (amountIdx < 0 && debitIdx < 0 && creditIdx < 0)) {
    throw ingestError('COLUMN_LAYOUT_UNSUPPORTED', {
      message: 'Could not map the required columns (date, description, amount) in this CSV.',
    });
  }

  const rows: RawTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const iso = toIsoDate(cells[dateIdx] ?? '');
    const description = (cells[descIdx] ?? '').trim();
    if (!iso || !description) { warnings.push({ code: 'skipped_row', message: `Row ${i + 1} skipped (missing date/description)` }); continue; }

    let amount: number | null = null;
    const debitVal = debitIdx >= 0 ? moneyToCents(cells[debitIdx] || '0') : 0;
    const creditVal = creditIdx >= 0 ? moneyToCents(cells[creditIdx] || '0') : 0;
    if (debitVal !== 0) amount = -Math.abs(debitVal);
    else if (creditVal !== 0) amount = Math.abs(creditVal);
    else if (amountIdx >= 0) amount = moneyToCents(cells[amountIdx] || '0');

    if (amount === null || amount === 0) { warnings.push({ code: 'skipped_row', message: `Row ${i + 1} skipped (no amount)` }); continue; }
    const balance = balanceIdx >= 0 && cells[balanceIdx] ? Math.abs(moneyToCents(cells[balanceIdx])) : null;
    rows.push(toRow(iso, description, amount, balance, i + 1));
  }
  return rows;
}

/** Whitespace / fixed-width / PDF-extracted table rows: date … description … amount [balance]. */
function parseDelimited(lines: string[], warnings: Warning[]): RawTransaction[] {
  const startsRow = (l: string) => DATE_RE.test(l.slice(0, 12));
  const joined = joinWrappedLines(lines, startsRow);
  const rows: RawTransaction[] = [];

  joined.forEach((line, idx) => {
    if (!startsRow(line)) return;
    const cols = splitColumns(line);
    const dateCol = cols.find((c) => DATE_RE.test(c));
    const iso = dateCol ? toIsoDate((dateCol.match(DATE_RE) ?? [])[0] ?? dateCol) : null;
    if (!iso) return;

    const moneyCols = cols.filter(isMoneyToken);
    if (moneyCols.length === 0) { warnings.push({ code: 'skipped_row', message: `Line ${idx + 1} skipped (no amount)` }); return; }
    // Convention: last money column is the running balance, the one before it the amount.
    const amount = moneyToCents(moneyCols[moneyCols.length - (moneyCols.length >= 2 ? 2 : 1)]);
    const balance = moneyCols.length >= 2 ? Math.abs(moneyToCents(moneyCols[moneyCols.length - 1])) : null;
    if (amount === 0) return;

    const description = cols.filter((c) => c !== dateCol && !isMoneyToken(c)).join(' ').trim();
    rows.push(toRow(iso, description || 'Transaction', amount, balance, idx + 1));
  });
  return rows;
}

/**
 * Parse extracted statement text into transactions.
 * @param text  raw extracted text (CSV, TXT, or from a PDF)
 * @param rules CSV column mapping rules
 */
export function parseStatementText(text: string, rules: StatementParserRules): StatementParseResult {
  const warnings: Warning[] = [];
  const normalized = normalizeText(text);
  const bank = detectBank(normalized);
  const allLines = normalized.split('\n').filter((l) => l.trim().length > 0);

  if (allLines.length > MAX_ROWS) {
    throw ingestError('DATASET_TOO_LARGE', { message: `This file has ${allLines.length} lines, above the ${MAX_ROWS} limit.` });
  }

  const shape = detectTableShape(normalized);
  let rows: RawTransaction[];
  if (shape === 'csv') rows = parseCsv(allLines, rules, warnings);
  else if (shape === 'delimited') rows = parseDelimited(allLines, warnings);
  else throw ingestError('FORMAT_UNRECOGNIZED');

  if (rows.length === 0) {
    throw ingestError('FORMAT_UNRECOGNIZED', {
      message: 'No transactions could be read from this file.',
      suggestion: 'Make sure the export includes date, description and amount columns.',
    });
  }

  return {
    status: warnings.length > 0 ? 'partial' : 'ok',
    data: rows,
    warnings,
    confidence: warnings.length > 0 ? 0.7 : 1,
    bank,
    shape,
  };
}
