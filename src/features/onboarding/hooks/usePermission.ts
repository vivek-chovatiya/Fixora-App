/**
 * usePermission
 *
 * Asks for one device permission, and reports where it got to.
 *
 * The screen never learns which platform it is on or what a permission is
 * called. It says "ask for the camera" and is told granted, denied, blocked or
 * unavailable — the four outcomes it can actually do something about.
 *
 * Nothing is asked for on mount. A permission dialog that appears because a
 * screen rendered is the exact pattern onboarding exists to avoid: the
 * explanation must be read first, and the request must follow a deliberate tap.
 */

import { useCallback, useRef, useState } from 'react';

import { createLogger } from '@/core/logger/Logger';
import { getService } from '@/shared/services/ServiceRegistry';
import type { PermissionKind, PermissionStatus } from '@/shared/services/types/PermissionService';

const log = createLogger('usePermission');

/**
 * How far this permission has got.
 *
 * `idle` is distinct from `denied`: nothing has been asked, so the explanation
 * still stands. `declined` means the user chose not to be asked at all, which is
 * not the same as the system refusing.
 */
export type PermissionPhase = 'idle' | 'requesting' | 'declined' | PermissionStatus;

export interface UsePermissionResult {
  phase: PermissionPhase;
  /**
   * Prompts, once. Safe to call again; a second call while asking is ignored.
   *
   * Returns nothing on purpose. The outcome arrives through `phase`, so a caller
   * has no reason to await this — and handing a button a promise it must
   * remember to dispose of is how unhandled rejections get written.
   */
  request: () => void;
  /** Records that the user chose not to be asked. Prompts nobody. */
  decline: () => void;
  /** Opens system settings, the only route out of `blocked`. */
  openSettings: () => void;
}

export function usePermission(kind: PermissionKind): UsePermissionResult {
  const [phase, setPhase] = useState<PermissionPhase>('idle');

  /**
   * Guards against a second dialog.
   *
   * A ref rather than the phase, because two taps in the same tick both read the
   * old state and both would call through. On Android the second request
   * resolves immediately as denied, which would overwrite a grant the user just
   * gave.
   */
  const isAsking = useRef(false);

  const ask = useCallback(async () => {
    if (isAsking.current) {
      return;
    }

    isAsking.current = true;
    setPhase('requesting');

    try {
      const service = getService('permission');

      /**
       * Checked before asking. When the system has already made up its mind —
       * granted before, or blocked after a permanent refusal — `request` shows
       * no dialog and returns the standing answer, so asking again is noise. It
       * also keeps a blocked permission from being re-requested on every visit,
       * which is the spamming the platform guidelines warn about.
       */
      const current = await service.check(kind);

      if (current === 'granted' || current === 'blocked' || current === 'unavailable') {
        setPhase(current);
        return;
      }

      setPhase(await service.request(kind));
    } catch (error) {
      /**
       * A permission that cannot be asked for is treated as unavailable rather
       * than as an error the user must clear. Onboarding is an introduction; it
       * must never become a wall because a device capability misbehaved.
       */
      log.warn('Permission request failed', { kind, error: String(error) });
      setPhase('unavailable');
    } finally {
      isAsking.current = false;
    }
  }, [kind]);

  // Every failure is already handled inside `ask`, so there is nothing left for
  // a rejection handler to do here.
  const request = useCallback(() => {
    ask().catch(() => undefined);
  }, [ask]);

  const decline = useCallback(() => {
    // Deliberately local. Nothing is asked, nothing is stored, and the platform
    // is not told — the user simply moves on.
    setPhase('declined');
  }, []);

  const openSettings = useCallback(() => {
    getService('permission')
      .openSettings()
      .catch(error => {
        log.warn('Could not open settings', { kind, error: String(error) });
      });
  }, [kind]);

  return { phase, request, decline, openSettings };
}
