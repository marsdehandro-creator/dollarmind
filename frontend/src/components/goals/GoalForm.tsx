/**
 * Goal creation form. Amounts entered in rand, converted to cents.
 */
import { useState, type FormEvent } from 'react';
import { createGoal, type CreateGoalInput, type GoalType } from '../../services/goalService.js';
import { GOAL_ICONS } from './goalIcons.js';

interface Props {
  onCreated: () => void;
}

const TYPES: GoalType[] = ['house', 'car', 'vacation', 'emergency', 'custom'];

export function GoalForm({ onCreated }: Props) {
  const [name, setName] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('custom');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [monthly, setMonthly] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rand = (v: string) => Math.round(Number(v || '0') * 100);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const input: CreateGoalInput = {
        name,
        goalType,
        targetAmount: rand(target),
        currentSavings: rand(current),
        monthlyContribution: rand(monthly),
        targetDate: deadline || null,
        icon: GOAL_ICONS[goalType],
      };
      await createGoal(input);
      setName(''); setTarget(''); setCurrent(''); setMonthly(''); setDeadline(''); setGoalType('custom');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create goal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="dm-card" style={{ display: 'grid', gap: '0.6rem', maxWidth: 520 }}>
      <h3 style={{ marginTop: 0 }}>New goal</h3>
      <label>Name<br /><input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%' }} /></label>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <label>Type<br />
          <select value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)}>
            {TYPES.map((t) => <option key={t} value={t}>{GOAL_ICONS[t]} {t}</option>)}
          </select>
        </label>
        <label>Target (R)<br /><input type="number" step="0.01" min="0" value={target} onChange={(e) => setTarget(e.target.value)} required style={{ width: 120 }} /></label>
        <label>Current (R)<br /><input type="number" step="0.01" min="0" value={current} onChange={(e) => setCurrent(e.target.value)} style={{ width: 120 }} /></label>
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <label>Monthly (R)<br /><input type="number" step="0.01" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)} style={{ width: 120 }} /></label>
        <label>Deadline<br /><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div><button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create goal'}</button></div>
    </form>
  );
}
