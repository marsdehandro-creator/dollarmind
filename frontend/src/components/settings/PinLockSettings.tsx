/**
 * Settings panel to set up, change, or remove the app-lock PIN. Setting up is
 * opt-in from here — V1 doesn't force a PIN on first run.
 */
import { useState, type FormEvent } from 'react';
import { isPinSet, setPin, verifyPin, clearPin } from '../../local/pinLock.js';
import { usePinLock } from '../../context/PinLockContext.js';

const MIN_PIN_LENGTH = 4;

export function PinLockSettings() {
  const { hasPin, refresh } = usePinLock();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCurrent('');
    setNext('');
    setConfirm('');
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);

    if (isPinSet() && !verifyPin(current)) {
      setError('Current PIN is incorrect.');
      return;
    }
    if (next.length < MIN_PIN_LENGTH) {
      setError(`PIN must be at least ${MIN_PIN_LENGTH} digits.`);
      return;
    }
    if (next !== confirm) {
      setError("PINs don't match.");
      return;
    }

    setPin(next);
    refresh();
    reset();
    setStatus(hasPin ? 'PIN changed.' : 'PIN set — the app will now lock on every fresh load.');
  }

  function remove() {
    if (isPinSet() && !verifyPin(current)) {
      setError('Enter your current PIN to remove it.');
      return;
    }
    clearPin();
    refresh();
    reset();
    setError(null);
    setStatus('PIN removed — the app will no longer lock.');
  }

  const numeric = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setter(e.target.value.replace(/\D/g, ''));

  return (
    <form onSubmit={submit}>
      <h3>App lock</h3>
      <p style={{ margin: '0 0 0.6rem', color: 'var(--fg-muted)' }}>
        {hasPin
          ? 'A PIN currently locks this app on every fresh load. Data never leaves this device either way — the PIN only guards who can open the app.'
          : 'No PIN is set — anyone with this device can open the app. Set one below for an extra layer of privacy.'}
      </p>
      <div style={{ display: 'grid', gap: '0.4rem', maxWidth: 280 }}>
        {hasPin && (
          <label>
            Current PIN<br />
            <input type="password" inputMode="numeric" autoComplete="off" value={current} onChange={numeric(setCurrent)} />
          </label>
        )}
        <label>
          {hasPin ? 'New PIN' : 'Set a PIN'} (min {MIN_PIN_LENGTH} digits)<br />
          <input type="password" inputMode="numeric" autoComplete="off" value={next} onChange={numeric(setNext)} />
        </label>
        <label>
          Confirm PIN<br />
          <input type="password" inputMode="numeric" autoComplete="off" value={confirm} onChange={numeric(setConfirm)} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
        <button type="submit">{hasPin ? 'Change PIN' : 'Set PIN'}</button>
        {hasPin && (
          <button type="button" onClick={remove}>
            Remove PIN
          </button>
        )}
      </div>
      {error && <p className="error-text"><small>{error}</small></p>}
      {status && <p><small>{status}</small></p>}
    </form>
  );
}
