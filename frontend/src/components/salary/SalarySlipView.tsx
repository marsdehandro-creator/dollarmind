/**
 * Dynamic salary-slip view (Phase 17). Renders whatever sections the parser
 * detected — no hard-coded field names — preserving document order, with a
 * metadata header, per-section tables, totals, a parsing-status badge, and a
 * print/PDF button.
 */
import { formatZar } from '../../utils/money.js';
import type { SalaryComponent, SalarySlip } from '../../services/salaryService.js';

interface Props {
  slip: SalarySlip;
  components: SalaryComponent[];
  parseStatus?: 'ok' | 'partial' | 'failed';
}

/** Group components into sections, preserving first-seen order + item order. */
function groupSections(components: SalaryComponent[]): Array<{ title: string; items: SalaryComponent[] }> {
  const ordered = [...components].sort((a, b) => a.displayOrder - b.displayOrder);
  const map = new Map<string, SalaryComponent[]>();
  for (const c of ordered) {
    const title = c.section || 'Other';
    if (!map.has(title)) map.set(title, []);
    map.get(title)!.push(c);
  }
  return [...map.entries()].map(([title, items]) => ({ title, items }));
}

export function SalarySlipView({ slip, components, parseStatus }: Props) {
  const sections = groupSections(components);
  const period = slip.periodLabel || `${slip.periodStart} → ${slip.periodEnd}`;
  const deductions = slip.grossAmount - slip.netAmount;
  const clean = parseStatus === 'ok';

  return (
    <div className="dm-card" style={{ maxWidth: 560 }}>
      {/* Metadata header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          {slip.employerName && <div style={{ fontWeight: 700 }}>{slip.employerName}</div>}
          {slip.employeeName && <div style={{ color: 'var(--fg-muted)' }}>{slip.employeeName}</div>}
          <div style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>
            {period}{slip.payDate ? ` · paid ${slip.payDate}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
          {parseStatus && (
            <span className="dm-badge" style={{ color: clean ? 'var(--success)' : 'var(--gold)', borderColor: clean ? 'var(--success)' : 'var(--gold)' }}>
              {clean ? 'Parsed cleanly' : 'Parsing issues'}
            </span>
          )}
          <button type="button" onClick={() => window.print()}>Download as PDF</button>
        </div>
      </div>

      {/* Dynamic sections */}
      {sections.map((section) => (
        <div key={section.title} style={{ marginTop: '1rem' }}>
          <h4 style={{ margin: '0 0 0.3rem', borderBottom: '1px solid var(--border-metal)', paddingBottom: 4 }}>{section.title}</h4>
          <table style={{ width: '100%' }}>
            <tbody>
              {section.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.label}</td>
                  <td style={{ textAlign: 'right' }}>{formatZar(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Totals */}
      <div style={{ marginTop: '1.1rem', borderTop: '2px solid var(--border-metal)', paddingTop: '0.6rem', display: 'grid', gap: '0.3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Gross</strong><span>{formatZar(slip.grossAmount)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-muted)' }}><span>Total deductions</span><span>{formatZar(deductions)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem' }}><strong>Net pay</strong><strong style={{ color: 'var(--success)' }}>{formatZar(slip.netAmount)}</strong></div>
      </div>

      {slip.notes && <p style={{ marginTop: '0.8rem', color: 'var(--fg-muted)', fontSize: '0.85rem' }}>📝 {slip.notes}</p>}
    </div>
  );
}
