/**
 * UserRepository port.
 *
 * The storage boundary for users (docs/architecture.md §2). The pilot uses an
 * in-memory implementation; a SQLite-backed one drops in behind this same
 * interface once the driver decision is made, with no changes to services.
 */
import type { RoleName, User } from '../models/index.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(tenantId: string, email: string): Promise<User | null>;

  /** Persist a new user with its roles. */
  create(user: User, roles: RoleName[]): Promise<User>;

  getRoles(userId: string): Promise<RoleName[]>;

  /** Increment failed-login counter; may set lockedUntil (docs/security.md §2.7). */
  incrementFailedLogin(userId: string): Promise<void>;

  /** Record a successful login: reset counters, set lastLoginAt. */
  recordLogin(userId: string): Promise<void>;

  /** Replace the password hash (used by settings password change). */
  updatePassword(userId: string, passwordHash: string, passwordAlgo: string): Promise<void>;
}
