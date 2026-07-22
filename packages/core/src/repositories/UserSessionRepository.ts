/**
 * UserSessionRepository port. Server-side sessions for refresh-token rotation
 * (docs/security.md §2.4).
 */
import type { UserSession } from '../models/index.js';

export interface UserSessionRepository {
  create(session: UserSession): Promise<UserSession>;
  findByRefreshHash(refreshTokenHash: string): Promise<UserSession | null>;
  findById(id: string): Promise<UserSession | null>;
  /** Non-revoked, non-expired sessions for a user, newest first. */
  listActiveByUser(userId: string): Promise<UserSession[]>;
  touch(id: string, lastUsedAt: string): Promise<void>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
