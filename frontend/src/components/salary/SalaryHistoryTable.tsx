/**
 * List of previously uploaded slips. Selecting a row surfaces its breakdown.
 */
import { formatZar } from '../../utils/money.js';
import type { SlipWithComponents } from '../../services/salaryService.js';

interface Props {
  slips: SlipWithComponents[];
  onSelect: (slip: SlipWithComponents) => void;
}

export function SalaryHistoryTable({ slips, onSelect }: Props) {
  if (slips.length === 0) {
    return <p><small>No slips uploaded yet.</small></p>;
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>Period</th>
          <th style={{ textAlign: 'right' }}>Gross</th>
          <th style={{ textAlign: 'right' }}>Net</th>
          <th style={{ textAlign: 'left' }}>Uploaded</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {slips.map(({ slip, components }) => (
          <tr key={slip.id} style={{ borderTop: '1px solid #eee' }}>
            <td>{slip.periodStart} → {slip.periodEnd}</td>
            <td style={{ textAlign: 'right' }}>{formatZar(slip.grossAmount)}</td>
            <td style={{ textAlign: 'right' }}>{formatZar(slip.netAmount)}</td>
            <td>{new Date(slip.createdAt).toLocaleDateString('en-ZA')}</td>
            <td>
              <button type="button" onClick={() => onSelect({ slip, components })}>View</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
