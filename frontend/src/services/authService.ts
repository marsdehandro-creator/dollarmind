/**
 * Auth API client.
 */
import { apiPost } from './apiClient.js';

export interface PublicUser {
  id: string;
  tenantId: string;
  email: string;
  roles: string[];
}

export interface AuthResult {
  token: string;
  user: PublicUser;
  refreshToken?: string;
  sessionId?: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export function login(creds: Credentials): Promise<AuthResult> {
  return apiPost<AuthResult>('/auth/login', creds);
}

export function register(creds: Credentials): Promise<AuthResult> {
  return apiPost<AuthResult>('/auth/register', creds);
}

/** Best-effort server-side logout (records the audit event). */
export function logout(): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>('/auth/logout');
}
