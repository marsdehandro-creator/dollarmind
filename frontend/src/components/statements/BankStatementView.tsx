/**
 * Full reflection of a bank statement: totals + every transaction as imported,
 * with a running-balance column and flagged-row highlight.
 */
import { formatZar } from '../../utils/money.js';
import type { StatementDetail } from '../../services/statementService.js';

const FLAG_BG = 'color-mix(in srgb, #FFB300 16%, transparent)';

export function BankStatementView({ detail, onClose }: { detail: StatementDetail; onClose: () => void }) {
  const { statement, transactions, totals } = detail;
  return (
    <div className="dm-card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>{statement.periodStart ?? '?'} → {statement.periodEnd ?? '?'}</h3>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      <div style={{ display: 'flex', gap: '2rem', margin: '0.6rem 0 1rem' }}>
        <div><strong>Income</strong><div style={{ color: 'var(--success)' }}>{formatZar(totals.income)}</div></div>
        <div><strong>Expenses</strong><div style={{ color: 'var(--danger)' }}>{formatZar(totals.expense)}</div></div>
        <div><strong>Transactions</strong><div>{totals.count}</div></div>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Date</th>
              <th style={{ textAlign: 'left' }}>Description</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} style={{ borderTop: '1px solid var(--border)', background: t.flagged ? FLAG_BG : undefined }}>
                <td>{t.txnDate}</td>
                <td>{t.descriptionRaw}{t.merchant && <span style={{ color: 'var(--fg-muted)' }}> · {t.merchant}</span>}</td>
                <td style={{ textAlign: 'right', color: t.direction === 'debit' ? 'var(--danger)' : 'var(--success)' }}>
                  {t.direction === 'debit' ? '−' : '+'}{formatZar(t.amount)}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--fg-muted)' }}>{t.balanceAfter != null ? formatZar(t.balanceAfter) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
