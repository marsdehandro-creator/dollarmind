/**
 * Session controller: list active sessions, logout one, logout all, refresh.
 */
import type { NextFunction, Request, Response } from 'express';
import { securityService } from '../services/index.js';
import { ValidationError } from '../utils/errors.js';

export async function listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessions = await securityService.listSessions(req.auth!.sub);
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
}

export async function logoutSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = req.body?.sessionId;
    if (typeof sessionId !== 'string') throw new ValidationError('sessionId is required');
    await securityService.logoutSession(req.auth!.sub, sessionId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await securityService.logoutAll(req.auth!.sub);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** Refresh-token rotation (public — the refresh token is the credential). */
export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = req.body?.refreshToken;
    if (typeof refreshToken !== 'string') throw new ValidationError('refreshToken is required');
    const ctx = { userAgent: req.headers['user-agent'] ?? null, ip: req.ip ?? null };
    const result = await securityService.rotateRefresh(refreshToken, ctx);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
