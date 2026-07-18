/**
 * UserSettingsService port — profile, password, and preferences.
 */
import type { UserSettings } from '../../models/index.js';

export interface ProfileUpdate {
  displayName?: string | null;
}

export interface PreferencesUpdate {
  theme?: 'light' | 'dark' | 'system';
  currency?: string;
  chartType?: 'bar' | 'line';
  defaultMonth?: string;
  layout?: 'auto' | 'sidebar' | 'bottomnav';
}

export interface PasswordUpdate {
  currentPassword: string;
  newPassword: string;
}

export interface UserSettingsService {
  getPreferences(userId: string, tenantId: string): Promise<UserSettings>;
  updateProfile(userId: string, tenantId: string, patch: ProfileUpdate): Promise<UserSettings>;
  updatePreferences(userId: string, tenantId: string, patch: PreferencesUpdate): Promise<UserSettings>;
  /** Verifies the current password, sets the new one, and revokes all sessions. */
  updatePassword(userId: string, patch: PasswordUpdate): Promise<void>;
}
