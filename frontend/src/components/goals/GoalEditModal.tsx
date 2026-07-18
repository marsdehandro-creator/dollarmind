/**
 * Edit-goal modal.
 */
import { useState } from 'react';
import { updateGoal, type GoalWithProgress } from '../../services/goalService.js';

interface Props {
  item: GoalWithProgress;
  onClose: () => void;
  onSaved: () => void;
}

export function GoalEditModal({ item, onClose, onSaved }: Props) {
  const g = item.goal;
  const [name, setName] = useState(g.name);
  const [target, setTarget] = useState((g.targetAmount / 100).toFixed(2));
  const [current, setCurrent] = useState((g.currentSavings / 100).toFixed(2));
  const [monthly, setMonthly] = useState((g.monthlyContribution / 100).toFixed(2));
  const [deadline, setDeadline] = useState(g.targetDate ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rand = (v: string) => Math.round(Number(v || '0') * 100);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateGoal(g.id, {
        name,
        targetAmount: rand(target),
        currentSavings: rand(current),
        monthlyContribution: rand(monthly),
        targetDate: deadline || null,
      });
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
        <h3 style={{ marginTop: 0 }}>Edit goal</h3>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <label>Name <input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Target (R) <input type="number" step="0.01" min="0" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
          <label>Current savings (R) <input type="number" step="0.01" min="0" value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
          <label>Monthly contribution (R) <input type="number" step="0.01" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></label>
          <label>Deadline <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
