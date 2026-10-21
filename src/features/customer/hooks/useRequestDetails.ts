/**
 * useRequestDetails
 *
 * One of the customer's requests, read back (PROJECT_BIBLE.md section 20).
 *
 *   Screen → hook → RequestService interface → implementation
 *
 * ⚠️ From the service and nothing else. A request that was just sent is still
 * sitting in `RequestDraftContext`'s submission record, and reading it from there
 * would work for exactly as long as the app stayed open — then a request opened
 * from Home tomorrow would be drawn from a different source than the same
 * request opened from the success screen today. There is one record, and this is
 * the only way to it.
 *
 * Three outcomes, kept apart. `request` is `undefined` while nothing is known,
 * `null` when the service answered that there is no such request, and a record
 * otherwise; a failure to answer at all is `error`. Not-found is not folded into
 * `error` because it is not retryable and does not deserve the words "something
 * went wrong".
 *
 * ⚠️ After a cancellation made here, the service's record is the one shown — the
 * vendor details' arrangement (3E-4). `adopt` puts the record the service
 * returned on screen without reading again, and it stays until a later read
 * lands, which can only have started after the change (the screen offers Cancel
 * only while no read is in the air). When the service instead refuses, the
 * record on screen is known to be wrong: `reconcile` drops any adoption and
 * reads again from the loading state, so the page is placeholders until the
 * answer lands — and a failed re-read is drawn as a failure with its retry,
 * never as the request still waiting, because the screen draws loading and
 * failure ahead of any record.
 *
 * Not the vendor's identity-based "set aside": a read that comes back unchanged
 * may come back as the very same object (a caching client shares structure),
 * and setting that aside would draw a request that exists as one that does not.
 */

import { useCallback, useState } from 'react';

import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { CustomerRequestDetails } from '@/shared/services/types/RequestService';
import type { AppError } from '@/shared/types/error';

export interface RequestDetails {
  /** Undefined until answered, null when there is no such request. */
  request: CustomerRequestDetails | null | undefined;
  /** True only for the first read and for a retry, so a refresh keeps the page. */
  isLoading: boolean;
  error: AppError | null;
  /** Reads it again from a failure. A read, so it can never raise a request. */
  retry: () => void;
  /** Pull-to-refresh: reads it again while the current record stays on screen. */
  refresh: () => void;
  isRefreshing: boolean;

  /** Shows the record the service returned for a change made here. */
  adopt: (request: CustomerRequestDetails) => void;
  /** The service said the request moved on: read it again from the loading state. */
  reconcile: () => void;
}

/** A record the service returned, and the read it was laid over. */
interface Adopted {
  record: CustomerRequestDetails;
  over: CustomerRequestDetails | null | undefined;
}

export function useRequestDetails(requestId: string): RequestDetails {
  const query = useServiceQuery<CustomerRequestDetails | null>(
    () => getService('request').getRequest(requestId),
    [requestId],
  );

  const [adopted, setAdopted] = useState<Adopted | null>(null);

  const { data, retry } = query;

  /*
    Laid over the read on screen when it was adopted, and only that read: any
    later answer is a new object, read after the change, and wins. Remembering
    the read rather than clearing on the next one is what keeps a pull that
    lands later from having to race an effect.
  */
  const adopt = useCallback(
    (record: CustomerRequestDetails) => setAdopted({ record, over: data }),
    [data],
  );

  const reconcile = useCallback(() => {
    setAdopted(null);
    retry();
  }, [retry]);

  return {
    request: adopted !== null && adopted.over === data ? adopted.record : data,
    isLoading: query.isLoading,
    error: query.error,
    retry,
    refresh: query.refresh,
    isRefreshing: query.isRefreshing,
    adopt,
    reconcile,
  };
}
