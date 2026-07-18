/**
 * Modal to manually set a transaction's category. Saving triggers adaptive
 * learning on the backend (a new rule is created).
 */
import { useState } from 'react';
import type { Category } from '../../services/categoryService.js';
import { updateTransactionCategory } from '../../services/categoryService.js';
import type { TransactionDto } from '../../services/transactionService.js';

interface Props {
  transaction: TransactionDto;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export function CategoryOverrideModal({ transaction, categories, onClose, onSaved }: Props) {
  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!categoryId) return;
    setBusy(true);
    setError(null);
    try {
      await updateTransactionCategory(transaction.id, categoryId);
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
        <h3 style={{ marginTop: 0 }}>Set category</h3>
        <p style={{ color: '#555' }}>{transaction.descriptionRaw}</p>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: '100%' }}>
          <option value="">Select a category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <p style={{ marginTop: '0.5rem' }}><small>Saving also teaches a rule so similar transactions auto-categorize next time.</small></p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={save} disabled={!categoryId || busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
