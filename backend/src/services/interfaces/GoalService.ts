/**
 * GoalService port — CRUD + the goal progress engine (docs/requirements.md F8).
 */
import type { Goal } from '../../models/index.js';

export interface CreateGoalInput {
  name: string;
  goalType?: Goal['goalType'];
  targetAmount: number; // cents
  currentSavings?: number; // cents
  monthlyContribution?: number; // cents
  targetDate?: string | null;
  categoryId?: string | null;
  icon?: string | null;
  priority?: number;
}

export type UpdateGoalInput = Partial<CreateGoalInput> & { status?: Goal['status'] };

export interface GoalProgress {
  percentComplete: number; // 0..100
  remaining: number; // cents
  daysRemaining: number | null;
  monthsRemaining: number | null;
  requiredMonthly: number | null; // cents to hit the deadline
  projectedCompletionDate: string | null;
  aheadDays: number | null; // + = ahead of deadline, - = behind
  standing: 'achieved' | 'ahead' | 'on_track' | 'behind' | 'no_deadline';
}

export interface GoalWithProgress {
  goal: Goal;
  progress: GoalProgress;
  insights: string[];
}

export interface GoalService {
  list(tenantId: string): Promise<GoalWithProgress[]>;
  create(tenantId: string, input: CreateGoalInput): Promise<GoalWithProgress>;
  update(tenantId: string, id: string, patch: UpdateGoalInput): Promise<GoalWithProgress>;
  delete(tenantId: string, id: string): Promise<void>;
}
