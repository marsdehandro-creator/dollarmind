/**
 * Format detection (Section 9) — bank + employer signatures.
 * Best-effort keyword matching; drives diagnostics and parser hints.
 */
const BANK_SIGNATURES: Array<{ bank: string; keywords: string[] }> = [
  { bank: 'FNB', keywords: ['fnb', 'first national bank'] },
  { bank: 'Standard Bank', keywords: ['standard bank', 'standardbank'] },
  { bank: 'Absa', keywords: ['absa'] },
  { bank: 'Nedbank', keywords: ['nedbank'] },
  { bank: 'Capitec', keywords: ['capitec'] },
  { bank: 'TymeBank', keywords: ['tymebank', 'tyme bank'] },
  { bank: 'Discovery Bank', keywords: ['discovery bank'] },
];

const EMPLOYER_HINTS = ['payslip', 'salary advice', 'pay slip', 'remuneration', 'earnings', 'deductions'];

export function detectBank(text: string): string | null {
  const lower = text.toLowerCase();
  for (const sig of BANK_SIGNATURES) {
    if (sig.keywords.some((k) => lower.includes(k))) return sig.bank;
  }
  return null;
}

export function detectEmployer(text: string): string | null {
  const lower = text.toLowerCase();
  const isPayslip = EMPLOYER_HINTS.some((h) => lower.includes(h));
  if (!isPayslip) return null;
  // Employer name often on the first non-empty line of a payslip.
  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  return firstLine && firstLine.length <= 60 ? firstLine : null;
}

export type TableShape = 'csv' | 'delimited' | 'unknown';

/** Decide whether text is comma-separated or whitespace/fixed-width delimited. */
export function detectTableShape(text: string): TableShape {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return 'unknown';
  const commaLines = lines.filter((l) => (l.match(/,/g)?.length ?? 0) >= 2).length;
  if (commaLines / lines.length > 0.5) return 'csv';
  const dateLines = lines.filter((l) => /(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})/.test(l)).length;
  if (dateLines >= 1) return 'delimited';
  return 'unknown';
}
