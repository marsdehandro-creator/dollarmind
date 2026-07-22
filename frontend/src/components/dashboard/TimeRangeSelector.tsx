/**
 * Time-range selector (Phase 18 §1) — predefined ranges + custom dates.
 * The chosen preset is persisted in localStorage until changed.
 */
import { useState } from 'react';

export type RangePreset =
  | 'day' | 'week' | 'month' | '3months' | '6months' | 'ytd' | 'year' | 'custom';

export interface DateRange {
  from: string;
  to: string;
}

const PRESETS: Array<{ id: RangePreset; label: string }> = [
  { id: 'day', label: 'Last day' },
  { id: 'week', label: 'Last week' },
  { id: 'month', label: 'This month' },
  { id: '3months', label: 'Last 3 months' },
  { id: '6months', label: 'Last 6 months' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'year', label: 'Last year' },
  { id: 'custom', label: 'Custom' },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const STORAGE_KEY = 'dm.dashboard.range';

export function presetToRange(preset: RangePreset, custom?: DateRange): DateRange {
  const today = new Date();
  const to = iso(today);
  const daysAgo = (n: number) => iso(new Date(today.getTime() - n * 86_400_000));
  switch (preset) {
    case 'day': return { from: daysAgo(1), to };
    case 'week': return { from: daysAgo(7), to };
    case 'month': {
      // A real calendar month (1st -> last day), not a rolling 30 days.
      // A rolling window ending "today" was excluding the current pay
      // period's own payslip whenever its period-end (or pay date) fell
      // later in the month than today — the payslip would show correctly
      // on the Salary page (which applies no date filter) but vanish from
      // the dashboard's default view, looking like a bug on first upload.
      const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
      return { from: iso(first), to: iso(last) };
    }
    case '3months': return { from: daysAgo(90), to };
    case '6months': return { from: daysAgo(182), to };
    case 'ytd': return { from: `${today.getUTCFullYear()}-01-01`, to };
    case 'year': return { from: daysAgo(365), to };
    case 'custom': return custom ?? { from: daysAgo(30), to };
  }
}

export function loadStoredPreset(): RangePreset {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return (v as RangePreset) ?? 'month';
}

interface Props {
  preset: RangePreset;
  custom: DateRange;
  onChange: (preset: RangePreset, custom: DateRange) => void;
}

export function TimeRangeSelector({ preset, custom, onChange }: Props) {
  const [from, setFrom] = useState(custom.from);
  const [to, setTo] = useState(custom.to);

  function selectPreset(p: RangePreset) {
    localStorage.setItem(STORAGE_KEY, p);
    onChange(p, p === 'custom' ? { from, to } : presetToRange(p));
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
      <label>
        Range<br />
        <select value={preset} onChange={(e) => selectPreset(e.target.value as RangePreset)}>
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      {preset === 'custom' && (
        <>
          <label>From<br /><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); onChange('custom', { from: e.target.value, to }); }} /></label>
          <label>To<br /><input type="date" value={to} onChange={(e) => { setTo(e.target.value); onChange('custom', { from, to: e.target.value }); }} /></label>
        </>
      )}
    </div>
  );
}
