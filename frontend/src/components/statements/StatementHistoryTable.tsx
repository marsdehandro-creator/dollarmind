/**
 * List of previously uploaded statements.
 */
import type { StatementSummary } from '../../services/statementService.js';

interface Props {
  statements: StatementSummary[];
  onSelect?: (id: string) => void;
}

export function StatementHistoryTable({ statements, onSelect }: Props) {
  if (statements.length === 0) {
    return <p><small>No statements uploaded yet.</small></p>;
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>Period</th>
          <th style={{ textAlign: 'right' }}>Transactions</th>
          <th style={{ textAlign: 'left' }}>Uploaded</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {statements.map(({ statement, transactionCount }) => (
          <tr key={statement.id} style={{ borderTop: '1px solid var(--border)' }}>
            <td>{statement.periodStart ?? '?'} → {statement.periodEnd ?? '?'}</td>
            <td style={{ textAlign: 'right' }}>{transactionCount}</td>
            <td>{new Date(statement.createdAt).toLocaleDateString('en-ZA')}</td>
            <td>{onSelect && <button type="button" onClick={() => onSelect(statement.id)}>View</button>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
