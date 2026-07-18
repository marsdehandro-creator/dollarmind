/**
 * Transactions ledger page: filterable table with duplicate indicators and
 * per-row category override (docs/requirements.md F3, F4, F5).
 */
import { useCallback, useEffect, useState } from 'react';
import { TransactionFilters } from '../components/transactions/TransactionFilters.js';
import { EditableTransactionList } from '../components/transactions/EditableTransactionList.js';
import {
  filterTransactions,
  listTransactions,
  type TransactionDto,
  type TransactionFilterCriteria,
} from '../services/transactionService.js';
import { listCategories, type Category } from '../services/categoryService.js';

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [criteria, setCriteria] = useState<TransactionFilterCriteria | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setTransactions(criteria ? await filterTransactions(criteria) : await listTransactions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    }
  }, [criteria]);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <section>
      <h1>Transactions</h1>
      <TransactionFilters onApply={setCriteria} onReset={() => setCriteria(null)} />
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <EditableTransactionList transactions={transactions} categories={categories} onChanged={reload} />
    </section>
  );
}
