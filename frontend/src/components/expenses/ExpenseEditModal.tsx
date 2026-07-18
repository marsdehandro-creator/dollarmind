/**
 * Edit-expense modal.
 */
import { useState } from 'react';
import { updateExpense, type ManualExpense } from '../../services/expenseService.js';
import type { Category } from '../../services/categoryService.js';

interface Props {
  expense: ManualExpense;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export function ExpenseEditModal({ expense, categories, onClose, onSaved }: Props) {
  const [txnDate, setTxnDate] = useState(expense.txnDate);
  const [amount, setAmount] = useState((expense.amount / 100).toFixed(2));
  const [categoryId, setCategoryId] = useState(expense.categoryId ?? '');
  const [note, setNote] = useState(expense.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateExpense(expense.id, {
        txnDate,
        amount: Math.round(Number(amount) * 100),
        categoryId: categoryId || null,
        note: note || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dm-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="dm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Edit expense</h3>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <label>Date <input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} /></label>
          <label>Amount (R) <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label>Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Note <input type="text" value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </div>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
