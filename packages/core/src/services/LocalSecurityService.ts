/**
 * LocalSecurityService — server-side sessions with refresh-token rotation.
 *
 * Refresh tokens are random opaque strings; only their SHA-256 hash is stored.
 * On rotation the old session is revoked and a new one issued (detects token
 * reuse implicitly, since a used token's session is revoked).
 */
import type {
  PublicSession,
  RotatedSession,
  SecurityService,
  SessionContext,
  StartedSession,
} from './interfaces/SecurityService.js';
import type { UserSessionRepository } from '../repositories/UserSessionRepository.js';
import type { UserRepository } from '../repositories/UserRepository.js';
import type { AuditService } from './interfaces/AuditService.js';
import type { UserSession } from '../models/index.js';
import { newId, nowIso } from '../utils/id.js';
import { sha256Hex } from '../utils/hash.js';
import { signToken } from '../utils/jwt.js';
import { UnauthorizedError } from '../utils/errors.js';

const SESSION_TTL_DAYS = 30;

export class LocalSecurityService implements SecurityService {
  constructor(
    private readonly sessions: UserSessionRepository,
    private readonly users: UserRepository,
    private readonly audit: AuditService,
    private readonly jwtSecret: string,
    private readonly jwtExpiresInSeconds: number,
  ) {}

  private newRefreshToken(): { token: string; hash: string } {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    return { token, hash: sha256Hex(token) };
  }

  private expiryIso(): string {
    return new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString();
  }

  async startSession(userId: string, tenantId: string, ctx?: SessionContext): Promise<StartedSession> {
    const { token, hash } = this.newRefreshToken();
    const now = nowIso();
    const session: UserSession = {
      id: newId(),
      tenantId,
      userId,
      refreshTokenHash: hash,
      userAgent: ctx?.userAgent ?? null,
      ip: ctx?.ip ?? null,
      createdAt: now,
      lastUsedAt: now,
      expiresAt: this.expiryIso(),
      revokedAt: null,
    };
    await this.sessions.create(session);
    return { sessionId: session.id, refreshToken: token };
  }

  async rotateRefresh(refreshToken: string, ctx?: SessionContext): Promise<RotatedSession> {
    const hash = sha256Hex(refreshToken);
    const session = await this.sessions.findByRefreshHash(hash);
    if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
    const user = await this.users.findById(session.userId);
    if (!user || user.status !== 'active') throw new UnauthorizedError('User not available');

    // Rotate: revoke the old session, create a new one.
    await this.sessions.revoke(session.id);
    const { token, hash: newHash } = this.newRefreshToken();
    const now = nowIso();
    const rotated: UserSession = {
      id: newId(),
      tenantId: session.tenantId,
      userId: session.userId,
      refreshTokenHash: newHash,
      userAgent: ctx?.userAgent ?? session.userAgent,
      ip: ctx?.ip ?? session.ip,
      createdAt: now,
      lastUsedAt: now,
      expiresAt: this.expiryIso(),
      revokedAt: null,
    };
    await this.sessions.create(rotated);

    const roles = await this.users.getRoles(user.id);
    const accessToken = signToken(
      { sub: user.id, tenantId: user.tenantId, email: user.email, roles },
      this.jwtSecret,
      this.jwtExpiresInSeconds,
    );

    await this.audit.record({
      tenantId: session.tenantId,
      actor: `user:${session.userId}`,
      action: 'auth.token.refreshed',
      entityType: 'user_session',
      entityId: rotated.id,
    });
    return { sessionId: rotated.id, refreshToken: token, accessToken };
  }

  async listSessions(userId: string): Promise<PublicSession[]> {
    const sessions = await this.sessions.listActiveByUser(userId);
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
    }));
  }

  async logoutSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    if (!session || session.userId !== userId) throw new UnauthorizedError('Session not found');
    await this.sessions.revoke(sessionId);
    await this.audit.record({ tenantId: session.tenantId, actor: `user:${userId}`, action: 'auth.session.revoked', entityType: 'user_session', entityId: sessionId });
  }

  async logoutAll(userId: string): Promise<void> {
    const sessions = await this.sessions.listActiveByUser(userId);
    await this.sessions.revokeAllForUser(userId);
    const tenantId = sessions[0]?.tenantId;
    if (tenantId) {
      await this.audit.record({ tenantId, actor: `user:${userId}`, action: 'auth.session.revoked_all', entityType: 'user', entityId: userId });
    }
  }
}
