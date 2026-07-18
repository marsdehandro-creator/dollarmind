/**
 * In-memory UserRepository (pilot bootstrap).
 *
 * Deliberately non-persistent: data resets on restart. It exists so the auth
 * flow is fully functional today without a native SQLite build. Replace with a
 * SQLite-backed repository in a later step — the interface stays identical.
 */
import type { RoleName, User } from '../../models/index.js';
import type { UserRepository } from '../UserRepository.js';
import { nowIso } from '../../utils/id.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, User>();
  private readonly roles = new Map<string, RoleName[]>();

  private key(tenantId: string, email: string): string {
    return `${tenantId}::${email.toLowerCase()}`;
  }

  private readonly byEmail = new Map<string, string>(); // key -> userId

  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    const id = this.byEmail.get(this.key(tenantId, email));
    return id ? (this.byId.get(id) ?? null) : null;
  }

  async create(user: User, roles: RoleName[]): Promise<User> {
    this.byId.set(user.id, user);
    this.byEmail.set(this.key(user.tenantId, user.email), user.id);
    this.roles.set(user.id, roles);
    return user;
  }

  async getRoles(userId: string): Promise<RoleName[]> {
    return this.roles.get(userId) ?? [];
  }

  async incrementFailedLogin(userId: string): Promise<void> {
    const user = this.byId.get(userId);
    if (!user) return;
    user.failedLoginCount += 1;
    if (user.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
    }
    user.updatedAt = nowIso();
  }

  async recordLogin(userId: string): Promise<void> {
    const user = this.byId.get(userId);
    if (!user) return;
    user.failedLoginCount = 0;
    user.lockedUntil = null;
    user.lastLoginAt = nowIso();
    user.updatedAt = nowIso();
  }

  async updatePassword(userId: string, passwordHash: string, passwordAlgo: string): Promise<void> {
    const user = this.byId.get(userId);
    if (!user) return;
    user.passwordHash = passwordHash;
    user.passwordAlgo = passwordAlgo;
    user.updatedAt = nowIso();
  }
}
