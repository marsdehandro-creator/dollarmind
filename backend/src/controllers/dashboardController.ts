/**
 * Dashboard controller. Thin HTTP layer over DashboardService.
 */
import type { NextFunction, Request, Response } from 'express';
import { dashboardService, dashboardAggregationService } from '../services/index.js';

function month(req: Request): string | undefined {
  return typeof req.query.month === 'string' ? req.query.month : undefined;
}

/** Default range: last 30 days ending today (used when from/to omitted). */
function range(req: Request): { from: string; to: string } {
  const today = new Date();
  const to = typeof req.query.to === 'string' ? req.query.to : today.toISOString().slice(0, 10);
  const from =
    typeof req.query.from === 'string'
      ? req.query.from
      : new Date(today.getTime() - 29 * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}

/** Unified, range-driven dashboard (Phase 18): GET /api/dashboard?from=&to= */
export async function unified(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { from, to } = range(req);
    res.json(await dashboardAggregationService.getDashboard(req.auth!.tenantId, from, to));
  } catch (err) {
    next(err);
  }
}

export async function overview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await dashboardService.overview(req.auth!.tenantId, month(req)));
  } catch (err) {
    next(err);
  }
}

export async function categories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await dashboardService.categories(req.auth!.tenantId, month(req)));
  } catch (err) {
    next(err);
  }
}

export async function cashflow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const period = req.query.period === 'daily' || req.query.period === 'weekly' ? req.query.period : 'monthly';
    res.json(await dashboardService.cashflow(req.auth!.tenantId, period));
  } catch (err) {
    next(err);
  }
}

export async function alerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await dashboardService.alerts(req.auth!.tenantId));
  } catch (err) {
    next(err);
  }
}
