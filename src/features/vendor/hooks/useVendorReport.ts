/**
 * useVendorReport
 *
 * The signed-in vendor's figures for the period they chose, and the seam the
 * Reports screen is allowed to touch (PROJECT_BIBLE.md section 42).
 *
 *   Screen → hook → VendorReportService.getReport(period) → implementation
 *
 * The period is this hook's state: chosen on the screen, sent as a key, and
 * kept while a pull reads it again. The dates behind it are the server's.
 * Whose figures they are is the session's — the call takes no vendor id, so
 * nothing a route or a caller holds can point it at somebody else.
 *
 * ⚠️ An answer is shown only under the period it was asked for. Choosing
 * another period while a read is in the air must never draw the older
 * period's figures under the newer choice. The shared query already drops an
 * answer that lands after a newer read began, but it does not forget the last
 * answer when its inputs change: for the moment between the choice and the
 * newer read starting it still holds the old period's figures, and if the
 * newer read fails it keeps them beside the failure — a stale report for one
 * period, but across two the wrong one. So every answer is labelled with the
 * period that was *asked for* (not the one the server echoes), the period the
 * newest read asked for is noted as it starts, and anything that is not for
 * the chosen period — figures or a failure — is hidden behind the loading
 * state until that period's read settles. The shared hooks are unchanged.
 *
 * ⚠️ Retry and pull go one at a time — `useSingleFlightQuery`, as on the
 * request list and the reviews, released in a `finally` when the call settles.
 * Choosing a period is not held back by it: a choice always reads.
 *
 * ⚠️ A failed pull says so, as on the reviews: `isStale` is true when this
 * period's figures are on screen and the read after them failed. A failed
 * first read of a period has nothing to keep and is an `error`. The rule is the
 * shared `useStaleState`; only what counts as this period's is decided here.
 *
 * No re-read on focus and no `VendorWorkSync` listener: the screen is pushed,
 * so every visit reads afresh, and pulling reads again on demand.
 */

import { useCallback, useRef, useState } from 'react';

import { useSingleFlightQuery } from '@/shared/hooks/useSingleFlightQuery';
import { useStaleState } from '@/shared/hooks/useStaleState';
import { getService } from '@/shared/services/ServiceRegistry';
import type { VendorReport, VendorReportPeriod } from '@/shared/services/types/VendorReportService';
import type { AppError } from '@/shared/types/error';

/** The period a report opens on — section 42 lists Today first. */
export const DEFAULT_REPORT_PERIOD: VendorReportPeriod = 'today';

/** An answer, labelled with the period the read asked for. */
interface PeriodAnswer {
  period: VendorReportPeriod;
  report: VendorReport;
}

export interface VendorReportState {
  /** The period chosen on the screen. */
  period: VendorReportPeriod;
  /** Chooses a period and reads its figures. Choosing the current one does nothing. */
  selectPeriod: (period: VendorReportPeriod) => void;

  /** The chosen period's figures. Undefined until its read answers. */
  report: VendorReport | undefined;
  /** True until the chosen period's read settles, and for a retry after it failed. */
  isLoading: boolean;
  /** The chosen period's read failed and there is nothing of it to show. */
  error: AppError | null;
  /** Reads the chosen period again, showing the loading state. For the error's Try again. */
  retry: () => void;

  /** Pull-to-refresh: reads the chosen period again with its figures left on screen. */
  refresh: () => void;
  isRefreshing: boolean;
  /** The last refresh failed; the figures on screen are from before it. */
  isStale: boolean;
  /** Why the refresh failed, for the notice. Null unless `isStale`. */
  staleError: AppError | null;
}

export function useVendorReport(): VendorReportState {
  const [period, setPeriod] = useState<VendorReportPeriod>(DEFAULT_REPORT_PERIOD);

  /**
   * The period the newest read asked for, noted the moment it starts. Until it
   * is the chosen one, whatever the query holds belongs to another period.
   */
  const askedFor = useRef<VendorReportPeriod | null>(null);

  const query = useSingleFlightQuery<PeriodAnswer>(
    useCallback(async () => {
      askedFor.current = period;
      const report = await getService('vendorReports').getReport(period);
      return { period, report };
    }, [period]),
    [period],
  );

  const caughtUp = askedFor.current === period;
  const report = caughtUp && query.data?.period === period ? query.data.report : undefined;

  // With this period's figures on screen a failure is a stale report, not an error page.
  const stale = useStaleState({
    hasData: report !== undefined,
    // The query's failure is always the newest read's, so it is this period's once caught up.
    error: caughtUp ? query.error : null,
    isRefreshing: query.isRefreshing,
  });

  return {
    period,
    selectPeriod: setPeriod,
    report,
    isLoading: !caughtUp || query.isLoading,
    error: stale.error,
    retry: query.retry,
    refresh: query.refresh,
    isRefreshing: query.isRefreshing,
    isStale: stale.isStale,
    staleError: stale.staleError,
  };
}
