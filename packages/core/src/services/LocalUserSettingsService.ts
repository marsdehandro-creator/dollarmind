/**
 * LocalUserSettingsService — profile, preferences, and password change.
 */
import type {
  PasswordUpdate,
  PreferencesUpdate,
  ProfileUpdate,
  UserSettingsService,
} from './interfaces/UserSettingsService.js';
import type { UserSettingsRepository } from '../repositories/UserSettingsRepository.js';
import type { UserRepository } from '../repositories/UserRepository.js';
import type { UserSessionRepository } from '../repositories/UserSessionRepository.js';
import type { AuditService } from './interfaces/AuditService.js';
import type { UserSettings } from '../models/index.js';
import { nowIso } from '../utils/id.js';
import { hashPassword, verifyPassword, PASSWORD_ALGO, MIN_PASSWORD_LENGTH } from '../utils/password.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';

export class LocalUserSettingsService implements UserSettingsService {
  constructor(
    private readonly settings: UserSettingsRepository,
    private readonly users: UserRepository,
    private readonly sessions: UserSessionRepository,
    private readonly audit: AuditService,
  ) {}

  async getPreferences(userId: string, tenantId: string): Promise<UserSettings> {
    const existing = await this.settings.findByUser(userId);
    if (existing) return existing;
    const now = nowIso();
    const defaults: UserSettings = {
      userId,
      tenantId,
      displayName: null,
      theme: 'system',
      currency: 'ZAR',
      chartType: 'bar',
      defaultMonth: 'current',
      layout: 'auto',
      createdAt: now,
      updatedAt: now,
    };
    return this.settings.save(defaults);
  }

  async updateProfile(userId: string, tenantId: string, patch: ProfileUpdate): Promise<UserSettings> {
    const current = await this.getPreferences(userId, tenantId);
    const updated: UserSettings = {
      ...current,
      displayName: patch.displayName !== undefined ? patch.displayName : current.displayName,
      updatedAt: nowIso(),
    };
    await this.settings.save(updated);
    await this.audit.record({ tenantId, actor: `user:${userId}`, action: 'settings.profile.updated', entityType: 'user', entityId: userId });
    return updated;
  }

  async updatePreferences(userId: string, tenantId: string, patch: PreferencesUpdate): Promise<UserSettings> {
    const current = await this.getPreferences(userId, tenantId);
    const updated: UserSettings = {
      ...current,
      theme: patch.theme ?? current.theme,
      currency: patch.currency ?? current.currency,
      chartType: patch.chartType ?? current.chartType,
      defaultMonth: patch.defaultMonth ?? current.defaultMonth,
      layout: patch.layout ?? current.layout,
      updatedAt: nowIso(),
    };
    await this.settings.save(updated);
    await this.audit.record({ tenantId, actor: `user:${userId}`, action: 'settings.preferences.updated', entityType: 'user', entityId: userId });
    return updated;
  }

  async updatePassword(userId: string, patch: PasswordUpdate): Promise<void> {
    if (patch.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    const user = await this.users.findById(userId);
    if (!user || !user.passwordHash) throw new UnauthorizedError('User not found');

    const ok = await verifyPassword(patch.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedError('Current password is incorrect');

    const hash = await hashPassword(patch.newPassword);
    await this.users.updatePassword(userId, hash, PASSWORD_ALGO);
    // Security: invalidate all refresh sessions on password change (docs/security.md §2.5).
    await this.sessions.revokeAllForUser(userId);
    await this.audit.record({
      tenantId: user.tenantId,
      actor: `user:${userId}`,
      action: 'auth.password.changed',
      entityType: 'user',
      entityId: userId,
    });
  }
}
