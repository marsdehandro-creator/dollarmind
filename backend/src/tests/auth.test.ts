/**
 * Auth service tests. Exercises register -> login -> token verification and the
 * key failure paths, using fresh in-memory repositories per test for isolation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalAuthService } from '../services/LocalAuthService.js';
import { LocalAuditService } from '../services/LocalAuditService.js';
import { InMemoryUserRepository } from '../repositories/memory/InMemoryUserRepository.js';
import { InMemoryAuditRepository } from '../repositories/memory/InMemoryAuditRepository.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

function makeService() {
  const users = new InMemoryUserRepository();
  const audit = new InMemoryAuditRepository();
  const service = new LocalAuthService(users, new LocalAuditService(audit));
  return { service, users, audit };
}

const EMAIL = 'user@example.com';
const PASSWORD = 'CorrectHorseBattery1';

describe('password hashing', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash).not.toBe(PASSWORD);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('LocalAuthService', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('registers a user and returns a token', async () => {
    const result = await ctx.service.register({ email: EMAIL, password: PASSWORD });
    expect(result.token).toBeTypeOf('string');
    expect(result.user.email).toBe(EMAIL);
    expect(result.user.roles).toContain('user');
  });

  it('rejects duplicate registration', async () => {
    await ctx.service.register({ email: EMAIL, password: PASSWORD });
    await expect(ctx.service.register({ email: EMAIL, password: PASSWORD })).rejects.toThrow();
  });

  it('rejects weak passwords', async () => {
    await expect(ctx.service.register({ email: EMAIL, password: 'short' })).rejects.toThrow();
  });

  it('logs in with correct credentials and issues a verifiable token', async () => {
    await ctx.service.register({ email: EMAIL, password: PASSWORD });
    const result = await ctx.service.login({ email: EMAIL, password: PASSWORD });
    const claims = ctx.service.verifyToken(result.token);
    expect(claims.email).toBe(EMAIL);
    expect(claims.sub).toBe(result.user.id);
  });

  it('rejects wrong password', async () => {
    await ctx.service.register({ email: EMAIL, password: PASSWORD });
    await expect(ctx.service.login({ email: EMAIL, password: 'WrongPassword123' })).rejects.toThrow();
  });

  it('rejects unknown user without leaking existence', async () => {
    await expect(ctx.service.login({ email: 'nobody@example.com', password: PASSWORD })).rejects.toThrow(
      'Invalid email or password',
    );
  });

  it('records audit entries for login events', async () => {
    await ctx.service.register({ email: EMAIL, password: PASSWORD });
    await ctx.service.login({ email: EMAIL, password: PASSWORD });
    const entries = await ctx.audit.list();
    const actions = entries.map((e) => e.action);
    expect(actions).toContain('auth.register');
    expect(actions).toContain('auth.login.success');
  });
});
