/**
 * Active sessions table with per-session logout.
 */
import type { SessionInfo } from '../../services/sessionService.js';

interface Props {
  sessions: SessionInfo[];
  currentSessionId: string | null;
  onLogout: (sessionId: string) => void;
}

export function SessionsTable({ sessions, currentSessionId, onLogout }: Props) {
  if (sessions.length === 0) return <p><small>No active sessions.</small></p>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>Device</th>
          <th style={{ textAlign: 'left' }}>Created</th>
          <th style={{ textAlign: 'left' }}>Last used</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {sessions.map((s) => (
          <tr key={s.id} style={{ borderTop: '1px solid #eee' }}>
            <td>
              {s.userAgent ?? 'Unknown device'}
              {s.id === currentSessionId && <strong> (this session)</strong>}
            </td>
            <td>{new Date(s.createdAt).toLocaleString('en-ZA')}</td>
            <td>{new Date(s.lastUsedAt).toLocaleString('en-ZA')}</td>
            <td><button type="button" onClick={() => onLogout(s.id)}>Log out</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
