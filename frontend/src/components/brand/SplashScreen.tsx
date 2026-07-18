/**
 * Branded splash screen shown briefly on app launch (and used by Capacitor's
 * native splash as the visual reference).
 */
import { Logo } from './Logo.js';

export function SplashScreen() {
  return (
    <div className="dm-splash" role="status" aria-label="DollarMind loading">
      <Logo size={96} withWordmark vertical />
      <div className="dm-spark" />
      <div className="dm-tag">Smart Finance</div>
    </div>
  );
}
