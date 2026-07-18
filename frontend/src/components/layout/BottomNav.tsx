/**
 * Mobile bottom navigation. Shows the primary destinations; the full set stays
 * reachable by horizontal scroll (touch-friendly).
 */
import { NavLink } from 'react-router-dom';
import { navItems } from './navItems.js';

export function BottomNav() {
  return (
    <nav className="dm-bottomnav" aria-label="Primary">
      {navItems.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.end} className="dm-tab">
          <span className="dot" />
          {l.short}
        </NavLink>
      ))}
    </nav>
  );
}
