/**
 * Cash entry list.
 */
import { formatZar } from '../../utils/money.js';
import type { CashEntry } from '../../services/cashService.js';

interface Props {
  entries: CashEntry[];
  categoryNames: Record<string, string>;
}

export function CashEntryTable({ entries, categoryNames }: Props) {
  if (entries.length === 0) return <p><small>No cash entries yet.</small></p>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>Date</th>
          <th style={{ textAlign: 'left' }}>Direction</th>
          <th style={{ textAlign: 'left' }}>Category</th>
          <th style={{ textAlign: 'left' }}>Note</th>
          <th style={{ textAlign: 'right' }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id} style={{ borderTop: '1px solid #eee' }}>
            <td>{e.entryDate}</td>
            <td>{e.direction}</td>
            <td>{e.categoryId ? categoryNames[e.categoryId] ?? '—' : <em style={{ color: '#9ca3af' }}>Uncategorized</em>}</td>
            <td>{e.note}</td>
            <td style={{ textAlign: 'right', color: e.direction === 'outflow' ? '#b91c1c' : '#15803d' }}>
              {e.direction === 'outflow' ? '−' : '+'}{formatZar(e.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
