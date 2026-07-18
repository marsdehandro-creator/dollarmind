/**
 * DollarMind Goals — create goals and track progress with circular charts,
 * gradient progress bars, and insights. Card grid on desktop, stacked on mobile.
 */
import { useCallback, useEffect, useState } from 'react';
import { GoalForm } from '../components/goals/GoalForm.js';
import { GoalCard } from '../components/goals/GoalCard.js';
import { GoalEditModal } from '../components/goals/GoalEditModal.js';
import { deleteGoal, listGoals, type GoalWithProgress } from '../services/goalService.js';

export function GoalsPage() {
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [editing, setEditing] = useState<GoalWithProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setGoals(await listGoals());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goals');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function remove(id: string) {
    await deleteGoal(id);
    void reload();
  }

  return (
    <section>
      <h1>Goals</h1>
      {error && <p className="error-text">{error}</p>}

      <div style={{ marginBottom: '1.5rem' }}>
        <GoalForm onCreated={reload} />
      </div>

      {goals.length === 0 ? (
        <p><small>No goals yet — create one above to start tracking.</small></p>
      ) : (
        <div className="dm-grid">
          {goals.map((item) => (
            <GoalCard key={item.goal.id} item={item} onEdit={setEditing} onDelete={remove} />
          ))}
        </div>
      )}

      {editing && (
        <GoalEditModal
          item={editing}
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
