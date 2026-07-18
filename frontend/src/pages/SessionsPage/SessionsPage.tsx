/**
 * Sessions page: list active sessions, log out one, or log out everywhere.
 */
import { useCallback, useEffect, useState } from 'react';
import { SessionsTable } from '../../components/sessions/SessionsTable.js';
import { listSessions, logoutAllSessions, logoutSession, type SessionInfo } from '../../services/sessionService.js';
import { useAuth } from '../../hooks/useAuth.js';

export function SessionsPage() {
  const { sessionId, logout } = useAuth();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setSessions(await listSessions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onLogout(id: string) {
    await logoutSession(id);
    if (id === sessionId) {
      logout();
      return;
    }
    void reload();
  }

  async function onLogoutAll() {
    await logoutAllSessions();
    logout();
  }

  return (
    <section>
      <h1>Active Sessions</h1>
      <p><small>Refresh sessions govern how new access tokens are issued. Logging out a session revokes its refresh token.</small></p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <SessionsTable sessions={sessions} currentSessionId={sessionId} onLogout={onLogout} />
      <p style={{ marginTop: '1rem' }}>
        <button type="button" onClick={onLogoutAll}>Log out all sessions</button>
      </p>
    </section>
  );
}
