/**
 * useVendorRequestDetails
 *
 * One of the vendor's requests, read by its reference (PROJECT_BIBLE.md section
 * 32, Phase 3E-3), and kept true while it is answered here (section 33, Phase
 * 3E-4).
 *
 * The route carries the reference and nothing else, so the record is always
 * read here rather than handed over from the list — a card is a summary, and a
 * copy of it would be as stale as the list it came from.
 *
 * ⚠️ "Not found" is an answer, not a fault. A request that is not this vendor's
 * — never was, or was taken by somebody else in the meantime (section 31.2) —
 * comes back `notFound`, and the screen says so calmly instead of offering a
 * retry that cannot help. Anything else is a failure and can be tried again;
 * the guard on that retry is the request's own and cannot stick.
 *
 * ⚠️ After an answer, the service's record is the one shown (3E-4). Accepted or
 * rejected, `adopt` puts the record the service returned on screen — the new
 * status, and no buttons — without reading again. When the service instead
 * says the request has moved on, `reconcile` sets aside the record on screen
 * (it is known to be wrong) and reads again, so the vendor sees where it went:
 * "not available" if somebody else took it, its real state otherwise. The
 * record set aside is never shown again, even if that read fails — a failure
 * is drawn as one, with its retry, not as a request still waiting.
 *
 * Section 54's `request_viewed` is sent here, once per request this screen
 * opens: when a read of it first succeeds — the first read, or the retry that
 * finally worked. Never for a failed read or a request that is not there, and
 * never again for the reads that follow (`reconcile`, the read after a
 * completion elsewhere) — the vendor is still looking at the same request.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAnalytics } from '@/shared/hooks/useAnalytics';
import { useSingleFlightQuery } from '@/shared/hooks/useSingleFlightQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { VendorRequestDetails } from '@/shared/services/types/VendorRequestService';
import type { AppError } from '@/shared/types/error';

export interface VendorRequestDetailsState {
  request: VendorRequestDetails | undefined;
  isLoading: boolean;
  /** A failure that is worth retrying. Null when the request simply is not there. */
  error: AppError | null;
  /** The service said this request does not exist for this vendor. */
  isNotFound: boolean;
  retry: () => void;

  /** Shows the record the service returned for an answer given here. */
  adopt: (request: VendorRequestDetails) => void;
  /** The service said the request moved on: set aside what is shown and read again. */
  reconcile: () => void;
}

export function useVendorRequestDetails(requestId: string): VendorRequestDetailsState {
  const query = useSingleFlightQuery<VendorRequestDetails>(
    useCallback(() => getService('vendorRequests').getRequest(requestId), [requestId]),
    [requestId],
  );

  const [adopted, setAdopted] = useState<VendorRequestDetails | null>(null);
  /** A read the service has since contradicted. Compared by identity: every read is a new record. */
  const [setAside, setSetAside] = useState<VendorRequestDetails | undefined>(undefined);

  const { data, retry } = query;

  /*
    Remembered by the reference the read returned, not by a flag: a later read
    of the same request is the same viewing, and a read still held from a
    previous reference cannot be counted under a new one.

    `dispatch` as the record holds it, and only while it holds one — the
    backend says it of waiting requests alone (section 31.1).
  */
  const { track } = useAnalytics();
  const viewed = useRef<string | null>(null);
  useEffect(() => {
    if (!data || viewed.current === data.id) {
      return;
    }
    viewed.current = data.id;
    track(
      'request_viewed',
      data.dispatch ? { requestId: data.id, dispatch: data.dispatch } : { requestId: data.id },
    );
  }, [data, track]);

  const adopt = useCallback((request: VendorRequestDetails) => setAdopted(request), []);

  const reconcile = useCallback(() => {
    setAdopted(null);
    setSetAside(data);
    retry();
  }, [data, retry]);

  const isNotFound = query.error?.kind === 'notFound';
  const fresh = data !== undefined && data !== setAside ? data : undefined;

  return {
    // Not found wins: a request that has gone is not shown from an older read.
    request: isNotFound ? undefined : (adopted ?? fresh),
    isLoading: query.isLoading,
    error: isNotFound ? null : query.error,
    isNotFound,
    retry,
    adopt,
    reconcile,
  };
}
