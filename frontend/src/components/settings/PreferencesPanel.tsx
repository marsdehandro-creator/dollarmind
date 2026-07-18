/**
 * Preferences panel: theme, currency, chart type, default month. Changes apply
 * globally via PreferencesContext.
 */
import { useState } from 'react';
import { usePreferences } from '../../context/PreferencesContext.js';

export function PreferencesPanel() {
  const { preferences, update } = usePreferences();
  const [status, setStatus] = useState<string | null>(null);

  if (!preferences) return <p><small>Loading preferences…</small></p>;

  async function change(patch: Parameters<typeof update>[0]) {
    setStatus(null);
    try {
      await update(patch);
      setStatus('Saved.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Save failed');
    }
  }

  return (
    <div>
      <h3>Preferences</h3>
      <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 320 }}>
        <label>Theme{' '}
          <select value={preferences.theme} onChange={(e) => change({ theme: e.target.value as 'light' | 'dark' | 'system' })}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>Currency{' '}
          <select value={preferences.currency} onChange={(e) => change({ currency: e.target.value })}>
            <option value="ZAR">ZAR (R)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </select>
        </label>
        <label>Chart type{' '}
          <select value={preferences.chartType} onChange={(e) => change({ chartType: e.target.value as 'bar' | 'line' })}>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
          </select>
        </label>
        <label>Navigation{' '}
          <select value={preferences.layout} onChange={(e) => change({ layout: e.target.value as 'auto' | 'sidebar' | 'bottomnav' })}>
            <option value="auto">Auto (responsive)</option>
            <option value="sidebar">Sidebar</option>
            <option value="bottomnav">Bottom nav</option>
          </select>
        </label>
        <label>Default month{' '}
          <input
            type="text"
            value={preferences.defaultMonth}
            placeholder="current or YYYY-MM"
            onChange={(e) => change({ defaultMonth: e.target.value })}
            style={{ width: 120 }}
          />
        </label>
      </div>
      {status && <p><small>{status}</small></p>}
    </div>
  );
}
