/**
 * Cash entry controller.
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { cashEntryService } from '../services/index.js';
import { ValidationError } from '../utils/errors.js';

const createSchema = z.object({
  entryDate: z.string(),
  direction: z.enum(['inflow', 'outflow']),
  amount: z.number().int().positive(),
  categoryId: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export async function createCashEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('entryDate, direction (inflow/outflow), and a positive integer amount (cents) are required');
    const entry = await cashEntryService.create(req.auth!.tenantId, parsed.data);
    res.status(201).json({ entry });
  } catch (err) {
    next(err);
  }
}

export async function listCashEntries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entries = await cashEntryService.list(req.auth!.tenantId);
    res.json({ entries });
  } catch (err) {
    next(err);
  }
}
