/**
 * Cash tracking page: record cash inflows/outflows that feed the spending
 * summaries (inflow = income, outflow = expense).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CashEntryForm } from '../../components/cash/CashEntryForm.js';
import { CashEntryTable } from '../../components/cash/CashEntryTable.js';
import { listCashEntries, type CashEntry } from '../../services/cashService.js';
import { listCategories, type Category } from '../../services/categoryService.js';

export function CashTrackingPage() {
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setEntries(await listCashEntries());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cash entries');
    }
  }, []);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]));
    void reload();
  }, [reload]);

  const categoryNames = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  return (
    <section>
      <h1>Cash Tracking</h1>
      <p><small>Track cash you receive or spend outside your bank account. Entries flow into your spending summary and trends.</small></p>

      <div style={{ marginBottom: '1.5rem' }}>
        <CashEntryForm categories={categories} onCreated={reload} />
      </div>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <CashEntryTable entries={entries} categoryNames={categoryNames} />
    </section>
  );
}
