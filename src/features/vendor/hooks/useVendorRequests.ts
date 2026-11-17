/**
 * useVendorRequests
 *
 * The vendor's request list, and the seam the screen is allowed to touch
 * (PROJECT_BIBLE.md section 31, Phase 3E-3).
 *
 *   Screen → hook → VendorRequestService → implementation
 *
 * One query for the whole list. Filtering is the screen's — a view over what is
 * already here — so changing the filter asks the service for nothing.
 *
 * ⚠️ One request at a time, and the guard cannot stick. `useSingleFlightQuery`
 * holds it for exactly as long as the service call is in the air and releases
 * it in a `finally`, so Try again works after a failure however fast the
 * failure was — the bug Phase 3E-2 found the hard way.
 *
 * ⚠️ A failed pull says so. The shared query keeps the old list when a refresh
 * fails, which is right — a vendor mid-scroll should not be handed a blank
 * screen — but on its own it keeps it silently, and section 31.2 warns against
 * a vendor acting on stale leads. `isStale` is true in exactly that case, and
 * the screen draws a notice above the list with a way to try again, which
 * keeps the notice up while it reads (`useStaleState`, the rule every list now
 * shares). The shared query is unchanged.
 *
 * ⚠️ An action moves its card at once, and only once it is confirmed (Phases
 * 3E-4 and 3E-5). When the service says a request was accepted, rejected,
 * started or completed — or that it is no longer this vendor's to answer —
 * `settle` lays that over the last read: accepted goes from Pending to Active,
 * rejected from Pending to the top of Rejected (2026-10-21), started changes in
 * place, completed goes from Active to the top of Completed. Without it the card
 * would keep its old
 * status and live buttons until the re-read landed, and a second tap would be
 * refused as already done. It is the service's answer shown a moment early,
 * never a guess (section 33.1), and it gives way to the service: an entry stops
 * applying, and is dropped, as soon as a read no longer shows the request
 * where and as it was before the action — that read has caught up.
 *
 * ⚠️ Read again when the work changes anywhere (`VendorWorkSync`). The list stays
 * mounted under the details it opened, so a request answered there is re-read
 * here while the details are still on screen, and is where it belongs by the
 * time the vendor comes back.
 *
 * ⚠️ Read again, quietly, whenever the tab is shown again (Phase 3E-15, owner
 * decision 21/10/2026) — coming back from another tab or from a request's
 * details — but not on arrival, which the mount has just read. Quiet: no
 * placeholders and no spinner, the list and the chosen filter (the screen's)
 * left as they are until the answer, and nothing sent while a read is already
 * out (`refreshQuietly`). Broadcast leads go stale (section 31.2), and a list
 * that changed only when pulled kept showing leads that may already be gone.
 * A failed quiet read keeps the list and raises the same notice a failed pull
 * does.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useVendorWorkSync } from '@/features/vendor/state/VendorWorkSync';
import { useNavigationEvent } from '@/shared/hooks/useNavigationEvent';
import { useSingleFlightQuery } from '@/shared/hooks/useSingleFlightQuery';
import { useStaleState } from '@/shared/hooks/useStaleState';
import { getService } from '@/shared/services/ServiceRegistry';
import type { VendorRequestGroup } from '@/features/vendor/constants/requestFilters';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';
import type { VendorRequestList } from '@/shared/services/types/VendorRequestService';
import type { AppError } from '@/shared/types/error';

/** Where the service's answer puts a request: a group and its record, or nowhere. */
export type SettledPlace = { group: VendorRequestGroup; request: VendorJobSummary } | null;

/**
 * One confirmed action the last read does not show yet.
 *
 * `from` is where the read had the request, and as what, before the action —
 * which is also how a later read is known to have caught up: it no longer shows
 * it there, like that. `to` is where the service's answer puts it.
 */
export interface SettledChange {
  from: { group: VendorRequestGroup; status: string };
  to: SettledPlace;
}

/** Confirmed actions the last read does not show yet, by reference. */
export type SettledAnswers = ReadonlyMap<string, SettledChange>;

/** Whether a read still shows a request exactly as it was before the action. */
function stillAsBefore(list: VendorRequestList, id: string, change: SettledChange): boolean {
  return list[change.from.group].some(job => job.id === id && job.status === change.from.status);
}

