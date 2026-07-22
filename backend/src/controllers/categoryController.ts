/**
 * Category controller. Lists categories and applies manual overrides
 * (which trigger adaptive learning).
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { categoryRepository, transactionCategorizationService } from '../services/index.js';
import { ValidationError } from '@dollarmind/core/utils/errors.js';

export async function listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categories = await categoryRepository.listByTenant(req.auth!.tenantId);
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}

const updateSchema = z.object({
  transactionId: z.string(),
  categoryId: z.string(),
});

export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('transactionId and categoryId are required');
    const result = await transactionCategorizationService.overrideCategory(
      req.auth!.tenantId,
      parsed.data.transactionId,
      parsed.data.categoryId,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
