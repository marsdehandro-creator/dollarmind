/**
 * JWT authentication middleware.
 *
 * Reads a Bearer token from the Authorization header, verifies it, and attaches
 * the claims to req.auth. Rejects with 401 otherwise (docs/security.md §2.4).
 */
import type { NextFunction, Request, Response } from 'express';
import { authService } from '../services/index.js';
import { UnauthorizedError } from '@dollarmind/core/utils/errors.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
    return;
  }

  try {
    req.auth = authService.verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
