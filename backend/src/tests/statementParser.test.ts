/**
 * Statement parser tests (pure): CSV + whitespace/delimited tables, date
 * coercion, bank detection, and business errors.
 */
import { describe, it, expect } from 'vitest';
import { parseStatementText, toIsoDate, type StatementParserRules } from '../parsers/bank/statementParser.js';
import { IngestError } from '../utils/ingestErrors.js';

const rules: StatementParserRules = {
  csv: {
    columns: {
      date: ['date'],
      description: ['description'],
      amount: ['amount'],
      debit: ['debit'],
      credit: ['credit'],
      balance: ['balance'],
    },
    dateFormats: ['yyyy-mm-dd', 'dd/mm/yyyy'],
  },
};

const CSV = `Date,Description,Amount,Balance
2026-06-01,WOOLWORTHS SANDTON,-350.00,10000.00
2026-06-02,SALARY ACME,45000.00,55000.00
2026-06-03,UBER TRIP,-120.50,54879.50`;

// FNB-style whitespace/fixed-width statement (as extracted from PDF/TXT).
const TXT = `FNB Cheque Account Statement
2026-06-01   WOOLWORTHS SANDTON        -350.00     10000.00
2026-06-02   SALARY ACME              45000.00     55000.00
2026-06-03   UBER TRIP                 -120.50     54879.50`;

describe('toIsoDate', () => {
  it('coerces common formats', () => {
    expect(toIsoDate('2026-06-01')).toBe('2026-06-01');
    expect(toIsoDate('01/06/2026')).toBe('2026-06-01');
    expect(toIsoDate('01-06-2026')).toBe('2026-06-01');
  });
});

describe('parseStatementText (CSV)', () => {
  it('parses rows and direction from signed amount', () => {
    const res = parseStatementText(CSV, rules);
    expect(res.shape).toBe('csv');
    expect(res.data).toHaveLength(3);
    const [woolies, salary] = res.data!;
    expect(woolies.amount).toBe(35000);
    expect(woolies.direction).toBe('debit');
    expect(salary.amount).toBe(4500000);
    expect(salary.direction).toBe('credit');
  });
});

describe('parseStatementText (whitespace/delimited)', () => {
  it('reconstructs a fixed-width table and detects the bank', () => {
    const res = parseStatementText(TXT, rules);
    expect(res.shape).toBe('delimited');
    expect(res.bank).toBe('FNB');
    expect(res.data!.length).toBe(3);
    const salary = res.data!.find((r) => r.description.includes('SALARY'));
    expect(salary?.direction).toBe('credit');
    expect(salary?.amount).toBe(4500000);
  });
});

describe('business errors', () => {
  it('raises FORMAT_UNRECOGNIZED for unreadable text', () => {
    try {
      parseStatementText('just some prose with no table at all', rules);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(IngestError);
      expect((e as IngestError).code).toBe('FORMAT_UNRECOGNIZED');
      expect((e as IngestError).status).toBe(400);
    }
  });
});
