/**
 * On-device preferences. V1 has no accounts (no profile, no password) — see
 * AuthContext.tsx — so this only covers display preferences (theme,
 * currency, chart type, layout, default month), stored in the on-device
 * user_settings table under a single local-user row (DEFAULT_TENANT_ID
 * stands in for both userId and tenantId, matching AuthContext's LOCAL_USER).
 */
import { getContainer } from '../local/container.js';
import { DEFAULT_TENANT_ID } from '@dollarmind/core/constants.js';
import { nowIso } from '@dollarmind/core/utils/id.js';

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  currency: string;
  chartType: 'bar' | 'line';
  defaultMonth: string;
  layout: 'auto' | 'sidebar' | 'bottomnav';
}

const DEFAULTS: UserSettings = {
  theme: 'system',
  currency: 'ZAR',
  chartType: 'bar',
  defaultMonth: 'current',
  layout: 'auto',
};

export async function getPreferences(): Promise<UserSettings> {
  const { userSettingsRepository } = await getContainer();
  const existing = await userSettingsRepository.findByUser(DEFAULT_TENANT_ID);
  if (existing) {
    const { theme, currency, chartType, defaultMonth, layout } = existing;
    return { theme, currency, chartType, defaultMonth, layout };
  }
  return DEFAULTS;
}

export async function updatePreferences(patch: Partial<UserSettings>): Promise<UserSettings> {
  const { userSettingsRepository } = await getContainer();
  const current = await getPreferences();
  const merged: UserSettings = { ...current, ...patch };
  const now = nowIso();
  const existing = await userSettingsRepository.findByUser(DEFAULT_TENANT_ID);
  await userSettingsRepository.save({
    userId: DEFAULT_TENANT_ID,
    tenantId: DEFAULT_TENANT_ID,
    displayName: null,
    ...merged,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  return merged;
}
