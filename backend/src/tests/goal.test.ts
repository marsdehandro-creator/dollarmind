/**
 * Goal service + progress engine tests (in-memory SQLite).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createConfiguredDb, type Db } from '../db/index.js';
import { SqliteGoalRepository } from '../repositories/sqlite/SqliteGoalRepository.js';
import { SqliteCategoryRepository } from '../repositories/sqlite/SqliteCategoryRepository.js';
import { SqliteAuditRepository } from '../repositories/sqlite/SqliteAuditRepository.js';
import { LocalAuditService } from '@dollarmind/core/services/LocalAuditService.js';
import { LocalGoalService, computeProgress } from '@dollarmind/core/services/LocalGoalService.js';
import { DEFAULT_TENANT_ID } from '../config/index.js';
import type { Goal } from '@dollarmind/core/models/index.js';

function goal(overrides: Partial<Goal>): Goal {
  return {
    id: 'g', tenantId: DEFAULT_TENANT_ID, name: 'House', goalType: 'house',
    targetAmount: 10_000_00, currentSavings: 2_500_00, monthlyContribution: 1_000_00,
    targetDate: null, categoryId: null, icon: null, priority: 100, status: 'active',
    createdAt: 'now', updatedAt: 'now', archivedAt: null, ...overrides,
  };
}

describe('computeProgress', () => {
  it('computes percent complete and remaining', () => {
    const p = computeProgress(goal({ targetAmount: 10_000_00, currentSavings: 2_500_00 }));
    expect(p.percentComplete).toBe(25);
    expect(p.remaining).toBe(7_500_00);
  });

  it('marks a fully funded goal as achieved', () => {
    const p = computeProgress(goal({ currentSavings: 10_000_00 }));
    expect(p.standing).toBe('achieved');
    expect(p.percentComplete).toBe(100);
  });

  it('flags behind when contribution is below the required monthly', () => {
    const target = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10); // ~2 months
    // remaining 7500, ~2 months => need ~3750/mo, contributing 1000 => behind
    const p = computeProgress(goal({ targetDate: target, monthlyContribution: 1_000_00 }));
    expect(p.standing).toBe('behind');
    expect(p.requiredMonthly).not.toBeNull();
    expect(p.requiredMonthly! > 1_000_00).toBe(true);
  });

  it('projects a completion date from the monthly contribution', () => {
    const p = computeProgress(goal({ targetDate: null, monthlyContribution: 1_000_00 }));
    expect(p.standing).toBe('no_deadline');
    expect(p.projectedCompletionDate).not.toBeNull();
  });
});

describe('LocalGoalService', () => {
  let db: Db;
  let svc: LocalGoalService;
  beforeEach(() => {
    db = createConfiguredDb(':memory:');
    svc = new LocalGoalService(
      new SqliteGoalRepository(db),
      new SqliteCategoryRepository(db),
      new LocalAuditService(new SqliteAuditRepository(db)),
    );
  });

  it('creates, lists, updates, and deletes goals with progress + insights', async () => {
    const created = await svc.create(DEFAULT_TENANT_ID, {
      name: 'Emergency fund', goalType: 'emergency', targetAmount: 50_000_00, currentSavings: 10_000_00, monthlyContribution: 5_000_00,
    });
    expect(created.progress.percentComplete).toBe(20);
    expect(created.insights.length).toBeGreaterThan(0);

    let all = await svc.list(DEFAULT_TENANT_ID);
    expect(all).toHaveLength(1);

    const updated = await svc.update(DEFAULT_TENANT_ID, created.goal.id, { currentSavings: 25_000_00 });
    expect(updated.progress.percentComplete).toBe(50);

    await svc.delete(DEFAULT_TENANT_ID, created.goal.id);
    all = await svc.list(DEFAULT_TENANT_ID);
    expect(all).toHaveLength(0);
  });

  it('rejects an invalid goal', async () => {
    await expect(svc.create(DEFAULT_TENANT_ID, { name: '', targetAmount: 0 })).rejects.toThrow();
  });
});
