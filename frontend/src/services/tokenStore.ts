/**
 * In-memory JWT holder.
 *
 * Kept in a module variable (not localStorage) so the token is not persisted
 * where XSS could read it (docs/security.md §4.2). Trade-off: the session is
 * lost on full page refresh — acceptable for the pilot; a refresh-token flow
 * can restore persistence-with-safety later.
 */
let token: string | null = null;

export function getToken(): string | null {
  return token;
}

export function setToken(value: string | null): void {
  token = value;
}
