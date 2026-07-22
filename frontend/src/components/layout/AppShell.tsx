/**
 * Responsive app shell: sidebar on desktop, bottom nav on mobile. The nav mode
 * honours the user's layout preference ('auto' | 'sidebar' | 'bottomnav').
 */
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { BottomNav } from './BottomNav.js';
import { Logo } from '../brand/Logo.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { usePreferences } from '../../context/PreferencesContext.js';
import { usePinLock } from '../../context/PinLockContext.js';

export function AppShell() {
  const { user } = useAuth();
  const { hasPin, lockNow } = usePinLock();
  const { preferences } = usePreferences();
  const isNarrow = useMediaQuery('(max-width: 820px)');

  const layout = preferences?.layout ?? 'auto';
  const navMode = layout === 'sidebar' ? 'side' : layout === 'bottomnav' ? 'bottom' : isNarrow ? 'bottom' : 'auto';
  // data-nav drives the CSS: 'bottom' forces bottom nav; 'auto' is responsive.
  const dataNav = navMode === 'bottom' ? 'bottom' : navMode === 'side' ? 'side' : 'auto';

  return (
    <div className="dm-shell" data-nav={dataNav}>
      <Sidebar />
      <div className="dm-main">
        <header className="dm-header">
          <div className="dm-header-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* Compact brand mark shows on mobile where the sidebar is hidden */}
            <span className="dm-header-logo"><Logo size={26} withWordmark /></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>
              {user.email}
            </span>
            {hasPin && (
              <button type="button" className="btn-ghost" onClick={lockNow} title="Lock the app until your PIN is entered again">
                Lock
              </button>
            )}
          </div>
        </header>
        <main className="dm-content">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
