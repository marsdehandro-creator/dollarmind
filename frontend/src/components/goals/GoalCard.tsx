/**
 * Goal card — circular progress + gradient progress bar + insights + actions.
 */
import { formatZar } from '../../utils/money.js';
import { CircularProgress } from '../charts/CircularProgress.js';
import { GOAL_ICONS, STANDING_COLOR, STANDING_LABEL } from './goalIcons.js';
import type { GoalWithProgress } from '../../services/goalService.js';

interface Props {
  item: GoalWithProgress;
  onEdit: (item: GoalWithProgress) => void;
  onDelete: (id: string) => void;
}

export function GoalCard({ item, onEdit, onDelete }: Props) {
  const { goal, progress, insights } = item;

  return (
    <div className="dm-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            <span style={{ marginRight: 6 }}>{goal.icon || GOAL_ICONS[goal.goalType]}</span>{goal.name}
          </div>
          <div className="dm-badge" style={{ marginTop: 4, color: STANDING_COLOR[progress.standing], borderColor: STANDING_COLOR[progress.standing] }}>
            {STANDING_LABEL[progress.standing] ?? progress.standing}
          </div>
        </div>
        <CircularProgress percent={progress.percentComplete} size={84} />
      </div>

      {/* Gradient progress bar (saved vs target) */}
      <div style={{ margin: '0.8rem 0 0.4rem' }}>
        <div style={{ height: 10, background: 'var(--surface)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ width: `${progress.percentComplete}%`, height: '100%', background: 'var(--grad-brand)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--fg-muted)', marginTop: 4 }}>
          <span>{formatZar(goal.currentSavings)}</span>
          <span>{formatZar(goal.targetAmount)}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem', fontSize: '0.85rem', margin: '0.6rem 0' }}>
        <span style={{ color: 'var(--fg-muted)' }}>Monthly</span><span style={{ textAlign: 'right' }}>{formatZar(goal.monthlyContribution)}</span>
        {goal.targetDate && (<><span style={{ color: 'var(--fg-muted)' }}>Deadline</span><span style={{ textAlign: 'right' }}>{goal.targetDate}</span></>)}
        {progress.daysRemaining !== null && (<><span style={{ color: 'var(--fg-muted)' }}>Days left</span><span style={{ textAlign: 'right' }}>{progress.daysRemaining}</span></>)}
        {progress.requiredMonthly !== null && (<><span style={{ color: 'var(--fg-muted)' }}>Needed / mo</span><span style={{ textAlign: 'right' }}>{formatZar(progress.requiredMonthly)}</span></>)}
        {progress.projectedCompletionDate && (<><span style={{ color: 'var(--fg-muted)' }}>Projected</span><span style={{ textAlign: 'right' }}>{progress.projectedCompletionDate}</span></>)}
      </div>

      {insights.length > 0 && (
        <ul style={{ paddingLeft: '1.1rem', margin: '0.4rem 0', fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
          {insights.map((t, i) => <li key={i} style={{ margin: '0.2rem 0' }}>{t}</li>)}
        </ul>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => onEdit(item)}>Edit</button>
        <button type="button" onClick={() => onDelete(goal.id)}>Delete</button>
      </div>
    </div>
  );
}
