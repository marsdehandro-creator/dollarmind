/**
 * Spending controller: auto-categorization trigger + summaries + trends.
 */
import type { NextFunction, Request, Response } from 'express';
import { spendingSummaryService, transactionCategorizationService } from '../services/index.js';

export async function categorize(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await transactionCategorizationService.categorizeUncategorized(req.auth!.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function summary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dateFrom = typeof req.query.from === 'string' ? req.query.from : undefined;
    const dateTo = typeof req.query.to === 'string' ? req.query.to : undefined;
    const result = await spendingSummaryService.monthlySummary(req.auth!.tenantId, dateFrom, dateTo);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function trends(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const months = req.query.months ? Number(req.query.months) : undefined;
    const result = await spendingSummaryService.trends(req.auth!.tenantId, months);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
