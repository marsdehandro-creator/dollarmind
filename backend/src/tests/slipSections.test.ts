/**
 * Dynamic section-aware payslip parsing (Phase 17).
 */
import { describe, it, expect } from 'vitest';
import { parsePayslipText, type SalaryParserRules } from '../parsers/payslip/payslipParser.js';

const rules: SalaryParserRules = {
  fields: { gross: ['gross pay', 'gross'], net: ['net pay', 'net'] },
  components: [],
};

const NOVA = `NOVA TECH SYSTEMS (PTY) LTD
Employee: Johnathan Q. Testman
Pay Period: June 2024
Pay Date: 2024-06-25
Notes: Includes multiple fringe benefits.

EARNINGS
Basic Salary 52000.00
Housing Allowance 4500.00
Travel Allowance 3250.00
Gross Pay 75750.00

DEDUCTIONS
PAYE Tax 14800.00
UIF 177.12

COMPANY CONTRIBUTIONS
Pension Fund 5200.00
Medical Aid 3100.00

Net Pay 50177.00
`;

describe('parsePayslipText (sections)', () => {
  it('detects section headers and preserves order + grouping', () => {
    const res = parsePayslipText(NOVA, rules);
    expect(res.data).not.toBeNull();
    const d = res.data!;

    // metadata
    expect(d.employer?.toUpperCase()).toContain('NOVA TECH');
    expect(d.employee).toBe('Johnathan Q. Testman');
    expect(d.periodLabel).toBe('June 2024');
    expect(d.payDate).toBe('2024-06-25');
    expect(d.notes).toContain('fringe benefits');
    expect(d.grossAmount).toBe(7575000);
    expect(d.netAmount).toBe(5017700);

    // sections detected dynamically, in document order
    const sections = [...new Set(d.components.map((c) => c.section))];
    expect(sections).toEqual(['EARNINGS', 'DEDUCTIONS', 'COMPANY CONTRIBUTIONS']);

    // every non-gross/net line captured under its section
    const earnings = d.components.filter((c) => c.section === 'EARNINGS').map((c) => c.label);
    expect(earnings).toEqual(['Basic Salary', 'Housing Allowance', 'Travel Allowance']);
    const contributions = d.components.filter((c) => c.section === 'COMPANY CONTRIBUTIONS').map((c) => c.label);
    expect(contributions).toEqual(['Pension Fund', 'Medical Aid']);
  });

  it('groups by keyword when no headers are present', () => {
    const flat = `ACME
Basic Salary 30000.00
PAYE 6000.00
Net Pay 24000.00
Gross Pay 30000.00`;
    const res = parsePayslipText(flat, rules);
    const sections = new Set(res.data!.components.map((c) => c.section));
    expect(sections.has('Earnings')).toBe(true);
    expect(sections.has('Deductions')).toBe(true);
  });
});
