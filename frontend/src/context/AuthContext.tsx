/**
 * Auth context. Holds the current user + JWT (in memory) and exposes login /
 * register / logout. The token is mirrored into the token store so the API
 * client can attach it to requests (docs/security.md §2.4).
 *
 * NOTE (pilot): the token lives only in memory, so a full page refresh logs the
 * user out. This is deliberate — it keeps the JWT out of storage that XSS could
 * read. Persistent sessions come later via an httpOnly refresh-cookie flow.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '../services/authService.js';
import { setToken } from '../services/tokenStore.js';

interface AuthState {
  user: authApi.PublicUser | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<authApi.PublicUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const value = useMemo<AuthState>(() => {
    async function apply(result: authApi.AuthResult): Promise<void> {
      setToken(result.token);
      setUser(result.user);
      setSessionId(result.sessionId ?? null);
    }
    return {
      user,
      sessionId,
      isAuthenticated: user !== null,
      login: async (email, password) => apply(await authApi.login({ email, password })),
      register: async (email, password) => apply(await authApi.register({ email, password })),
      logout: () => {
        // Fire the server-side logout with the current token still attached,
        // then clear local state immediately for a responsive UI.
        void authApi.logout().catch(() => undefined);
        setToken(null);
        setUser(null);
        setSessionId(null);
      },
    };
  }, [user, sessionId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
