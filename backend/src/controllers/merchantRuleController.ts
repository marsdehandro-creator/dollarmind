/**
 * Merchant rule controller (Phase 16 §3) — records a merchant → category
 * override that future ingestion applies automatically.
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { adaptiveLearningService, merchantRuleRepository } from '../services/index.js';
import { ValidationError } from '@dollarmind/core/utils/errors.js';

const createSchema = z.object({
  merchant: z.string().min(1),
  category: z.string().min(1),
});

export async function createMerchantRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('merchant and category are required');
    await adaptiveLearningService.learnNewRule(req.auth!.tenantId, parsed.data.merchant, parsed.data.category);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function listMerchantRules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rules = await merchantRuleRepository.listByTenant(req.auth!.tenantId);
    res.json({ rules });
  } catch (err) {
    next(err);
  }
}
