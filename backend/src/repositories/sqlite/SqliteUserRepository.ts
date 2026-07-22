/**
 * SQLite-backed UserRepository (persists Phase 6 auth).
 */
import type { Db } from '../../db/connection.js';
import type { RoleName, User } from '@dollarmind/core/models/index.js';
import type { UserRepository } from '@dollarmind/core/repositories/UserRepository.js';
import { nowIso } from '@dollarmind/core/utils/id.js';
import { rowToUser, type Row } from '@dollarmind/core/repositories/rowMappers.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<User | null> {
    const row = this.db.prepare('SELECT * FROM "user" WHERE id = ?').get(id) as Row | undefined;
    return row ? rowToUser(row) : null;
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    const row = this.db
      .prepare('SELECT * FROM "user" WHERE tenant_id = ? AND email = ?')
      .get(tenantId, email.toLowerCase()) as Row | undefined;
    return row ? rowToUser(row) : null;
  }

  async create(user: User, roles: RoleName[]): Promise<User> {
    this.db
      .prepare(
        `INSERT INTO "user" (id, tenant_id, email, email_verified_at, password_hash,
           password_algo, status, failed_login_count, locked_until, mfa_enabled,
           last_login_at, created_at, updated_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        user.id,
        user.tenantId,
        user.email,
        user.emailVerifiedAt,
        user.passwordHash,
        user.passwordAlgo,
        user.status,
        user.failedLoginCount,
        user.lockedUntil,
        user.mfaEnabled ? 1 : 0,
        user.lastLoginAt,
        user.createdAt,
        user.updatedAt,
        user.archivedAt,
      );

    const findRole = this.db.prepare('SELECT id FROM role WHERE name = ?');
    const linkRole = this.db.prepare(
      'INSERT OR IGNORE INTO user_role (user_id, role_id, tenant_id) VALUES (?, ?, ?)',
    );
    for (const role of roles) {
      const roleRow = findRole.get(role) as { id: string } | undefined;
      if (roleRow) linkRole.run(user.id, roleRow.id, user.tenantId);
    }
    return user;
  }

  async getRoles(userId: string): Promise<RoleName[]> {
    const rows = this.db
      .prepare(
        `SELECT r.name FROM user_role ur JOIN role r ON r.id = ur.role_id WHERE ur.user_id = ?`,
      )
      .all(userId) as { name: RoleName }[];
    return rows.map((r) => r.name);
  }

  async incrementFailedLogin(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;
    const count = user.failedLoginCount + 1;
    const lockedUntil =
      count >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
        : user.lockedUntil;
    this.db
      .prepare('UPDATE "user" SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?')
      .run(count, lockedUntil, nowIso(), userId);
  }

  async recordLogin(userId: string): Promise<void> {
    const now = nowIso();
    this.db
      .prepare(
        'UPDATE "user" SET failed_login_count = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?',
      )
      .run(now, now, userId);
  }

  async updatePassword(userId: string, passwordHash: string, passwordAlgo: string): Promise<void> {
    this.db
      .prepare('UPDATE "user" SET password_hash = ?, password_algo = ?, updated_at = ? WHERE id = ?')
      .run(passwordHash, passwordAlgo, nowIso(), userId);
  }
}
