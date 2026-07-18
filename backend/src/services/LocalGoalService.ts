/**
 * LocalGoalService — goal CRUD + progress engine + insights.
 *
 * Progress uses the goal's own currentSavings / monthlyContribution (no separate
 * contributions table in the pilot). Money is integer cents throughout.
 */
import type {
  CreateGoalInput,
  GoalProgress,
  GoalService,
  GoalWithProgress,
  UpdateGoalInput,
} from './interfaces/GoalService.js';
import type { GoalRepository } from '../repositories/GoalRepository.js';
import type { CategoryRepository } from '../repositories/CategoryRepository.js';
import type { AuditService } from './interfaces/AuditService.js';
import type { Goal } from '../models/index.js';
import { newId, nowIso } from '../utils/id.js';
import { ValidationError } from '../utils/errors.js';

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30.44;

function fmtR(cents: number): string {
  return `R${Math.round(cents / 100).toLocaleString('en-ZA')}`;
}

export function computeProgress(goal: Goal, now = new Date()): GoalProgress {
  const remaining = Math.max(0, goal.targetAmount - goal.currentSavings);
  const percentComplete = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.currentSavings / goal.targetAmount) * 100))
    : 0;

  let daysRemaining: number | null = null;
  let monthsRemaining: number | null = null;
  let requiredMonthly: number | null = null;

  if (goal.targetDate) {
    const deadline = new Date(goal.targetDate + 'T00:00:00Z').getTime();
    daysRemaining = Math.ceil((deadline - now.getTime()) / MS_PER_DAY);
    monthsRemaining = Math.max(0, (deadline - now.getTime()) / MS_PER_DAY / DAYS_PER_MONTH);
    requiredMonthly = monthsRemaining > 0 ? Math.ceil(remaining / monthsRemaining) : remaining;
  }

  let projectedCompletionDate: string | null = null;
  if (remaining <= 0) {
    projectedCompletionDate = now.toISOString().slice(0, 10);
  } else if (goal.monthlyContribution > 0) {
    const monthsNeeded = remaining / goal.monthlyContribution;
    const projected = new Date(now.getTime() + monthsNeeded * DAYS_PER_MONTH * MS_PER_DAY);
    projectedCompletionDate = projected.toISOString().slice(0, 10);
  }

  let aheadDays: number | null = null;
  if (goal.targetDate && projectedCompletionDate) {
    const deadline = new Date(goal.targetDate + 'T00:00:00Z').getTime();
    const projected = new Date(projectedCompletionDate + 'T00:00:00Z').getTime();
    aheadDays = Math.round((deadline - projected) / MS_PER_DAY);
  }

  let standing: GoalProgress['standing'];
  if (remaining <= 0) standing = 'achieved';
  else if (!goal.targetDate) standing = 'no_deadline';
  else if (requiredMonthly !== null && goal.monthlyContribution >= requiredMonthly) {
    standing = aheadDays !== null && aheadDays > 15 ? 'ahead' : 'on_track';
  } else standing = 'behind';

  return {
    percentComplete,
    remaining,
    daysRemaining,
    monthsRemaining: monthsRemaining === null ? null : Math.round(monthsRemaining),
    requiredMonthly,
    projectedCompletionDate,
    aheadDays,
    standing,
  };
}

export class LocalGoalService implements GoalService {
  constructor(
    private readonly goals: GoalRepository,
    private readonly categories: CategoryRepository,
    private readonly audit: AuditService,
  ) {}

  private async enrich(goal: Goal): Promise<GoalWithProgress> {
    const progress = computeProgress(goal);
    const insights = await this.buildInsights(goal, progress);
    return { goal, progress, insights };
  }

