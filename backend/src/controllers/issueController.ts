/**
 * Issue log controller (placeholder). Data-quality + user-reported issues (F7).
 */
import type { Request, Response } from 'express';

export function listIssues(_req: Request, res: Response): void {
  res.status(501).json({ error: 'not_implemented', feature: 'issue.list' });
}

export function resolveIssue(_req: Request, res: Response): void {
  res.status(501).json({ error: 'not_implemented', feature: 'issue.resolve' });
}
