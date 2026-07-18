/**
 * Manual expenses page: add / edit / delete cash-or-manual expenses that feed
 * the spending summaries (docs/requirements.md F6).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExpenseForm } from '../../components/expenses/ExpenseForm.js';
import { ExpenseTable } from '../../components/expenses/ExpenseTable.js';
import { ExpenseEditModal } from '../../components/expenses/ExpenseEditModal.js';
import { listExpenses, type ManualExpense } from '../../services/expenseService.js';
import { listCategories, type Category } from '../../services/categoryService.js';

export function ManualExpensesPage() {
  const [expenses, setExpenses] = useState<ManualExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<ManualExpense | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setExpenses(await listExpenses());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    }
  }, []);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]));
    void reload();
  }, [reload]);

  const categoryNames = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  return (
    <section>
      <h1>Manual Expenses</h1>
      <p><small>Log cash or out-of-band expenses. These are included in your spending summary, category totals, and trends.</small></p>

      <div style={{ marginBottom: '1.5rem' }}>
        <ExpenseForm categories={categories} onCreated={reload} />
      </div>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <ExpenseTable expenses={expenses} categoryNames={categoryNames} onEdit={setEditing} onChanged={reload} />

      {editing && (
        <ExpenseEditModal
          expense={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </section>
  );
}
