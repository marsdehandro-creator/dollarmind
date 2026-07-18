/**
 * Goals API client.
 */
import { apiGet, apiPost, apiRequest } from './apiClient.js';

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
  const { goals } = await apiGet<{ goals: GoalWithProgress[] }>('/goals');
  return goals;
}

export async function createGoal(input: CreateGoalInput): Promise<GoalWithProgress> {
  const { goal } = await apiPost<{ goal: GoalWithProgress }>('/goals', input);
  return goal;
}

export async function updateGoal(id: string, patch: Partial<CreateGoalInput> & { status?: string }): Promise<GoalWithProgress> {
  const { goal } = await apiRequest<{ goal: GoalWithProgress }>('PUT', `/goals/${id}`, patch);
  return goal;
}

export function deleteGoal(id: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>('DELETE', `/goals/${id}`);
}
