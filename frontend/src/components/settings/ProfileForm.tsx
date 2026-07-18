/**
 * Profile update form (display name).
 */
import { useState, type FormEvent } from 'react';
import { updateProfile } from '../../services/settingsService.js';

interface Props {
  displayName: string | null;
  onSaved: () => void;
}

export function ProfileForm({ displayName, onSaved }: Props) {
  const [name, setName] = useState(displayName ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await updateProfile(name);
      setStatus('Profile saved.');
      onSaved();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h3>Profile</h3>
      <label>Display name<br /><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>{' '}
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      {status && <p><small>{status}</small></p>}
    </form>
  );
}
