/**
 * GoalRepository port.
 */
import type { Goal } from '../models/index.js';

export interface GoalRepository {
  create(goal: Goal): Promise<Goal>;
  update(goal: Goal): Promise<Goal>;
  findById(id: string): Promise<Goal | null>;
  listByTenant(tenantId: string): Promise<Goal[]>;
  /** Soft-delete (archive) a goal. */
  softDelete(id: string): Promise<void>;
}
