/**
 * Spending page: monthly summary, category breakdown, and trend chart
 * (docs/requirements.md F5).
 */
import { useEffect, useState } from 'react';
import { SpendingSummaryCard } from '../../components/spending/SpendingSummaryCard.js';
import { TrendChart } from '../../components/spending/TrendChart.js';
import {
  getSummary,
  getTrends,
  type SpendingSummary,
  type SpendingTrends,
} from '../../services/spendingService.js';
import { usePreferences } from '../../context/PreferencesContext.js';

export function SpendingPage() {
  const { preferences } = usePreferences();
  const [summary, setSummary] = useState<SpendingSummary | null>(null);
  const [trends, setTrends] = useState<SpendingTrends | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSummary(), getTrends(6)])
      .then(([s, t]) => {
        setSummary(s);
        setTrends(t);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  return (
    <section>
      <h1>Spending</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <h2>Summary (all time)</h2>
      {summary ? <SpendingSummaryCard summary={summary} /> : <p><small>Loading…</small></p>}

      <h2 style={{ marginTop: '1.5rem' }}>Trends (last 6 months)</h2>
      {trends ? <TrendChart trends={trends} chartType={preferences?.chartType ?? 'bar'} /> : <p><small>Loading…</small></p>}
    </section>
  );
}
