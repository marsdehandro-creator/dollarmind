/**
 * Middleware + authorization tests: requireAuth, requireRole, and the logout
 * audit path. Uses mock req/res/next; tokens are real (signed via the jwt util).
 */
import { describe, it, expect, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { logout } from '../controllers/authController.js';
import { signToken } from '@dollarmind/core/utils/jwt.js';
import { HttpError } from '@dollarmind/core/utils/errors.js';
import { auditRepository } from '../services/index.js';
import { DEFAULT_TENANT_ID, env } from '../config/index.js';
import type { AuthTokenPayload } from '@dollarmind/core/services/interfaces/AuthService.js';

function tokenFor(roles: AuthTokenPayload['roles']): string {
  return signToken(
    {
      sub: 'user-1',
      tenantId: 'tenant-1',
      email: 'u@example.com',
      roles,
    },
    env.JWT_SECRET,
    env.JWT_EXPIRES_IN,
  );
}

function mockRes(): Response {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() } as unknown as Response;
}

describe('requireAuth', () => {
  it('rejects a missing Authorization header', () => {
    const req = { headers: {} } as Request;
    const next = vi.fn() as NextFunction;
    requireAuth(req, mockRes(), next);
    const err = (next as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(401);
  });

  it('accepts a valid Bearer token and sets req.auth', () => {
    const req = { headers: { authorization: `Bearer ${tokenFor(['user'])}` } } as Request;
    const next = vi.fn() as NextFunction;
    requireAuth(req, mockRes(), next);
    expect((next as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBeUndefined();
    expect(req.auth?.email).toBe('u@example.com');
  });
});

describe('requireRole', () => {
  it('allows a user with a matching role', () => {
    const req = { auth: { sub: 'x', tenantId: 't', email: 'e', roles: ['admin'] } } as Request;
    const next = vi.fn() as NextFunction;
    requireRole('admin')(req, mockRes(), next);
    expect((next as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBeUndefined();
  });

  it('forbids a user without the required role', () => {
    const req = { auth: { sub: 'x', tenantId: 't', email: 'e', roles: ['user'] } } as Request;
    const next = vi.fn() as NextFunction;
    requireRole('admin')(req, mockRes(), next);
    const err = (next as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
  });
});

describe('logout', () => {
  it('records an auth.logout audit entry', async () => {
    const req = {
      auth: { sub: 'user-99', tenantId: DEFAULT_TENANT_ID, email: 'e', roles: ['user'] },
    } as Request;
    const res = mockRes();
    await logout(req, res, vi.fn() as NextFunction);
    const entries = await auditRepository.list(DEFAULT_TENANT_ID);
    expect(entries.some((e) => e.action === 'auth.logout' && e.entityId === 'user-99')).toBe(true);
  });
});
