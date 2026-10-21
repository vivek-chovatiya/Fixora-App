/**
 * useCurrentLocation
 *
 * The "use my location" shortcut, from the tap to an address on the screen.
 *
 *   Screen → hook → PermissionService → LocationService → AddressService
 *
 * ⚠️ Four separate capabilities, joined here and nowhere else. Asking to be
 * allowed, reading a fix, describing that fix and putting it in front of the
 * customer are different concerns with different owners and different failure
 * modes, and the screen has no business knowing any of them — it asks for an
 * address and is told either an address or a sentence explaining why not.
 *
 * ⚠️ It reuses `PermissionService`. There is exactly one permission system in
 * this application and onboarding already established it; a second one here
 * would mean two places deciding what "blocked" means and two places that could
 * be wrong about it. `useRequestPhotos` already calls it the same way for the
 * camera.
 *
 * ⚠️ Nothing it produces is applied automatically, and nothing it does is
 * required. The resolved address is handed back for the customer to look at,
 * because turning a coordinate into a street is a guess and they are the only
 * one who can say whether it is their street. Every failure path — refused,
 * blocked, no fix, nothing to describe — ends in the same place: the box is
 * still there and typing still works.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { createLogger } from '@/core/logger/Logger';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { getService } from '@/shared/services/ServiceRegistry';
import type { AddressSuggestion } from '@/shared/services/types/AddressService';

const COPY = CUSTOMER_COPY.location;
const log = createLogger('useCurrentLocation');

/**
 * How far the shortcut has got.
 *
 * `blocked` is the only outcome that differs from `denied` in what the screen
 * draws, and it differs by one button rather than by a different explanation —
 * see the copy. Everything else collapses into `failed`, because a refused fix,
 * a switched-off radio and a gazetteer that could not place a point are one
 * situation for the customer: type it instead.
 */
export type LocationPhase = 'idle' | 'working' | 'denied' | 'blocked' | 'failed';

export interface CurrentLocation {
  phase: LocationPhase;
  /** Safe wording for the current phase, or null when there is nothing to say. */
  message: string | null;
  /**
   * Asks, reads, describes — then hands the result to `onResolved`.
   *
   * A callback rather than a returned value because the answer is not this
   * hook's to keep: the address belongs in the draft, and a hook holding its own
   * copy would be a second place it lived. Returns nothing, so a button is never
   * handed a promise it must remember to dispose of.
   *
   * `onResolved` returns `false` when it did not use the answer — the customer
   * chose an address another way while the device was still looking — and then
   * no "Is this right?" is shown about an address that is not on screen.
   */
  resolve: (onResolved: (suggestion: AddressSuggestion) => boolean | void) => void;
  /** Opens system settings, the only route out of `blocked`. */
  openSettings: () => void;
}

export function useCurrentLocation(): CurrentLocation {
  const [phase, setPhase] = useState<LocationPhase>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Guards against a second dialog.
   *
   * A ref rather than the phase, because two taps in the same tick both read the
   * old state and both call through — and on Android the second request resolves
   * immediately as denied, overwriting a grant the customer just gave. The same
   * reasoning as `usePermission`, which learned it first.
   */
  const isWorking = useRef(false);

  const settle = useCallback((next: LocationPhase, text: string | null) => {
    if (!mounted.current) {
      return;
    }
    setPhase(next);
    setMessage(text);
  }, []);

  const resolve = useCallback(
    (onResolved: (suggestion: AddressSuggestion) => boolean | void) => {
      if (isWorking.current) {
        return;
      }

      isWorking.current = true;
      settle('working', null);

      void (async () => {
        try {
          const permission = getService('permission');

          /*
            Checked before it is asked for.

            When the system has already decided — granted before, or blocked
            after a permanent refusal — `request` shows no dialog and returns the
            standing answer. Asking anyway is the permission spamming the
            platform guidelines warn about, and for `blocked` it would be a
            button that visibly does nothing.
          */
          const current = await permission.check('location');
          const status = current === 'denied' ? await permission.request('location') : current;

          if (status === 'blocked') {
            settle('blocked', COPY.denied);
            return;
          }

          if (status !== 'granted') {
            // `denied` and `unavailable` are one situation for the customer:
            // this route is closed, the other one is open.
            settle('denied', COPY.denied);
            return;
          }

          /*
            Two calls, and the second can fail on its own.

            A fix that arrives and cannot be described is a different failure
            from no fix at all — the device worked and the gazetteer did not —
            and the customer is told which, because "we could not get your
            location" would be untrue and would send them to check their GPS
            settings for nothing.
          */
          const coordinates = await getService('location').getCurrentCoordinates();

          let described: AddressSuggestion;
          try {
            described = await getService('address').describeCoordinates(coordinates);
          } catch (error) {
            log.warn('Could not describe the current position', { error: String(error) });
            settle('failed', COPY.unresolved);
            return;
          }

          if (!mounted.current) {
            return;
          }

          /*
            Handed over, not applied.

            The customer sees it and confirms or edits it before it counts. This
            is section 18's rule and it survives a real provider: a reverse
            geocode is a best guess at which building a point is in.

            Asked to check it only when it was taken: an answer the screen
            declined (it was overtaken) leaves nothing to check.
          */
          const taken = onResolved(described);
          settle('idle', taken === false ? null : COPY.confirmPrompt);
        } catch (error) {
          /*
            No coordinates, for whatever reason.

            Never the underlying message: a timeout, a disabled radio and a
            platform with no geolocation at all are one sentence to a customer,
            and the details belong in the log where a developer will see them.
            Note what is *not* logged — nothing that arrived, only that nothing
            did.
          */
          log.warn('Could not obtain a position fix', { error: String(error) });
          settle('failed', COPY.unavailable);
        } finally {
          isWorking.current = false;
        }
      })();
    },
    [settle],
  );

  const openSettings = useCallback(() => {
    getService('permission')
      .openSettings()
      .catch(error => {
        log.warn('Could not open settings', { error: String(error) });
      });
  }, []);

  return { phase, message, resolve, openSettings };
}
