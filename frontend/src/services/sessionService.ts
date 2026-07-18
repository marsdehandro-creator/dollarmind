/**
 * Session management API client.
 */
import { apiGet, apiPost } from './apiClient.js';

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export async function listSessions(): Promise<SessionInfo[]> {
  const { sessions } = await apiGet<{ sessions: SessionInfo[] }>('/sessions/list');
  return sessions;
}

export function logoutSession(sessionId: string): Promise<{ ok: boolean }> {
  return apiPost('/sessions/logout', { sessionId });
}

export function logoutAllSessions(): Promise<{ ok: boolean }> {
  return apiPost('/sessions/logout-all');
}
