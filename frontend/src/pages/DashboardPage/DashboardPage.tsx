/**
 * DollarMind Dashboard (Phase 18) — unified, time-range driven, and resilient.
 * Reads a single /dashboard?from&to payload from the DB; renders whatever data
 * exists (partial dashboards are fine); alerts render separately and never hide
 * the metrics.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatZar } from '../../utils/money.js';
import { DonutChart, donutColor } from '../../components/charts/DonutChart.js';
import { CashFlowChart } from '../../components/charts/CashFlowChart.js';
import {
  TimeRangeSelector,
  loadStoredPreset,
  presetToRange,
  type DateRange,
  type RangePreset,
} from '../../components/dashboard/TimeRangeSelector.js';
import { getDashboard, type DashboardPayload } from '../../services/dashboardService.js';
import { useAuth } from '../../hooks/useAuth.js';

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <div className="dm-card" style={{ minWidth: 130, flex: 1 }}>
      <div style={{ color: 'var(--fg-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: tone === 'up' ? 'var(--success)' : tone === 'down' ? 'var(--gold)' : 'var(--fg)' }}>{value}</div>
    </div>
  );
}

const SEV_COLOR: Record<string, string> = { error: 'var(--danger)', warning: 'var(--gold)', info: 'var(--blue)' };

export function DashboardPage() {
  const { user } = useAuth();
  const [preset, setPreset] = useState<RangePreset>(() => loadStoredPreset());
  const [range, setRange] = useState<DateRange>(() => presetToRange(loadStoredPreset()));
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (r: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      setData(await getDashboard(r.from, r.to));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh whenever the range changes.
  useEffect(() => {
    void load(range);
  }, [range, load]);

  function onRangeChange(p: RangePreset, custom: DateRange) {
    setPreset(p);
    setRange(p === 'custom' ? custom : presetToRange(p));
  }

  const hasData = data?.hasData ?? false;

  return (
    <section>
      <h1>Dashboard</h1>
      <p style={{ color: 'var(--fg-muted)', marginTop: '-0.5rem' }}>
        Welcome back, {user.email}
        {data ? ` · ${data.range.from} → ${data.range.to}` : ''}
      </p>

      <TimeRangeSelector preset={preset} custom={range} onChange={onRangeChange} />

      {error && <p className="error-text">{error}</p>}
      {loading && <p><small>Loading…</small></p>}

      {data && !hasData && (
        <div className="dm-card"><p style={{ margin: 0 }}>No data available for the selected period.</p></div>
      )}

      {data && hasData && (
        <>
          {/* Metric cards — each renders whatever exists (partial is fine). */}
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <Stat label="Income" value={formatZar(data.income)} tone="up" />
            <Stat label="Expenses" value={formatZar(data.expense)} tone="down" />
            <Stat label="Net position" value={formatZar(data.net)} />
            <Stat label="Savings rate" value={`${data.savingsRate}%`} />
            <Stat label="Burn rate" value={`${data.burnRate}%`} />
          </div>

          <div className="dm-grid">
            <div className="dm-card">
              <h3>Category breakdown</h3>
              {data.categories.length > 0 ? (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <DonutChart data={data.categories.slice(0, 7).map((c) => ({ label: c.categoryName, value: c.total }))} />
                  <div style={{ flex: 1, minWidth: 180 }}>
                    {data.categories.slice(0, 5).map((c, i) => (
                      <div key={c.categoryId ?? c.categoryName} style={{ display: 'flex', justifyContent: 'space-between', margin: '0.3rem 0' }}>
                        <span><span style={{ color: donutColor(i) }}>■</span> {c.categoryName}</span>
                        <span>{formatZar(c.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p><small>No categorized spending in this period.</small></p>}
            </div>

            <div className="dm-card">
              <h3>Cash flow ({data.cashflow.granularity})</h3>
              <CashFlowChart points={data.cashflow.points} />
            </div>

            {/* Alerts render separately — they never hide the metrics above. */}
            <div className="dm-card">
              <h3>Alerts &amp; insights</h3>
              {data.alerts.length === 0 ? (
                <p><small>All clear — no issues detected. 🎉</small></p>
              ) : (
                <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
                  {data.alerts.map((a, i) => (
                    <li key={i} style={{ margin: '0.35rem 0', color: SEV_COLOR[a.severity] ?? 'var(--fg)' }}>{a.message}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="dm-card">
              <h3>Quick actions</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <Link to="/expenses" className="btn btn-primary" style={{ textAlign: 'center' }}>Add expense</Link>
                <Link to="/cash" className="btn" style={{ textAlign: 'center' }}>Add cash entry</Link>
                <Link to="/statements" className="btn" style={{ textAlign: 'center' }}>Upload statement</Link>
                <Link to="/salary" className="btn" style={{ textAlign: 'center' }}>Upload slip</Link>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Alerts also show when there's no metric data, so issues stay visible. */}
      {data && !hasData && data.alerts.length > 0 && (
        <div className="dm-card" style={{ marginTop: '1rem' }}>
          <h3>Alerts</h3>
          <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
            {data.alerts.map((a, i) => (
              <li key={i} style={{ color: SEV_COLOR[a.severity] ?? 'var(--fg)' }}>{a.message}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
