/**
 * Transaction controller. Thin HTTP layer over TransactionService.
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { transactionService } from '../services/index.js';
import type { TransactionFilterCriteria } from '../repositories/TransactionRepository.js';

export async function listTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const transactions = await transactionService.list(req.auth!.tenantId, { limit, offset });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
}

const filterSchema = z.object({
  accountId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  merchant: z.string().optional(),
  amountMin: z.number().optional(),
  amountMax: z.number().optional(),
  direction: z.enum(['debit', 'credit']).optional(),
  categoryId: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

export async function filterTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = filterSchema.safeParse(req.body ?? {});
    const criteria: TransactionFilterCriteria = parsed.success ? parsed.data : {};
    const transactions = await transactionService.filter(req.auth!.tenantId, criteria);
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
}
