/**
 * Central error handler. Maps HttpError -> status; everything else -> 500.
 * IngestError additionally carries severity + suggestion (business errors).
 * Never leaks internal error detail to the client.
 */
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/errors.js';
import { IngestError } from '../utils/ingestErrors.js';
import { logger } from '../utils/logger.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof IngestError) {
    res.status(err.status).json({
      error: err.code,
      message: err.message,
      severity: err.severity,
      suggestion: err.suggestion,
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  logger.error('unhandled error', { err: err instanceof Error ? err.message : String(err) });
  res.status(500).json({ error: 'internal_error', message: 'Something went wrong' });
}
