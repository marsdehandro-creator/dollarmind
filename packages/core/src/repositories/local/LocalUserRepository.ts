/**
 * On-device (LocalDbDriver-backed) UserRepository. Same SQL/shape as
 * SqliteUserRepository. Preserved for V2 reuse — not wired into V1's runtime.
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { RoleName, User } from '../../models/index.js';
import type { UserRepository } from '../UserRepository.js';
import { nowIso } from '../../utils/id.js';
import { rowToUser, type Row } from '../rowMappers.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export class LocalUserRepository implements UserRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async findById(id: string): Promise<User | null> {
    const rows = await this.db.query<Row>('SELECT * FROM "user" WHERE id = ?', [id]);
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    const rows = await this.db.query<Row>('SELECT * FROM "user" WHERE tenant_id = ? AND email = ?', [
      tenantId,
      email.toLowerCase(),
    ]);
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  async create(user: User, roles: RoleName[]): Promise<User> {
    await this.db.run(
      `INSERT INTO "user" (id, tenant_id, email, email_verified_at, password_hash,
         password_algo, status, failed_login_count, locked_until, mfa_enabled,
         last_login_at, created_at, updated_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ],
    );

    for (const role of roles) {
      const roleRows = await this.db.query<{ id: string }>('SELECT id FROM role WHERE name = ?', [role]);
      if (roleRows[0]) {
        await this.db.run('INSERT OR IGNORE INTO user_role (user_id, role_id, tenant_id) VALUES (?, ?, ?)', [
          user.id,
          roleRows[0].id,
          user.tenantId,
        ]);
      }
    }
    return user;
  }

  async getRoles(userId: string): Promise<RoleName[]> {
    const rows = await this.db.query<{ name: RoleName }>(
      `SELECT r.name FROM user_role ur JOIN role r ON r.id = ur.role_id WHERE ur.user_id = ?`,
      [userId],
    );
    return rows.map((r) => r.name);
  }

  async incrementFailedLogin(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;
    const count = user.failedLoginCount + 1;
    const lockedUntil =
      count >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : user.lockedUntil;
    await this.db.run('UPDATE "user" SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?', [
      count,
      lockedUntil,
      nowIso(),
      userId,
    ]);
  }

  async recordLogin(userId: string): Promise<void> {
    const now = nowIso();
    await this.db.run(
      'UPDATE "user" SET failed_login_count = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?',
      [now, now, userId],
    );
  }

  async updatePassword(userId: string, passwordHash: string, passwordAlgo: string): Promise<void> {
    await this.db.run('UPDATE "user" SET password_hash = ?, password_algo = ?, updated_at = ? WHERE id = ?', [
      passwordHash,
      passwordAlgo,
      nowIso(),
      userId,
    ]);
  }
}