  private async buildInsights(goal: Goal, p: GoalProgress): Promise<string[]> {
    const out: string[] = [];
    if (p.standing === 'achieved') {
      out.push('Goal reached — well done! 🎉');
      return out;
    }
    if (p.standing === 'no_deadline') {
      if (goal.monthlyContribution > 0 && p.projectedCompletionDate) {
        out.push(`At ${fmtR(goal.monthlyContribution)}/mo you'll reach this around ${p.projectedCompletionDate}.`);
      } else {
        out.push('Set a monthly contribution to project a completion date.');
      }
      return out;
    }
    if (p.standing === 'behind' && p.requiredMonthly !== null) {
      const shortfall = Math.max(0, p.requiredMonthly - goal.monthlyContribution);
      out.push(`Increase monthly savings by ${fmtR(shortfall)} to stay on track (need ${fmtR(p.requiredMonthly)}/mo).`);
      if (goal.categoryId) {
        const cat = await this.categories.findById(goal.categoryId);
        if (cat) out.push(`Reduce spending in ${cat.name} to reach your goal earlier.`);
      }
    } else {
      if (p.aheadDays !== null && p.aheadDays > 0) out.push(`You're ahead of schedule by ${p.aheadDays} days.`);
      else out.push("You're on track to hit this goal by the deadline.");
    }
    return out;
  }

  async list(tenantId: string): Promise<GoalWithProgress[]> {
    const goals = await this.goals.listByTenant(tenantId);
    return Promise.all(goals.map((g) => this.enrich(g)));
  }

  async create(tenantId: string, input: CreateGoalInput): Promise<GoalWithProgress> {
    if (!input.name?.trim()) throw new ValidationError('Goal name is required');
    if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
      throw new ValidationError('A positive target amount is required');
    }
    const now = nowIso();
    const goal: Goal = {
      id: newId(),
      tenantId,
      name: input.name.trim(),
      goalType: input.goalType ?? 'custom',
      targetAmount: Math.round(input.targetAmount),
      currentSavings: Math.round(input.currentSavings ?? 0),
      monthlyContribution: Math.round(input.monthlyContribution ?? 0),
      targetDate: input.targetDate ?? null,
      categoryId: input.categoryId ?? null,
      icon: input.icon ?? null,
      priority: input.priority ?? 100,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await this.goals.create(goal);
    await this.audit.record({ tenantId, actor: `user:${tenantId}`, action: 'goal.created', entityType: 'goal', entityId: goal.id });
    return this.enrich(goal);
  }

  async update(tenantId: string, id: string, patch: UpdateGoalInput): Promise<GoalWithProgress> {
    const existing = await this.goals.findById(id);
    if (!existing || existing.tenantId !== tenantId) throw new ValidationError('Goal not found');
    const updated: Goal = {
      ...existing,
      name: patch.name?.trim() ?? existing.name,
      goalType: patch.goalType ?? existing.goalType,
      targetAmount: patch.targetAmount !== undefined ? Math.round(patch.targetAmount) : existing.targetAmount,
      currentSavings: patch.currentSavings !== undefined ? Math.round(patch.currentSavings) : existing.currentSavings,
      monthlyContribution: patch.monthlyContribution !== undefined ? Math.round(patch.monthlyContribution) : existing.monthlyContribution,
      targetDate: patch.targetDate !== undefined ? patch.targetDate : existing.targetDate,
      categoryId: patch.categoryId !== undefined ? patch.categoryId : existing.categoryId,
      icon: patch.icon !== undefined ? patch.icon : existing.icon,
      priority: patch.priority ?? existing.priority,
      status: patch.status ?? existing.status,
      updatedAt: nowIso(),
    };
    await this.goals.update(updated);
    await this.audit.record({ tenantId, actor: `user:${tenantId}`, action: 'goal.updated', entityType: 'goal', entityId: id });
    return this.enrich(updated);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.goals.findById(id);
    if (!existing || existing.tenantId !== tenantId) throw new ValidationError('Goal not found');
    await this.goals.softDelete(id);
    await this.audit.record({ tenantId, actor: `user:${tenantId}`, action: 'goal.deleted', entityType: 'goal', entityId: id });
  }
}
