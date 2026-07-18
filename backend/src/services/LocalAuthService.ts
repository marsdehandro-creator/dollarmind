/**
 * LocalAuthService — pilot implementation of the AuthService port.
 *
 * Implements register/login with bcrypt hashing, JWT issuance, basic lockout,
 * user-enumeration-resistant login, and audit logging of auth events
 * (docs/security.md §2.3, §2.5, §5).
 */
import type {
  AuthResult,
  AuthService,
  AuthTokenPayload,
  LoginInput,
  PublicUser,
  RegisterInput,
} from './interfaces/AuthService.js';
import type { AuditService } from './interfaces/AuditService.js';
import type { UserRepository } from '../repositories/UserRepository.js';
import type { RoleName, User } from '../models/index.js';
import { DEFAULT_TENANT_ID } from '../config/index.js';
import { newId, nowIso } from '../utils/id.js';
import {
  DUMMY_HASH,
  MIN_PASSWORD_LENGTH,
  PASSWORD_ALGO,
  hashPassword,
  verifyPassword,
} from '../utils/password.js';
import { signToken, verifyJwt } from '../utils/jwt.js';
import { ConflictError, UnauthorizedError, ValidationError } from '../utils/errors.js';

const GENERIC_LOGIN_ERROR = 'Invalid email or password';

export class LocalAuthService implements AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    if (!email.includes('@')) throw new ValidationError('A valid email is required');
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const existing = await this.users.findByEmail(DEFAULT_TENANT_ID, email);
    if (existing) throw new ConflictError('An account with this email already exists');

    const now = nowIso();
    const roles: RoleName[] = ['user'];
    const user: User = {
      id: newId(),
      tenantId: DEFAULT_TENANT_ID,
      email,
      emailVerifiedAt: null,
      passwordHash: await hashPassword(input.password),
      passwordAlgo: PASSWORD_ALGO,
      status: 'active',
      failedLoginCount: 0,
      lockedUntil: null,
      mfaEnabled: false,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };

    await this.users.create(user, roles);
    await this.audit.record({
      tenantId: user.tenantId,
      actor: `user:${user.id}`,
      action: 'auth.register',
      entityType: 'user',
      entityId: user.id,
    });

    return this.issue(user, roles);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(DEFAULT_TENANT_ID, email);

    // Always run a compare (dummy when user is missing) to avoid revealing
    // whether the email exists (docs/security.md §2.5).
    const hash = user?.passwordHash ?? DUMMY_HASH;
    const passwordOk = await verifyPassword(input.password, hash);

    if (!user || user.passwordHash === null) {
      await this.recordFailure(DEFAULT_TENANT_ID, email, 'unknown_user');
      throw new UnauthorizedError(GENERIC_LOGIN_ERROR);
    }

    if (user.status !== 'active') {
      await this.recordFailure(user.tenantId, email, 'inactive', user.id);
      throw new UnauthorizedError(GENERIC_LOGIN_ERROR);
    }

    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      await this.recordFailure(user.tenantId, email, 'locked', user.id);
      throw new UnauthorizedError('Account temporarily locked. Try again later.');
    }

    if (!passwordOk) {
      await this.users.incrementFailedLogin(user.id);
      await this.recordFailure(user.tenantId, email, 'bad_password', user.id);
      throw new UnauthorizedError(GENERIC_LOGIN_ERROR);
    }

    await this.users.recordLogin(user.id);
    const roles = await this.users.getRoles(user.id);
    await this.audit.record({
      tenantId: user.tenantId,
      actor: `user:${user.id}`,
      action: 'auth.login.success',
      entityType: 'user',
      entityId: user.id,
    });

    return this.issue(user, roles);
  }

  verifyToken(token: string): AuthTokenPayload {
    return verifyJwt(token);
  }

  private async recordFailure(
    tenantId: string,
    email: string,
    reason: string,
    userId?: string,
  ): Promise<void> {
    await this.audit.record({
      tenantId,
      actor: userId ? `user:${userId}` : 'anonymous',
      action: 'auth.login.failure',
      entityType: 'user',
      entityId: userId ?? null,
      // Minimized: reason only, never the attempted password (docs/security.md §5.3).
      context: { reason, email },
    });
  }

  private issue(user: User, roles: RoleName[]): AuthResult {
    const payload: AuthTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
    };
    const publicUser: PublicUser = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
    };
    return { token: signToken(payload), user: publicUser };
  }
}
