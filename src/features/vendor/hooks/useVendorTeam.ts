/**
 * useVendorTeam
 *
 * The signed-in vendor's team, and taking somebody off it (PROJECT_BIBLE.md
 * section 39, Phase 3E-7).
 *
 *   Team tab → hook → VendorTeamService → implementation
 *
 * ⚠️ The service's answer is the list. A removal answers with who remains, and
 * that answer is what is drawn — the list is refreshed by the service, not
 * edited here — until a read *started after it* replaces it. A read already in
 * the air when the removal answered (a pull, or the read on returning to the
 * tab) may predate the removal and would bring the member back, so each read
 * is numbered and an older one never overrides the answer. Nothing is shown as
 * removed before the service says so: no optimistic update.
 *
 * ⚠️ One request at a time, and the guards cannot stick. Reads go through the
 * request list's `useSingleFlightQuery` (Phase 3E-3); a removal takes a ref the
 * moment it is asked for and releases it in a `finally`, so five confirms send
 * one call and a failure — however fast — never leaves Remove dead.
 *
 * ⚠️ A failed pull says so, as on the request list: `isStale` is true when a
 * team is on screen and the last refresh failed. A failed *first* read has
 * nothing to keep and is an `error`. The rule is the shared `useStaleState`;
 * the shared queries are unchanged.
 *
 * Outcomes are said once, here, as toasts — the vendor side's convention
 * (`useVendorRequestDecision`): removed, or not removed and why. Logged by kind
 * only, never by name.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { createLogger } from '@/core/logger/Logger';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { ERROR_PRESENTATION, useToast } from '@/shared/components';
import { useSingleFlightQuery } from '@/shared/hooks/useSingleFlightQuery';
import { useStaleState } from '@/shared/hooks/useStaleState';
import { getService } from '@/shared/services/ServiceRegistry';
import type { TeamMember } from '@/shared/services/types/VendorTeamService';
import { AppError } from '@/shared/types/error';

const COPY = VENDOR_COPY.team;

const log = createLogger('useVendorTeam');

/** One list read, numbered in the order reads were started. */
interface Read {
  read: number;
  members: TeamMember[];
}

/** What a removal came to. `ignored` is a second request while one was already in the air. */
export type TeamRemovalOutcome = 'removed' | 'failed' | 'ignored';

export interface VendorTeamState {
  /** Undefined until the first read answers. */
  members: TeamMember[] | undefined;
  /** True for the first read and for a retry after it failed. */
  isLoading: boolean;
  /** The first read failed and there is nothing to show. */
  error: AppError | null;
  /** Reads again, showing the loading state. For the error's Try again. */
  retry: () => void;

  /** Pull-to-refresh, and the read on returning to the tab: the team stays on screen. */
  refresh: () => void;
  isRefreshing: boolean;
  /** The last refresh failed; what is on screen is from before it. */
  isStale: boolean;
  /** Why the refresh failed, for the notice. Null unless `isStale`. */
  staleError: AppError | null;

  /** Takes one member off the team. Resolves once the service has answered. */
  remove: (memberId: string) => Promise<TeamRemovalOutcome>;
  /** The member being removed, so only their card shows busy. */
  removingId: string | null;
}

export function useVendorTeam(): VendorTeamState {
  const { showToast } = useToast();
  /** How many reads have been started; each answer carries its own number. */
  const readsStarted = useRef(0);
  const query = useSingleFlightQuery<Read>(
    useCallback(async () => {
      readsStarted.current += 1;
      const read = readsStarted.current;
      return { read, members: await getService('vendorTeam').listMembers() };
    }, []),
    [],
  );

  /*
    A removal's answer, and how many reads had been started when it came. Every
    one of those is older than it; only a read started afterwards replaces it.
  */
  const [answered, setAnswered] = useState<{ asOf: number; members: TeamMember[] } | null>(null);
  const latestRead = query.data;
  const members =
    answered && (latestRead === undefined || latestRead.read <= answered.asOf)
      ? answered.members
      : latestRead?.members;

  const [removingId, setRemovingId] = useState<string | null>(null);
  const inFlight = useRef(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const remove = useCallback(
    async (memberId: string): Promise<TeamRemovalOutcome> => {
      if (inFlight.current) {
        return 'ignored';
      }
      inFlight.current = true;
      setRemovingId(memberId);

      try {
        const remaining = await getService('vendorTeam').removeMember(memberId);
        if (mountedRef.current) {
          setAnswered({ asOf: readsStarted.current, members: remaining });
        }
        showToast({ message: COPY.removed, tone: 'success', icon: 'success' });
        return 'removed';
      } catch (caught) {
        const error = AppError.from(caught);
        log.warn('Team member not removed', { kind: error.kind });
        const { tone, icon } = ERROR_PRESENTATION[error.kind];
        showToast({ message: `${COPY.removeFailed} ${error.userMessage}`, tone, icon });
        return 'failed';
      } finally {
        inFlight.current = false;
        if (mountedRef.current) {
          setRemovingId(null);
        }
      }
    },
    [showToast],
  );

  // With a team on screen a failure is a stale list, not an error page.
  const stale = useStaleState({
    hasData: query.data !== undefined,
    error: query.error,
    isRefreshing: query.isRefreshing,
  });

  return {
    members,
    isLoading: query.isLoading,
    error: stale.error,
    retry: query.retry,
    refresh: query.refresh,
    isRefreshing: query.isRefreshing,
    isStale: stale.isStale,
    staleError: stale.staleError,
    remove,
    removingId,
  };
}
