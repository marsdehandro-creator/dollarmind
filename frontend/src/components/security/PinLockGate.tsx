/**
 * Full-screen lock — renders instead of the app whenever PinLockContext says
 * locked. Wraps <App/> in main.tsx-adjacent position (see App.tsx), so it
 * gates every route, not just the authenticated ones (V1 has no login; the
 * PIN is the only gate there is).
 */
import { useState, type FormEvent } from 'react';
import { Logo } from '../brand/Logo.js';
import { Button } from '../ui/Button.js';
import { usePinLock } from '../../context/PinLockContext.js';

export function PinLockGate({ children }: { children: React.ReactNode }) {
  const { isLocked, attempt } = usePinLock();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isLocked) return <>{children}</>;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (attempt(pin)) {
      setPin('');
      setError(null);
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  }

  return (
    <div className="dm-splash" role="dialog" aria-label="App locked">
      <Logo size={72} withWordmark vertical />
      <form onSubmit={submit} style={{ display: 'grid', gap: '0.75rem', marginTop: '2rem', width: 220 }}>
        <label htmlFor="pin-input" style={{ textAlign: 'center', color: 'var(--fg-muted)' }}>
          Enter your PIN
        </label>
        <input
          id="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.4em' }}
        />
        {error && <p className="error-text" style={{ textAlign: 'center', margin: 0 }}>{error}</p>}
        <Button type="submit" variant="primary" disabled={pin.length === 0}>
          Unlock
        </Button>
      </form>
    </div>
  );
}
