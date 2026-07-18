/**
 * SQLite-backed UserSessionRepository.
 */
import type { Db } from '../../db/connection.js';
import type { UserSession } from '../../models/index.js';
import type { UserSessionRepository } from '../UserSessionRepository.js';
import { nowIso } from '../../utils/id.js';
import { rowToUserSession, type Row } from './rowMappers.js';

export class SqliteUserSessionRepository implements UserSessionRepository {
  constructor(private readonly db: Db) {}

  async create(session: UserSession): Promise<UserSession> {
    this.db
      .prepare(
        `INSERT INTO user_session (id, tenant_id, user_id, refresh_token_hash, user_agent, ip, created_at, last_used_at, expires_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
      );
    return session;
  }

  async findByRefreshHash(refreshTokenHash: string): Promise<UserSession | null> {
    const row = this.db
      .prepare('SELECT * FROM user_session WHERE refresh_token_hash = ?')
      .get(refreshTokenHash) as Row | undefined;
    return row ? rowToUserSession(row) : null;
  }

  async findById(id: string): Promise<UserSession | null> {
    const row = this.db.prepare('SELECT * FROM user_session WHERE id = ?').get(id) as Row | undefined;
    return row ? rowToUserSession(row) : null;
  }

  async listActiveByUser(userId: string): Promise<UserSession[]> {
    const rows = this.db
      .prepare('SELECT * FROM user_session WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC')
      .all(userId, nowIso()) as Row[];
    return rows.map(rowToUserSession);
  }

  async touch(id: string, lastUsedAt: string): Promise<void> {
    this.db.prepare('UPDATE user_session SET last_used_at = ? WHERE id = ?').run(lastUsedAt, id);
  }

  async revoke(id: string): Promise<void> {
    this.db.prepare('UPDATE user_session SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(nowIso(), id);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    this.db.prepare('UPDATE user_session SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(nowIso(), userId);
  }
}
