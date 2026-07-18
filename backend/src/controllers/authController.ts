/**
 * Auth controller. Thin HTTP layer over AuthService.
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { authService, auditService, securityService } from '../services/index.js';
import { MIN_PASSWORD_LENGTH } from '../utils/password.js';
import { ValidationError } from '../utils/errors.js';

function sessionContext(req: Request) {
  return { userAgent: req.headers['user-agent'] ?? null, ip: req.ip ?? null };
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  displayName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid registration payload');
    const result = await authService.register(parsed.data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid login payload');
    const result = await authService.login(parsed.data);
    // Start a server-side session (refresh-token rotation) alongside the JWT.
    const session = await securityService.startSession(result.user.id, result.user.tenantId, sessionContext(req));
    res.json({ ...result, refreshToken: session.refreshToken, sessionId: session.sessionId });
  } catch (err) {
    next(err);
  }
}

/** Returns the authenticated user's claims. Protected by requireAuth. */
export function me(req: Request, res: Response): void {
  res.json({
    user: {
      id: req.auth!.sub,
      tenantId: req.auth!.tenantId,
      email: req.auth!.email,
      roles: req.auth!.roles,
    },
  });
}

/**
 * Logout. JWTs are stateless so this cannot invalidate the token server-side
 * yet; it records the event for audit (docs/security.md §5) and the client
 * drops the token. A token denylist / refresh-token revocation can be layered
 * on later behind the same endpoint.
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await auditService.record({
      tenantId: req.auth!.tenantId,
      actor: `user:${req.auth!.sub}`,
      action: 'auth.logout',
      entityType: 'user',
      entityId: req.auth!.sub,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
