/**
 * Breakdown of a single slip: gross, net, and components grouped by type
 * (docs/requirements.md F1).
 */
import { formatZar } from '../../utils/money.js';
import type { SalaryComponent, SalarySlip } from '../../services/salaryService.js';

interface Props {
  slip: SalarySlip;
  components: SalaryComponent[];
}

const GROUP_LABELS: Record<string, string> = {
  earning: 'Earnings',
  allowance: 'Allowances',
  deduction: 'Deductions',
  tax: 'Tax',
  contribution: 'Contributions',
};

export function SalaryBreakdownCard({ slip, components }: Props) {
  const groups = Object.keys(GROUP_LABELS).filter((g) => components.some((c) => c.componentType === g));

  return (
    <div className="dm-card" style={{ maxWidth: 480 }}>
      <h3 style={{ marginTop: 0 }}>
        {slip.periodStart} → {slip.periodEnd}
      </h3>
      {(slip.employerName || slip.employeeName) && (
        <div style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginBottom: '0.6rem' }}>
          {slip.employerName && <span>Employer: {slip.employerName}</span>}
          {slip.employerName && slip.employeeName && <span> · </span>}
          {slip.employeeName && <span>Employee: {slip.employeeName}</span>}
        </div>
      )}
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.75rem' }}>
        <div><strong>Gross</strong><div>{formatZar(slip.grossAmount)}</div></div>
        <div><strong>Net</strong><div>{formatZar(slip.netAmount)}</div></div>
      </div>

      {groups.map((group) => (
        <div key={group} style={{ marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 600 }}>{GROUP_LABELS[group]}</div>
          <table style={{ width: '100%' }}>
            <tbody>
              {components
                .filter((c) => c.componentType === group)
                .map((c) => (
                  <tr key={c.id}>
                    <td>{c.label}</td>
                    <td style={{ textAlign: 'right' }}>{formatZar(c.amount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}

      {components.length === 0 && <p><small>No line items were identified.</small></p>}
    </div>
  );
}
