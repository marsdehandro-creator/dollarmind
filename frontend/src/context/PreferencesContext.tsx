/**
 * PreferencesContext — loads the on-device preferences on mount and applies
 * them globally: theme (via a data-theme attribute), currency (via the money
 * util), and exposes chartType / defaultMonth for components.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getPreferences, updatePreferences as apiUpdate, type UserSettings } from '../services/settingsService.js';
import { setCurrency } from '../utils/money.js';

interface PreferencesState {
  preferences: UserSettings | null;
  refresh: () => Promise<void>;
  update: (patch: Partial<UserSettings>) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesState | undefined>(undefined);

function applyTheme(theme: UserSettings['theme']): void {
  const resolved =
    theme === 'system'
      ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
  document.documentElement.setAttribute('data-theme', resolved);
}

function applyPreferences(p: UserSettings): void {
  applyTheme(p.theme);
  setCurrency(p.currency);
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserSettings | null>(null);

  const refresh = useCallback(async () => {
    const p = await getPreferences();
    setPreferences(p);
    applyPreferences(p);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = useCallback(async (patch: Partial<UserSettings>) => {
    const p = await apiUpdate(patch);
    setPreferences(p);
    applyPreferences(p);
  }, []);

  const value = useMemo<PreferencesState>(() => ({ preferences, refresh, update }), [preferences, refresh, update]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesState {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
