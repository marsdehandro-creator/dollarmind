/**
 * Goals local data access. Calls the on-device goalService directly.
 */
import { getContainer } from '../local/container.js';

export type GoalType = 'house' | 'car' | 'vacation' | 'emergency' | 'custom';

export interface Goal {
  id: string;
  name: string;
  goalType: GoalType;
  targetAmount: number;
  currentSavings: number;
  monthlyContribution: number;
  targetDate: string | null;
  categoryId: string | null;
  icon: string | null;
  priority: number;
  status: string;
}

export interface GoalProgress {
  percentComplete: number;
  remaining: number;
  daysRemaining: number | null;
  monthsRemaining: number | null;
  requiredMonthly: number | null;
  projectedCompletionDate: string | null;
  aheadDays: number | null;
  standing: 'achieved' | 'ahead' | 'on_track' | 'behind' | 'no_deadline';
}

export interface GoalWithProgress {
  goal: Goal;
  progress: GoalProgress;
  insights: string[];
}

export interface CreateGoalInput {
  name: string;
  goalType?: GoalType;
  targetAmount: number;
  currentSavings?: number;
  monthlyContribution?: number;
  targetDate?: string | null;
  categoryId?: string | null;
  icon?: string | null;
}

export async function listGoals(): Promise<GoalWithProgress[]> {
  const { goalService, tenantId } = await getContainer();
  const goals = await goalService.list(tenantId);
  return goals as unknown as GoalWithProgress[];
}

export async function createGoal(input: CreateGoalInput): Promise<GoalWithProgress> {
  const { goalService, tenantId } = await getContainer();
  const goal = await goalService.create(tenantId, input);
  return goal as unknown as GoalWithProgress;
}

export async function updateGoal(id: string, patch: Partial<CreateGoalInput> & { status?: string }): Promise<GoalWithProgress> {
  const { goalService, tenantId } = await getContainer();
  const goal = await goalService.update(tenantId, id, patch as Parameters<typeof goalService.update>[2]);
  return goal as unknown as GoalWithProgress;
}

export async function deleteGoal(id: string): Promise<{ ok: boolean }> {
  const { goalService, tenantId } = await getContainer();
  await goalService.delete(tenantId, id);
  return { ok: true };
}
