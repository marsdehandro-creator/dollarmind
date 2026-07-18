/**
 * Manual expense controller.
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { manualExpenseService } from '../services/index.js';
import { ValidationError } from '../utils/errors.js';

const createSchema = z.object({
  txnDate: z.string(),
  amount: z.number().int().positive(),
  categoryId: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

const updateSchema = z.object({
  id: z.string(),
  txnDate: z.string().optional(),
  amount: z.number().int().positive().optional(),
  categoryId: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export async function createExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('txnDate and a positive integer amount (cents) are required');
    const expense = await manualExpenseService.create(req.auth!.tenantId, parsed.data);
    res.status(201).json({ expense });
  } catch (err) {
    next(err);
  }
}

export async function updateExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('id is required');
    const { id, ...patch } = parsed.data;
    const expense = await manualExpenseService.update(req.auth!.tenantId, id, patch);
    res.json({ expense });
  } catch (err) {
    next(err);
  }
}

export async function deleteExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.body?.id;
    if (typeof id !== 'string') throw new ValidationError('id is required');
    await manualExpenseService.delete(req.auth!.tenantId, id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function listExpenses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const expenses = await manualExpenseService.list(req.auth!.tenantId);
    res.json({ expenses });
  } catch (err) {
    next(err);
  }
}
