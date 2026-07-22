/**
 * On-device (LocalDbDriver-backed) GoalRepository. Same SQL/shape as
 * SqliteGoalRepository.
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { Goal } from '../../models/index.js';
import type { GoalRepository } from '../GoalRepository.js';
import { nowIso } from '../../utils/id.js';
import { rowToGoal, type Row } from '../rowMappers.js';

export class LocalGoalRepository implements GoalRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async create(goal: Goal): Promise<Goal> {
    await this.db.run(
      `INSERT INTO goal (id, tenant_id, name, goal_type, target_amount, current_savings,
         monthly_contribution, target_date, category_id, icon, priority, status,
         created_at, updated_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ],
    );
    return goal;
  }

  async update(goal: Goal): Promise<Goal> {
    await this.db.run(
      `UPDATE goal SET name = ?, goal_type = ?, target_amount = ?, current_savings = ?,
         monthly_contribution = ?, target_date = ?, category_id = ?, icon = ?, priority = ?,
         status = ?, updated_at = ? WHERE id = ?`,
      [
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
      ],
    );
    return goal;
  }

  async findById(id: string): Promise<Goal | null> {
    const rows = await this.db.query<Row>('SELECT * FROM goal WHERE id = ?', [id]);
    return rows[0] ? rowToGoal(rows[0]) : null;
  }

  async listByTenant(tenantId: string): Promise<Goal[]> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM goal WHERE tenant_id = ? AND archived_at IS NULL ORDER BY priority ASC, created_at DESC',
      [tenantId],
    );
    return rows.map(rowToGoal);
  }

  async softDelete(id: string): Promise<void> {
    await this.db.run("UPDATE goal SET archived_at = ?, status = 'archived', updated_at = ? WHERE id = ?", [
      nowIso(),
      nowIso(),
      id,
    ]);
  }
}
