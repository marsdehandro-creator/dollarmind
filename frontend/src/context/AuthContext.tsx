/**
 * V1 local-user identity. There is no server and no account system — every
 * install is a single local user (the pilot tenant), always present. The
 * real security gate is the PIN lock (PinLockContext.tsx), not a login
 * screen — see App.tsx / AppShell.tsx's "Lock" button.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
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
  user: LocalUser;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthState>(() => ({ user: LOCAL_USER }), []);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
