/**
 * Goal controller. Thin HTTP layer over GoalService.
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { goalService } from '../services/index.js';
import { ValidationError } from '@dollarmind/core/utils/errors.js';

const goalTypes = ['house', 'car', 'vacation', 'emergency', 'custom'] as const;

const createSchema = z.object({
  name: z.string().min(1),
  goalType: z.enum(goalTypes).optional(),
  targetAmount: z.number().int().positive(),
  currentSavings: z.number().int().nonnegative().optional(),
  monthlyContribution: z.number().int().nonnegative().optional(),
  targetDate: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  priority: z.number().int().optional(),
});

const updateSchema = createSchema.partial().extend({
  status: z.enum(['active', 'achieved', 'paused', 'archived']).optional(),
});

export async function listGoals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const goals = await goalService.list(req.auth!.tenantId);
    res.json({ goals });
  } catch (err) {
    next(err);
  }
}

export async function createGoal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('name and a positive integer targetAmount (cents) are required');
    const goal = await goalService.create(req.auth!.tenantId, parsed.data);
    res.status(201).json({ goal });
  } catch (err) {
    next(err);
  }
}

export async function updateGoal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid goal payload');
    const goal = await goalService.update(req.auth!.tenantId, req.params.id, parsed.data);
    res.json({ goal });
  } catch (err) {
    next(err);
  }
}

export async function deleteGoal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await goalService.delete(req.auth!.tenantId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
