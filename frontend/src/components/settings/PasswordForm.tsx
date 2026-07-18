/**
 * Password update form. On success the backend revokes all sessions, so the
 * user is logged out locally too.
 */
import { useState, type FormEvent } from 'react';
import { updatePassword } from '../../services/settingsService.js';
import { useAuth } from '../../hooks/useAuth.js';

export function PasswordForm() {
  const { logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await updatePassword(current, next);
      setStatus('Password changed. Logging out…');
      setTimeout(() => logout(), 800);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Change failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h3>Password</h3>
      <div style={{ display: 'grid', gap: '0.4rem', maxWidth: 280 }}>
        <label>Current password<br /><input type="password" value={current} autoComplete="current-password" onChange={(e) => setCurrent(e.target.value)} required /></label>
        <label>New password (min 12)<br /><input type="password" value={next} autoComplete="new-password" minLength={12} onChange={(e) => setNext(e.target.value)} required /></label>
      </div>
      <button type="submit" disabled={busy} style={{ marginTop: '0.5rem' }}>{busy ? 'Saving…' : 'Change password'}</button>
      {status && <p><small>{status}</small></p>}
    </form>
  );
}
