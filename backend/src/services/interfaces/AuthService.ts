/**
 * AuthService port (docs/security.md §2.1).
 *
 * The stable interface both the pilot (LocalAuthService) and a future SaaS
 * provider implement. This phase is JWT-based; the interface is intentionally
 * shaped so refresh tokens / revocation can be layered on without breaking
 * callers.
 */
import type { RoleName } from '../../models/index.js';

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** User shape safe to return to clients — never includes the password hash. */
export interface PublicUser {
  id: string;
  tenantId: string;
  email: string;
  roles: RoleName[];
}

/** Claims embedded in the signed JWT. */
export interface AuthTokenPayload {
  sub: string; // user id
  tenantId: string;
  email: string;
  roles: RoleName[];
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export interface AuthService {
  register(input: RegisterInput): Promise<AuthResult>;
  login(input: LoginInput): Promise<AuthResult>;
  /** Verify a JWT and return its claims. Throws UnauthorizedError if invalid. */
  verifyToken(token: string): AuthTokenPayload;
}
