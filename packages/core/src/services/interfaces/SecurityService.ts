/**
 * SecurityService port — server-side sessions + refresh-token rotation
 * (docs/security.md §2.4).
 */
export interface SessionContext {
  userAgent?: string | null;
  ip?: string | null;
}

export interface StartedSession {
  sessionId: string;
  refreshToken: string;
}

export interface RotatedSession {
  sessionId: string;
  refreshToken: string;
  accessToken: string;
}

export interface PublicSession {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export interface SecurityService {
  /** Create a session and return its id + a one-time refresh token. */
  startSession(userId: string, tenantId: string, ctx?: SessionContext): Promise<StartedSession>;
  /** Validate + rotate a refresh token, issuing a fresh access + refresh token. */
  rotateRefresh(refreshToken: string, ctx?: SessionContext): Promise<RotatedSession>;
  listSessions(userId: string): Promise<PublicSession[]>;
  logoutSession(userId: string, sessionId: string): Promise<void>;
  logoutAll(userId: string): Promise<void>;
}
