/**
 * Manual expense list with edit/delete actions.
 */
import { formatZar } from '../../utils/money.js';
import { deleteExpense, type ManualExpense } from '../../services/expenseService.js';

interface Props {
  expenses: ManualExpense[];
  categoryNames: Record<string, string>;
  onEdit: (expense: ManualExpense) => void;
  onChanged: () => void;
}

export function ExpenseTable({ expenses, categoryNames, onEdit, onChanged }: Props) {
  if (expenses.length === 0) return <p><small>No manual expenses yet.</small></p>;

  async function remove(id: string) {
    await deleteExpense(id);
    onChanged();
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>Date</th>
          <th style={{ textAlign: 'left' }}>Category</th>
          <th style={{ textAlign: 'left' }}>Note</th>
          <th style={{ textAlign: 'right' }}>Amount</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {expenses.map((e) => (
          <tr key={e.id} style={{ borderTop: '1px solid #eee' }}>
            <td>{e.txnDate}</td>
            <td>{e.categoryId ? categoryNames[e.categoryId] ?? '—' : <em style={{ color: '#9ca3af' }}>Uncategorized</em>}</td>
            <td>{e.note}</td>
            <td style={{ textAlign: 'right', color: '#b91c1c' }}>−{formatZar(e.amount)}</td>
            <td style={{ whiteSpace: 'nowrap' }}>
              <button type="button" onClick={() => onEdit(e)}>Edit</button>{' '}
              <button type="button" onClick={() => remove(e.id)}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
