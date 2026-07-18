/**
 * Categories page: view categories, run auto-categorization, and override any
 * transaction's category (which teaches a rule). See docs/requirements.md F5.
 */
import { useCallback, useEffect, useState } from 'react';
import { CategoryTable } from '../../components/categories/CategoryTable.js';
import { EditableTransactionList } from '../../components/transactions/EditableTransactionList.js';
import { categorizeAll, listCategories, type Category } from '../../services/categoryService.js';
import { listTransactions, type TransactionDto } from '../../services/transactionService.js';

export function CategoryPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cats, txns] = await Promise.all([listCategories(), listTransactions()]);
      setCategories(cats);
      setTransactions(txns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAuto() {
    setStatus(null);
    try {
      const { categorized, total } = await categorizeAll();
      setStatus(`Categorized ${categorized} of ${total} uncategorized transactions.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-categorize failed');
    }
  }

  return (
    <section>
      <h1>Categories</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div>
          <h2>Categories</h2>
          <CategoryTable categories={categories} />
        </div>
        <div>
          <h2>Auto-categorization</h2>
          <button type="button" onClick={runAuto}>Run auto-categorization</button>
          {status && <p><small>{status}</small></p>}
          <p style={{ maxWidth: 320 }}><small>Applies keyword/merchant rules to uncategorized transactions. Manual overrides below teach new rules.</small></p>
        </div>
      </div>

      <h2 style={{ marginTop: '1.5rem' }}>Transactions</h2>
      <EditableTransactionList transactions={transactions} categories={categories} onChanged={load} />
    </section>
  );
}
