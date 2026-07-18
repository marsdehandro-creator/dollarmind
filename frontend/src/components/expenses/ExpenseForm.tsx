/**
 * Add-manual-expense form. Amount entered in rand, converted to cents.
 */
import { useState, type FormEvent } from 'react';
import { createExpense } from '../../services/expenseService.js';
import type { Category } from '../../services/categoryService.js';

interface Props {
  categories: Category[];
  onCreated: () => void;
}

export function ExpenseForm({ categories, onCreated }: Props) {
  const [txnDate, setTxnDate] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createExpense({
        txnDate,
        amount: Math.round(Number(amount) * 100),
        categoryId: categoryId || null,
        note: note || null,
      });
      setTxnDate('');
      setAmount('');
      setCategoryId('');
      setNote('');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label>Date<br /><input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required /></label>
      <label>Amount (R)<br /><input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required style={{ width: 100 }} /></label>
      <label>Category<br />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Uncategorized</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>Note<br /><input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /></label>
      <button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add expense'}</button>
      {error && <span style={{ color: 'crimson' }} role="alert">{error}</span>}
    </form>
  );
}
