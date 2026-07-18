/**
 * Thin fetch wrapper for the backend API. Attaches the Bearer token (JWT) from
 * the in-memory token store when present.
 */
import { getToken } from './tokenStore.js';

const BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Structured API error carrying the business-error contract fields. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly severity?: 'info' | 'warning' | 'critical',
    public readonly suggestion?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseError(res: Response): Promise<never> {
  let body: { error?: string; message?: string; severity?: 'info' | 'warning' | 'critical'; suggestion?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* ignore non-JSON bodies */
  }
  throw new ApiError(res.status, body.message ?? `Request failed: ${res.status}`, body.error, body.severity, body.suggestion);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { ...authHeaders() } });
  if (!res.ok) await parseError(res);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>('POST', path, body);
}

/** Generic JSON request for POST/PUT/PATCH/DELETE. */
export async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await parseError(res);
  return res.json() as Promise<T>;
}

/**
 * Multipart upload. Does NOT set Content-Type — the browser sets it (with the
 * multipart boundary) from the FormData.
 */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: formData,
  });
  if (!res.ok) await parseError(res);
  return res.json() as Promise<T>;
}
