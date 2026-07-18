/**
 * Branded DollarMind login / register page.
 */
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { Logo } from '../../components/brand/Logo.js';

interface LocationState {
  from?: { pathname?: string };
}

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const redirectTo = (location.state as LocationState)?.from?.pathname ?? '/';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dm-auth">
      <div className="dm-auth-card">
        <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'center' }}>
          <Logo size={72} withWordmark vertical />
        </div>
        <div className="dm-card" style={{ textAlign: 'left' }}>
          <h1 style={{ textAlign: 'center' }}>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
          <form onSubmit={onSubmit}>
            <div style={{ margin: '0.6rem 0' }}>
              <label>Email</label>
              <input type="email" value={email} autoComplete="username" required style={{ width: '100%' }}
                onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div style={{ margin: '0.6rem 0' }}>
              <label>Password</label>
              <input type="password" value={password} required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'register' ? 12 : undefined} style={{ width: '100%' }}
                onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="error-text" role="alert">{error}</p>}
            <button type="submit" className="btn-primary" disabled={busy} style={{ width: '100%', marginTop: '0.4rem' }}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
            </button>
          </form>
          <p style={{ marginTop: '1rem', textAlign: 'center' }}>
            <small>{mode === 'login' ? 'No account yet?' : 'Already have an account?'}</small>{' '}
            <button type="button" className="btn-ghost" style={{ padding: '0.2rem 0.5rem' }}
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
              {mode === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>
          {mode === 'register' && <p style={{ textAlign: 'center' }}><small>Password must be at least 12 characters.</small></p>}
        </div>
      </div>
    </div>
  );
}
