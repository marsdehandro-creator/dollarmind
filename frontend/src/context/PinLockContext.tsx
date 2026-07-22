/**
 * App-lock unlock state. If no PIN has ever been set, the app is unlocked by
 * default (matches V1's pre-Phase-4 behavior — setting a PIN is opt-in from
 * Settings, not a forced first-run step). Once a PIN exists, every fresh load
 * starts locked until the correct PIN is entered; unlocking lasts for the
 * session (until the app/tab is closed), not on a timer.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { isPinSet, verifyPin } from '../local/pinLock.js';

interface PinLockState {
  /** Whether a PIN exists at all — Settings uses this to show "Set up" vs "Change/Remove". */
  hasPin: boolean;
  /** Whether the gate should currently block the app. */
  isLocked: boolean;
  attempt: (pin: string) => boolean;
  lockNow: () => void;
  /** Called by Settings after set/change/remove so the gate re-reads localStorage state. */
  refresh: () => void;
}

const PinLockContext = createContext<PinLockState | undefined>(undefined);

export function PinLockProvider({ children }: { children: ReactNode }) {
  const [hasPin, setHasPin] = useState(() => isPinSet());
  const [isLocked, setIsLocked] = useState(() => isPinSet());

  const value = useMemo<PinLockState>(
    () => ({
      hasPin,
      isLocked,
      attempt: (pin: string) => {
        const ok = verifyPin(pin);
        if (ok) setIsLocked(false);
        return ok;
      },
      lockNow: () => {
        if (isPinSet()) setIsLocked(true);
      },
      refresh: () => {
        const nowSet = isPinSet();
        setHasPin(nowSet);
        // A freshly-set PIN doesn't need to immediately re-lock the session that just set it.
        if (!nowSet) setIsLocked(false);
      },
    }),
    [hasPin, isLocked],
  );

  return <PinLockContext.Provider value={value}>{children}</PinLockContext.Provider>;
}

export function usePinLock(): PinLockState {
  const ctx = useContext(PinLockContext);
  if (!ctx) throw new Error('usePinLock must be used within PinLockProvider');
  return ctx;
}
