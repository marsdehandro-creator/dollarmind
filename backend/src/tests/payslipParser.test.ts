/**
 * Payslip parser tests (pure — no DB). Validates text extraction of gross, net,
 * and components using an inline rule set.
 */
import { describe, it, expect } from 'vitest';
import { extractAmount, parsePayslipText, type SalaryParserRules } from '../parsers/payslip/payslipParser.js';

const rules: SalaryParserRules = {
  fields: {
    gross: ['gross pay', 'gross'],
    net: ['net pay', 'net'],
  },
  components: [
    { code: 'basic', componentType: 'earning', labels: ['basic salary', 'basic'] },
    { code: 'paye', componentType: 'tax', labels: ['paye', 'tax'] },
    { code: 'uif', componentType: 'deduction', labels: ['uif'] },
    { code: 'pension', componentType: 'contribution', labels: ['pension'] },
  ],
};

const SAMPLE = `ACME Payroll
Pay Period: 2026-06-01 to 2026-06-30
Basic Salary        45000.00
Gross Pay           45000.00
PAYE                 9000.00
UIF                   177.12
Pension              2250.00
Net Pay             33572.88
`;

describe('extractAmount', () => {
  it('parses the last money value on a line into cents', () => {
    expect(extractAmount('UIF 177.12')).toBe(17712);
    expect(extractAmount('Gross Pay 45,000.00')).toBe(4500000);
    expect(extractAmount('no numbers here')).toBeNull();
  });
});

describe('parsePayslipText', () => {
  it('extracts gross, net, period, and components', () => {
    const result = parsePayslipText(SAMPLE, rules);
    expect(result.status).toBe('ok');
    expect(result.data?.grossAmount).toBe(4500000);
    expect(result.data?.netAmount).toBe(3357288);
    expect(result.data?.periodStart).toBe('2026-06-01');
    expect(result.data?.periodEnd).toBe('2026-06-30');

    const types = (result.data?.components ?? []).map((c) => c.componentType);
    expect(types).toContain('earning');
    expect(types).toContain('tax');
    expect(types).toContain('deduction');
    expect(types).toContain('contribution');
  });

  it('reports failure on empty text', () => {
    const result = parsePayslipText('   ', rules);
    expect(result.status).toBe('failed');
    expect(result.confidence).toBe(0);
  });

  it('is partial when net is missing', () => {
    const result = parsePayslipText('Gross Pay 1000.00', rules);
    expect(result.status).toBe('partial');
  });
});
