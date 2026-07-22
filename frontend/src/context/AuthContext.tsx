/**
 * V1 offline auth context.
 *
 * There is no server and no account system in V1 — every install is a single
 * local user (the pilot tenant). The context auto-"authenticates" on mount so
 * routing/pages built around isAuthenticated keep working unchanged. A real
 * gate (PIN lock) replaces this open-by-default state in a later phase
 * (docs/v1-offline-product-spec.md) without needing to touch this shape again.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_TENANT_ID } from '@dollarmind/core/constants.js';

export interface LocalUser {
  id: string;
  tenantId: string;
  email: string;
  roles: string[];
}

const LOCAL_USER: LocalUser = {
  id: DEFAULT_TENANT_ID,
  tenantId: DEFAULT_TENANT_ID,
  email: 'you@device.local',
  roles: ['user'],
};

interface AuthState {
  user: LocalUser | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(LOCAL_USER);

  const value = useMemo<AuthState>(
    () => ({
      user,
      sessionId: null,
      isAuthenticated: user !== null,
      // No-ops: V1 has no accounts. Kept so LoginPage/routing don't need changes.
      login: async () => setUser(LOCAL_USER),
      register: async () => setUser(LOCAL_USER),
      logout: () => setUser(null),
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
