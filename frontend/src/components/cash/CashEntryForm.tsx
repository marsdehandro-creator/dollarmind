/**
 * Add-cash-entry form (inflow or outflow). Amount entered in rand.
 */
import { useState, type FormEvent } from 'react';
import { createCashEntry } from '../../services/cashService.js';
import type { Category } from '../../services/categoryService.js';

interface Props {
  categories: Category[];
  onCreated: () => void;
}

export function CashEntryForm({ categories, onCreated }: Props) {
  const [entryDate, setEntryDate] = useState('');
  const [direction, setDirection] = useState<'inflow' | 'outflow'>('outflow');
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
      await createCashEntry({
        entryDate,
        direction,
        amount: Math.round(Number(amount) * 100),
        categoryId: categoryId || null,
        note: note || null,
      });
      setEntryDate('');
      setAmount('');
      setCategoryId('');
      setNote('');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label>Date<br /><input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required /></label>
      <label>Direction<br />
        <select value={direction} onChange={(e) => setDirection(e.target.value as 'inflow' | 'outflow')}>
          <option value="outflow">Outflow (spent)</option>
          <option value="inflow">Inflow (received)</option>
        </select>
      </label>
      <label>Amount (R)<br /><input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required style={{ width: 100 }} /></label>
      <label>Category<br />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Uncategorized</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>Note<br /><input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /></label>
      <button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add entry'}</button>
      {error && <span style={{ color: 'crimson' }} role="alert">{error}</span>}
    </form>
  );
}
