/**
 * Role-based authorization middleware (docs/security.md §2.6).
 *
 * Must run AFTER requireAuth (it reads req.auth). Grants access if the user has
 * at least one of the allowed roles; otherwise 403. Deny-by-default.
 */
import type { NextFunction, Request, Response } from 'express';
import type { RoleName } from '../models/index.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export function requireRole(...allowed: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }
    const hasRole = req.auth.roles.some((role) => allowed.includes(role));
    if (!hasRole) {
      next(new ForbiddenError('Insufficient role'));
      return;
    }
    next();
  };
}
