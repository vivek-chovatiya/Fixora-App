/**
 * useCountdown
 *
 * Counts seconds down to zero, for cooldowns and other timed affordances.
 *
 * Purely a UI concern, and kept apart from authentication on purpose: it decides
 * nothing, knows nothing about codes or sessions, and could be deleted without
 * changing what the app is allowed to do. The duration is always supplied by the
 * caller — no interval is invented here, so a value that comes from the backend
 * stays the backend's to set.
 */

import { useCallback, useEffect, useState } from 'react';

export interface UseCountdownResult {
  secondsRemaining: number;
  isRunning: boolean;
  /** Restarts from the given number of seconds. Values below zero are treated as zero. */
  start: (seconds: number) => void;
}

export function useCountdown(initialSeconds = 0): UseCountdownResult {
  const [secondsRemaining, setSecondsRemaining] = useState(() => normalise(initialSeconds));

  useEffect(() => {
    if (secondsRemaining <= 0) {
      return undefined;
    }

    // A timeout per tick rather than one interval: the cleanup below then
    // cancels the only pending timer, so unmounting mid-countdown leaves
    // nothing running.
    const timer = setTimeout(() => {
      setSecondsRemaining(current => current - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsRemaining]);

  const start = useCallback((seconds: number) => {
    setSecondsRemaining(normalise(seconds));
  }, []);

  return { secondsRemaining, isRunning: secondsRemaining > 0, start };
}

function normalise(seconds: number): number {
  return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0;
}
