/**
 * Summary of income / expense / net + a category breakdown.
 */
import { formatZar } from '../../utils/money.js';
import type { SpendingSummary } from '../../services/spendingService.js';

interface Props {
  summary: SpendingSummary;
}

export function SpendingSummaryCard({ summary }: Props) {
  const maxCat = Math.max(1, ...summary.byCategory.map((c) => c.total));
  return (
    <div className="dm-card" style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div><strong>Income</strong><div style={{ color: 'var(--success)' }}>{formatZar(summary.income)}</div></div>
        <div><strong>Expense</strong><div style={{ color: 'var(--gold)' }}>{formatZar(summary.expense)}</div></div>
        <div><strong>Net</strong><div>{formatZar(summary.net)}</div></div>
        <div><strong>Avg / month</strong><div>{formatZar(summary.averageMonthlyExpense)}</div></div>
      </div>

      <h4 style={{ margin: '0 0 0.5rem' }}>By category</h4>
      {summary.byCategory.length === 0 && <p><small>No expenses in range.</small></p>}
      {summary.byCategory.map((c) => (
        <div key={c.categoryId ?? 'none'} style={{ marginBottom: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span>{c.categoryName} <small style={{ color: '#888' }}>({c.count})</small></span>
            <span>{formatZar(c.total)}</span>
          </div>
          <div style={{ height: 6, background: 'var(--surface)', borderRadius: 3 }}>
            <div style={{ width: `${(c.total / maxCat) * 100}%`, height: 6, background: 'var(--grad-primary)', borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
