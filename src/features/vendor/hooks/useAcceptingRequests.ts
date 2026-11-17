/**
 * useAcceptingRequests
 *
 * Whether the vendor is taking new requests, and the one way to change it
 * (PROJECT_BIBLE.md section 38, "Availability" and "Manage Availability").
 *
 *   Profile switch / dashboard notice → hook → VendorProfileService.setAcceptingRequests
 *
 * ⚠️ Recorded, never acted on here. Off means the backend stops offering this
 * vendor new requests (section 18A.1 puts availability with the backend); the
 * app filters, hides and refuses nothing because of it, and work already
 * accepted carries on.
 *
 * ⚠️ Applied at once, through the vendor's one profile line (`inLine`), and
 * adopted inside its turn — the rule every read and change of the profile
 * follows (Phase 3E-10). A shop-image save, a pull on Shop images or the
 * profile form's save may already be in that line; out of it, an answer from
 * one of them could land after this one and put the old value back on
 * Profile, or this one could land before a read that started earlier.
 *
 * ⚠️ One change at a time, for the whole vendor session — not per screen.
 * Profile and the dashboard each hold this hook, so the claim and `pending` —
 * the value asked for — live in `VendorProfileContext`: a change started on
 * one is busy on the other, and a second request from either is refused
 * (`ignored`) before anything is sent or said. Kept per hook, as they were, the
 * second screen could send the same change again and the vendor got two toasts
 * (review finding, 21/10/2026). `pending` is what the switch draws until the
 * service answers, then the stored value takes over: the new one, or on a
 * failure the old one, which is the switch going back. Success and failure are
 * each a toast, the vendor side's convention.
 *
 * Asking first before turning new requests off is the screen's (it is a
 * question for the person, not for the service); this only changes it.
 */

import { useCallback } from 'react';

import { createLogger } from '@/core/logger/Logger';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useVendorProfile } from '@/features/vendor/state/VendorProfileContext';
import { ERROR_PRESENTATION, useToast } from '@/shared/components';
import { getService } from '@/shared/services/ServiceRegistry';
import { AppError } from '@/shared/types/error';

const COPY = VENDOR_COPY.availability;

const log = createLogger('useAcceptingRequests');

/**
 * What a change came to. `ignored` is a request made while another was
 * running, or one the vendor's session ended before it could be sent.
 */
export type AvailabilityOutcome = 'changed' | 'failed' | 'ignored';

export interface AcceptingRequestsState {
  /**
   * What is stored. True when the profile does not say — a new vendor starts
   * accepting — so a profile without the field never shows a vendor as off.
   */
  isAccepting: boolean;
  /** The value asked for while a change is in line or sent; null otherwise. */
  pending: boolean | null;
  /** A change is in line or sent. */
  isChanging: boolean;
  /** Turns new requests on or off. Never rejects: the outcome is said, then returned. */
  setAccepting: (accepting: boolean) => Promise<AvailabilityOutcome>;
}

export function useAcceptingRequests(): AcceptingRequestsState {
  const {
    profile,
    adopt,
    inLine,
    pendingAccepting: pending,
    beginAcceptingChange,
    endAcceptingChange,
  } = useVendorProfile();
  const { showToast } = useToast();

  const setAccepting = useCallback(
    async (accepting: boolean): Promise<AvailabilityOutcome> => {
      // Refused here, on whichever screen asked, while any screen's change runs.
      if (!beginAcceptingChange(accepting)) {
        return 'ignored';
      }

      try {
        return await inLine(async (): Promise<AvailabilityOutcome> => {
          try {
            adopt(await getService('vendorProfile').setAcceptingRequests(accepting));
            showToast({
              message: accepting ? COPY.turnedOn : COPY.turnedOff,
              tone: 'success',
              icon: 'success',
            });
            return 'changed';
          } catch (caught) {
            const error = AppError.from(caught);
            // By kind only: the message is a developer's.
            log.warn('Availability not changed', { kind: error.kind });
            const { tone, icon } = ERROR_PRESENTATION[error.kind];
            showToast({
              message: `${accepting ? COPY.turnOnFailed : COPY.turnOffFailed} ${error.userMessage}`,
              tone,
              icon,
            });
            return 'failed';
          }
        });
      } catch {
        // Refused unrun: the vendor's session ended before its turn. Nothing left to tell.
        return 'ignored';
      } finally {
        // Even when the screen that asked has gone: the other one is waiting.
        endAcceptingChange();
      }
    },
    [adopt, inLine, showToast, beginAcceptingChange, endAcceptingChange],
  );

  return {
    isAccepting: profile?.acceptingRequests !== false,
    pending,
    isChanging: pending !== null,
    setAccepting,
  };
}
