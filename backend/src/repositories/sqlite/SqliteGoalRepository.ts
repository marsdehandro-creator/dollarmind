/**
 * SQLite-backed GoalRepository.
 */
import type { Db } from '../../db/connection.js';
import type { Goal } from '@dollarmind/core/models/index.js';
import type { GoalRepository } from '@dollarmind/core/repositories/GoalRepository.js';
import { nowIso } from '@dollarmind/core/utils/id.js';
import { rowToGoal, type Row } from '@dollarmind/core/repositories/rowMappers.js';

export class SqliteGoalRepository implements GoalRepository {
  constructor(private readonly db: Db) {}

  async create(goal: Goal): Promise<Goal> {
    this.db
      .prepare(
        `INSERT INTO goal (id, tenant_id, name, goal_type, target_amount, current_savings,
           monthly_contribution, target_date, category_id, icon, priority, status,
           created_at, updated_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        goal.id,
        goal.tenantId,
        goal.name,
        goal.goalType,
        goal.targetAmount,
        goal.currentSavings,
        goal.monthlyContribution,
        goal.targetDate,
        goal.categoryId,
        goal.icon,
        goal.priority,
        goal.status,
        goal.createdAt,
        goal.updatedAt,
        goal.archivedAt,
      );
    return goal;
  }

  async update(goal: Goal): Promise<Goal> {
    this.db
      .prepare(
        `UPDATE goal SET name = ?, goal_type = ?, target_amount = ?, current_savings = ?,
           monthly_contribution = ?, target_date = ?, category_id = ?, icon = ?, priority = ?,
           status = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        goal.name,
        goal.goalType,
        goal.targetAmount,
        goal.currentSavings,
        goal.monthlyContribution,
        goal.targetDate,
        goal.categoryId,
        goal.icon,
        goal.priority,
        goal.status,
        nowIso(),
        goal.id,
      );
    return goal;
  }

  async findById(id: string): Promise<Goal | null> {
    const row = this.db.prepare('SELECT * FROM goal WHERE id = ?').get(id) as Row | undefined;
    return row ? rowToGoal(row) : null;
  }

  async listByTenant(tenantId: string): Promise<Goal[]> {
    const rows = this.db
      .prepare('SELECT * FROM goal WHERE tenant_id = ? AND archived_at IS NULL ORDER BY priority ASC, created_at DESC')
      .all(tenantId) as Row[];
    return rows.map(rowToGoal);
  }

  async softDelete(id: string): Promise<void> {
    this.db
      .prepare("UPDATE goal SET archived_at = ?, status = 'archived', updated_at = ? WHERE id = ?")
      .run(nowIso(), nowIso(), id);
  }
}
