/**
 * Transaction ledger table with direction-aware amounts, category, merchant,
 * duplicate badges, and an orange highlight for flagged (needs-review) rows.
 */
import { formatZar } from '../../utils/money.js';
import type { TransactionDto } from '../../services/transactionService.js';
import { DuplicateBadge } from './DuplicateBadge.js';

interface Props {
  transactions: TransactionDto[];
  categoryNames?: Record<string, string>;
  onEditCategory?: (txn: TransactionDto) => void;
}

const FLAG_BG = 'color-mix(in srgb, #FFB300 16%, transparent)';

export function TransactionTable({ transactions, categoryNames, onEditCategory }: Props) {
  if (transactions.length === 0) {
    return <p><small>No transactions match.</small></p>;
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>Date</th>
          <th style={{ textAlign: 'left' }}>Description</th>
          <th style={{ textAlign: 'left' }}>Category</th>
          <th style={{ textAlign: 'right' }}>Amount</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {transactions.map((t) => (
          <tr
            key={t.id}
            style={{ borderTop: '1px solid var(--border)', background: t.flagged ? FLAG_BG : undefined }}
            title={`AI-assigned category · confidence ${(t.confidence * 100).toFixed(0)}%${t.flagged ? ' — please review' : ''}`}
          >
            <td>{t.txnDate}</td>
            <td>
              {t.descriptionRaw}
              {t.merchant && <span style={{ color: 'var(--fg-muted)' }}> · {t.merchant}</span>}
              {' '}<DuplicateBadge dedupGroupId={t.dedupGroupId} />
              {t.flagged && (
                <span className="dm-badge" style={{ marginLeft: 6, color: '#FFB300', borderColor: '#FFB300' }}>review</span>
              )}
            </td>
            <td>{t.categoryId ? categoryNames?.[t.categoryId] ?? '—' : <em style={{ color: 'var(--fg-muted)' }}>Uncategorized</em>}</td>
            <td style={{ textAlign: 'right', color: t.direction === 'debit' ? 'var(--danger)' : 'var(--success)' }}>
              {t.direction === 'debit' ? '−' : '+'}{formatZar(t.amount)}
            </td>
            <td>
              {onEditCategory && <button type="button" onClick={() => onEditCategory(t)}>Edit</button>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
