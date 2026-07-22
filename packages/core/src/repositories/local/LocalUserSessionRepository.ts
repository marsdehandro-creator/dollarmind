/**
 * On-device (LocalDbDriver-backed) UserSessionRepository. Same SQL/shape as
 * SqliteUserSessionRepository. Preserved for V2 reuse — not wired into V1's runtime.
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { UserSession } from '../../models/index.js';
import type { UserSessionRepository } from '../UserSessionRepository.js';
import { nowIso } from '../../utils/id.js';
import { rowToUserSession, type Row } from '../rowMappers.js';

export class LocalUserSessionRepository implements UserSessionRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async create(session: UserSession): Promise<UserSession> {
    await this.db.run(
      `INSERT INTO user_session (id, tenant_id, user_id, refresh_token_hash, user_agent, ip, created_at, last_used_at, expires_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.tenantId,
        session.userId,
        session.refreshTokenHash,
        session.userAgent,
        session.ip,
        session.createdAt,
        session.lastUsedAt,
        session.expiresAt,
        session.revokedAt,
      ],
    );
    return session;
  }

  async findByRefreshHash(refreshTokenHash: string): Promise<UserSession | null> {
    const rows = await this.db.query<Row>('SELECT * FROM user_session WHERE refresh_token_hash = ?', [
      refreshTokenHash,
    ]);
    return rows[0] ? rowToUserSession(rows[0]) : null;
  }

  async findById(id: string): Promise<UserSession | null> {
    const rows = await this.db.query<Row>('SELECT * FROM user_session WHERE id = ?', [id]);
    return rows[0] ? rowToUserSession(rows[0]) : null;
  }

  async listActiveByUser(userId: string): Promise<UserSession[]> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM user_session WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC',
      [userId, nowIso()],
    );
    return rows.map(rowToUserSession);
  }

  async touch(id: string, lastUsedAt: string): Promise<void> {
    await this.db.run('UPDATE user_session SET last_used_at = ? WHERE id = ?', [lastUsedAt, id]);
  }

  async revoke(id: string): Promise<void> {
    await this.db.run('UPDATE user_session SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', [
      nowIso(),
      id,
    ]);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.run('UPDATE user_session SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [
      nowIso(),
      userId,
    ]);
  }
}