/** The last read, with the confirmed actions laid over it. A fresh list; neither input changes. */
export function applySettledAnswers(list: VendorRequestList, settled: SettledAnswers): VendorRequestList {
  if (settled.size === 0) {
    return list;
  }

  const groups: VendorRequestList = {
    pending: [...list.pending],
    active: [...list.active],
    completed: [...list.completed],
    rejected: [...list.rejected],
  };

  for (const [id, change] of settled) {
    // A read that has caught up wins; the entry is pruned after this render.
    if (!stillAsBefore(list, id, change)) {
      continue;
    }

    const from = groups[change.from.group];
    const index = from.findIndex(job => job.id === id);
    const { to } = change;

    if (to && to.group === change.from.group) {
      // Started: the same card, its new status, where it was.
      from[index] = to.request;
      continue;
    }

    from.splice(index, 1);
    if (!to || groups[to.group].some(job => job.id === id)) {
      continue;
    }
    // Finished and declined work are listed latest first; accepted work after
    // what is already under way.
    if (to.group === 'completed' || to.group === 'rejected') {
      groups[to.group].unshift(to.request);
    } else {
      groups[to.group].push(to.request);
    }
  }

  return groups;
}

/** The entries a read has caught up with removed. */
export function pruneSettledAnswers(settled: SettledAnswers, list: VendorRequestList): SettledAnswers {
  const kept = [...settled].filter(([id, change]) => stillAsBefore(list, id, change));

  return kept.length === settled.size ? settled : new Map(kept);
}

/** Where a read has a request, and as what. */
function locate(list: VendorRequestList, id: string): SettledChange['from'] | undefined {
  for (const group of ['pending', 'active', 'completed', 'rejected'] as const) {
    const job = list[group].find(candidate => candidate.id === id);
    if (job) {
      return { group, status: job.status };
    }
  }
  return undefined;
}

export interface VendorRequestsState {
  /** Undefined until the first load answers. */
  list: VendorRequestList | undefined;
  /** True for the first load and for a retry after it failed. */
  isLoading: boolean;
  /** The first load failed and there is nothing to show. */
  error: AppError | null;
  /** Loads again, showing the loading state. For the error's Try again. */
  retry: () => void;

  /** Pull-to-refresh: loads again with the list left on screen. */
  refresh: () => void;
  isRefreshing: boolean;
  /** The last refresh failed; what is on screen is from before it. */
  isStale: boolean;
  /** Why the refresh failed, for the notice. Null unless `isStale`. */
  staleError: AppError | null;

  /**
   * Shows what the service just confirmed about one request: where its answer
   * puts it, with the record — or null for one that has left the list. For the
   * action's own outcome only — never a guess.
   */
  settle: (requestId: string, to: SettledPlace) => void;
}

export function useVendorRequests(): VendorRequestsState {
  const query = useSingleFlightQuery<VendorRequestList>(
    useCallback(() => getService('vendorRequests').listRequests(), []),
    [],
  );

  const [settled, setSettled] = useState<SettledAnswers>(() => new Map());

  const { data } = query;
  const readRef = useRef(data);
  readRef.current = data;

  const settle = useCallback((requestId: string, to: SettledPlace) => {
    setSettled(current => {
      // A second action before the read caught up with the first (accept, then
      // start): still measured from where the read has it, now going further.
      const from = current.get(requestId)?.from ?? (readRef.current && locate(readRef.current, requestId));
      if (!from) {
        // Not in the read at all: nothing on screen to move early.
        return current;
      }
      return new Map(current).set(requestId, { from, to });
    });
  }, []);

  // Each read that has caught up with an action takes over from it.
  useEffect(() => {
    if (data) {
      setSettled(current => pruneSettledAnswers(current, data));
    }
  }, [data]);

  // The work changed somewhere — here, on the details screen — so read it again.
  const { revision } = useVendorWorkSync();
  const readAt = useRef(revision);
  const { refresh } = query;
  useEffect(() => {
    if (readAt.current === revision) {
      return;
    }
    readAt.current = revision;
    refresh();
  }, [refresh, revision]);

  // The tab shown again: read under what is on screen. Not on arrival — that read is the load.
  useNavigationEvent('focus', query.refreshQuietly, { onlyOnReturn: true });

  const list = useMemo(() => (data ? applySettledAnswers(data, settled) : undefined), [data, settled]);

  // With a list on screen a failure is a stale list, not an error page.
  const stale = useStaleState({
    hasData: data !== undefined,
    error: query.error,
    isRefreshing: query.isRefreshing,
  });

  return {
    list,
    isLoading: query.isLoading,
    error: stale.error,
    retry: query.retry,
    refresh: query.refresh,
    isRefreshing: query.isRefreshing,
    isStale: stale.isStale,
    staleError: stale.staleError,
    settle,
  };
}
