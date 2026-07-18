/**
 * Health controller (placeholder). Real controllers receive services via
 * dependency injection in Phase 6.
 */
import type { Request, Response } from 'express';

export function getStatus(_req: Request, res: Response): void {
  res.json({ status: 'ok', phase: 'scaffold' });
}
