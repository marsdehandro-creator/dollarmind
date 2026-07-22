/**
 * UserSettingsService + SecurityService tests (in-memory SQLite).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createConfiguredDb, type Db } from '../db/index.js';
import { SqliteUserRepository } from '../repositories/sqlite/SqliteUserRepository.js';
import { SqliteUserSettingsRepository } from '../repositories/sqlite/SqliteUserSettingsRepository.js';
import { SqliteUserSessionRepository } from '../repositories/sqlite/SqliteUserSessionRepository.js';
import { SqliteAuditRepository } from '../repositories/sqlite/SqliteAuditRepository.js';
import { LocalAuditService } from '@dollarmind/core/services/LocalAuditService.js';
import { LocalAuthService } from '@dollarmind/core/services/LocalAuthService.js';
import { LocalUserSettingsService } from '@dollarmind/core/services/LocalUserSettingsService.js';
import { LocalSecurityService } from '@dollarmind/core/services/LocalSecurityService.js';
import { DEFAULT_TENANT_ID } from '../config/index.js';

const PASSWORD = 'CorrectHorseBattery1';

function build(db: Db) {
  const users = new SqliteUserRepository(db);
  const audit = new LocalAuditService(new SqliteAuditRepository(db));
  const sessions = new SqliteUserSessionRepository(db);
  return {
    users,
    sessions,
    auth: new LocalAuthService(users, audit, 'test-jwt-secret', 3600),
    settings: new LocalUserSettingsService(new SqliteUserSettingsRepository(db), users, sessions, audit),
    security: new LocalSecurityService(sessions, users, audit, 'test-jwt-secret', 3600),
  };
}

describe('UserSettingsService', () => {
  let db: Db;
  let ctx: ReturnType<typeof build>;
  let userId: string;
  beforeEach(async () => {
    db = createConfiguredDb(':memory:');
    ctx = build(db);
    const res = await ctx.auth.register({ email: 'settings@example.com', password: PASSWORD });
    userId = res.user.id;
  });

  it('returns default preferences and persists updates', async () => {
    const defaults = await ctx.settings.getPreferences(userId, DEFAULT_TENANT_ID);
    expect(defaults.theme).toBe('system');
    expect(defaults.currency).toBe('ZAR');

    const updated = await ctx.settings.updatePreferences(userId, DEFAULT_TENANT_ID, { theme: 'dark', currency: 'USD', chartType: 'line' });
    expect(updated.theme).toBe('dark');
    expect(updated.currency).toBe('USD');
    expect(updated.chartType).toBe('line');

    const reloaded = await ctx.settings.getPreferences(userId, DEFAULT_TENANT_ID);
    expect(reloaded.theme).toBe('dark');
  });

  it('updates the display name (profile)', async () => {
    const updated = await ctx.settings.updateProfile(userId, DEFAULT_TENANT_ID, { displayName: 'Jane' });
    expect(updated.displayName).toBe('Jane');
  });

  it('changes password only with the correct current password, and revokes sessions', async () => {
    await ctx.security.startSession(userId, DEFAULT_TENANT_ID);
    expect(await ctx.security.listSessions(userId)).toHaveLength(1);

    await expect(
      ctx.settings.updatePassword(userId, { currentPassword: 'wrong', newPassword: 'NewValidPass123' }),
    ).rejects.toThrow();

    await ctx.settings.updatePassword(userId, { currentPassword: PASSWORD, newPassword: 'NewValidPass123' });
    // login works with the new password
    await expect(ctx.auth.login({ email: 'settings@example.com', password: 'NewValidPass123' })).resolves.toBeTruthy();
    // sessions revoked on password change
    expect(await ctx.security.listSessions(userId)).toHaveLength(0);
  });
});

describe('SecurityService', () => {
  let db: Db;
  let ctx: ReturnType<typeof build>;
  let userId: string;
  beforeEach(async () => {
    db = createConfiguredDb(':memory:');
    ctx = build(db);
    const res = await ctx.auth.register({ email: 'sec@example.com', password: PASSWORD });
    userId = res.user.id;
  });

  it('starts, lists, and logs out a single session', async () => {
    const s1 = await ctx.security.startSession(userId, DEFAULT_TENANT_ID);
    const s2 = await ctx.security.startSession(userId, DEFAULT_TENANT_ID);
    expect(await ctx.security.listSessions(userId)).toHaveLength(2);

    await ctx.security.logoutSession(userId, s1.sessionId);
    const remaining = await ctx.security.listSessions(userId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(s2.sessionId);
  });

  it('rotates a refresh token and invalidates the old one', async () => {
    const started = await ctx.security.startSession(userId, DEFAULT_TENANT_ID);
    const rotated = await ctx.security.rotateRefresh(started.refreshToken);
    expect(rotated.accessToken).toBeTypeOf('string');
    expect(rotated.refreshToken).not.toBe(started.refreshToken);

    // old refresh token no longer works
    await expect(ctx.security.rotateRefresh(started.refreshToken)).rejects.toThrow();
    // new one does
    await expect(ctx.security.rotateRefresh(rotated.refreshToken)).resolves.toBeTruthy();
  });

  it('logs out all sessions', async () => {
    await ctx.security.startSession(userId, DEFAULT_TENANT_ID);
    await ctx.security.startSession(userId, DEFAULT_TENANT_ID);
    await ctx.security.logoutAll(userId);
    expect(await ctx.security.listSessions(userId)).toHaveLength(0);
  });
});
