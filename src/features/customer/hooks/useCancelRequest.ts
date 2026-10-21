/**
 * useCancelRequest
 *
 * Cancels one of the customer's requests while nobody has accepted it (owner
 * decision, 21/10/2026; PROJECT_BIBLE.md section 21's `CANCELLED`).
 *
 *   Screen → hook → RequestService interface → implementation
 *
 * ⚠️ One cancellation at a time, and the guard cannot stick. A ref is taken the
 * moment one is asked for — before any state lands, so a second confirm in the
 * same frame sends nothing — and released in a `finally` when the service has
 * answered, whatever it answered. Released by the call settling, never by
 * watching a loading flag (the 3E-2 lesson).
 *
 * ⚠️ Nothing is shown as cancelled before the service says it is (section 34).
 * The screen is handed the record the service returned and shows that.
 *
 * Three ways it can end, each said once, here:
 *
 * - **cancelled** — "Request cancelled.", and the lists behind told to read
 *   again;
 * - **refused** — a professional accepted it first. Information, not a fault
 *   (section 49.1): a calm message, the lists told, and the screen reads the
 *   request again to show where it went;
 * - **failed** — the failure's own words. Nothing changed and nothing is told,
 *   except when the service no longer knows the request (`notFound`): then the
 *   page and the lists are wrong about it too, so they are told and the screen
 *   reads it again rather than offering Cancel on something that is not there.
 *
 * No analytics event: section 54 names none for a cancellation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { createLogger } from '@/core/logger/Logger';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { customerRequestsChanged } from '@/features/customer/state/customerRequestSync';
import { ERROR_PRESENTATION, useToast } from '@/shared/components';
import { getService } from '@/shared/services/ServiceRegistry';
import type { CustomerRequestDetails } from '@/shared/services/types/RequestService';
import { AppError } from '@/shared/types/error';

const COPY = CUSTOMER_COPY.cancelRequest;

const log = createLogger('useCancelRequest');

export type CancelRequestOutcome =
  /** The service recorded it; `request` is the record as it now stands. */
  | { kind: 'cancelled'; request: CustomerRequestDetails }
  /** It had moved past waiting: the screen reads it again. */
  | { kind: 'refused' }
  /** Nothing changed — unless `error.kind` is `notFound`, when it is gone. */
  | { kind: 'failed'; error: AppError }
  /** A cancellation was already in the air; this one was not sent. */
  | { kind: 'ignored' };

export interface RequestCancellation {
  cancel: (requestId: string) => Promise<CancelRequestOutcome>;
  /** A cancellation is in the air: the dialog shows busy and nothing dismisses it. */
  isCancelling: boolean;
}

export function useCancelRequest(): RequestCancellation {
  const { showToast } = useToast();
  const [isCancelling, setIsCancelling] = useState(false);

  const inFlight = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const cancel = useCallback(
    async (requestId: string): Promise<CancelRequestOutcome> => {
      if (inFlight.current) {
        return { kind: 'ignored' };
      }
      inFlight.current = true;
      setIsCancelling(true);

      try {
        const result = await getService('request').cancelRequest(requestId);

        // What is behind this screen is wrong about the request either way.
        customerRequestsChanged();

        if (result.outcome === 'refused') {
          showToast({ message: COPY.refused, tone: 'info', icon: 'info' });
          return { kind: 'refused' };
        }

        // An ending rather than an achievement, in the status card's own tone
        // and glyph for a cancelled request.
        showToast({ message: COPY.cancelled, tone: 'neutral', icon: 'cancelled' });
        return { kind: 'cancelled', request: result.request };
      } catch (caught) {
        const error = AppError.from(caught);
        // The kind only: a reference is the customer's, not the log's.
        log.error('cancel failed', { kind: error.kind });

        if (error.kind === 'notFound') {
          customerRequestsChanged();
        }

        const { tone, icon } = ERROR_PRESENTATION[error.kind];
        showToast({ message: `${COPY.failed} ${error.userMessage}`, tone, icon });
        return { kind: 'failed', error };
      } finally {
        inFlight.current = false;
        if (mountedRef.current) {
          setIsCancelling(false);
        }
      }
    },
    [showToast],
  );

  return { cancel, isCancelling };
}
