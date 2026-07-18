/**
 * Desktop sidebar navigation with the DollarMind brand mark.
 */
import { NavLink } from 'react-router-dom';
import { Logo } from '../brand/Logo.js';
import { navItems } from './navItems.js';

export function Sidebar() {
  return (
    <aside className="dm-sidebar">
      <div style={{ padding: '0.3rem 0.6rem 1rem' }}>
        <Logo size={34} withWordmark />
      </div>
      <nav>
        {navItems.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className="dm-navlink">
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
