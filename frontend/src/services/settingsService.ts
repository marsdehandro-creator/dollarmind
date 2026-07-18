/**
 * Settings API client.
 */
import { apiGet, apiPost } from './apiClient.js';

export interface UserSettings {
  userId: string;
  tenantId: string;
  displayName: string | null;
  theme: 'light' | 'dark' | 'system';
  currency: string;
  chartType: 'bar' | 'line';
  defaultMonth: string;
  layout: 'auto' | 'sidebar' | 'bottomnav';
}

export async function getPreferences(): Promise<UserSettings> {
  const { settings } = await apiGet<{ settings: UserSettings }>('/settings/preferences/get');
  return settings;
}

export async function updatePreferences(patch: Partial<Pick<UserSettings, 'theme' | 'currency' | 'chartType' | 'defaultMonth' | 'layout'>>): Promise<UserSettings> {
  const { settings } = await apiPost<{ settings: UserSettings }>('/settings/preferences/update', patch);
  return settings;
}

export async function updateProfile(displayName: string): Promise<UserSettings> {
  const { settings } = await apiPost<{ settings: UserSettings }>('/settings/profile/update', { displayName });
  return settings;
}

export function updatePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return apiPost('/settings/password/update', { currentPassword, newPassword });
}
