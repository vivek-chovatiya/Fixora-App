/**
 * Request filters
 *
 * Which of the vendor's requests the list is showing, and what that means
 * (PROJECT_BIBLE.md section 31, Phase 3E-3).
 *
 * ⚠️ A view, not a query. The service hands over groups it sorted itself
 * (`VendorRequestList`); a filter only chooses which of them to draw. It is
 * never sent anywhere, and the app never decides which group a request is in.
 *
 * What each one means, exactly:
 *
 * - **All** — the work the vendor has or had: every pending, active and
 *   completed request the service returned, in that order, each group under its
 *   own heading with its count. A group with nothing in it is left out rather
 *   than drawn as an empty heading; with nothing in any group the list is empty
 *   and says so.
 * - **Pending / Active / Completed** — that group alone, in the service's
 *   order, with no heading (the selected chip already names it).
 * - **Rejected** — what the vendor declined, most recently declined first, with
 *   no heading. Read-only: a card there opens its request and offers nothing
 *   (owner decision, 2026-10-21).
 *
 * ⚠️ All leaves Rejected out. Section 31 lists Rejected as a tab of its own,
 * and a declined request is not work: under All it would sit among the jobs to
 * do and grow without end beneath them. So All is never the sum of the other
 * four, and a vendor who has declined everything they were sent sees All's
 * empty state — the history is one chip away.
 *
 * Pending, Active and Completed are the dashboard's tiles' words, so a count
 * seen there is a filter here; the dashboard has no Rejected tile. Section 31
 * also names Accepted and In Progress as separate tabs: both are "Active" here,
 * each card saying which. WORKING_NOTES lists that as deferred.
 */

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';
import type { VendorRequestList } from '@/shared/services/types/VendorRequestService';

const COPY = VENDOR_COPY.requests;

export type VendorRequestGroup = keyof VendorRequestList;
export type VendorRequestFilter = 'all' | VendorRequestGroup;

/** The groups All draws — the work, not what was declined. */
type WorkGroup = Exclude<VendorRequestGroup, 'rejected'>;

/** What All lists, in the order it lists them. */
export const VENDOR_REQUEST_GROUPS: readonly WorkGroup[] = ['pending', 'active', 'completed'];

/** The chips, in the order they are drawn: All, the work in order, then what was declined. */
export const VENDOR_REQUEST_FILTERS: ReadonlyArray<{ value: VendorRequestFilter; label: string }> = [
  { value: 'all', label: COPY.filterAll },
  { value: 'pending', label: COPY.filterPending },
  { value: 'active', label: COPY.filterActive },
  { value: 'completed', label: COPY.filterCompleted },
  { value: 'rejected', label: COPY.filterRejected },
];

const GROUP_TITLES: Readonly<Record<WorkGroup, string>> = {
  pending: COPY.groupPending,
  active: COPY.groupActive,
  completed: COPY.groupCompleted,
};

/** What a view with nothing in it says. */
export const VENDOR_REQUEST_EMPTY: Readonly<
  Record<VendorRequestFilter, { title: string; message: string }>
> = {
  all: { title: COPY.emptyAllTitle, message: COPY.emptyAllMessage },
  pending: { title: COPY.emptyPendingTitle, message: COPY.emptyPendingMessage },
  active: { title: COPY.emptyActiveTitle, message: COPY.emptyActiveMessage },
  completed: { title: COPY.emptyCompletedTitle, message: COPY.emptyCompletedMessage },
  rejected: { title: COPY.emptyRejectedTitle, message: COPY.emptyRejectedMessage },
};

/** One line of the list: a group's heading, or a request. */
export type VendorRequestLine =
  | { kind: 'heading'; key: string; group: VendorRequestGroup; title: string; count: number }
  | { kind: 'request'; key: string; group: VendorRequestGroup; job: VendorJobSummary };

function requestLines(group: VendorRequestGroup, jobs: readonly VendorJobSummary[]): VendorRequestLine[] {
  // Keyed by group as well as reference, so a record the backend listed in two
  // groups would be two lines rather than a key collision.
  return jobs.map(job => ({ kind: 'request' as const, key: `${group}:${job.id}`, group, job }));
}

/** The lines a filter draws, in order. Empty means the view has nothing to show. */
export function vendorRequestLinesFor(
  list: VendorRequestList,
  filter: VendorRequestFilter,
): VendorRequestLine[] {
  if (filter !== 'all') {
    return requestLines(filter, list[filter]);
  }

  return VENDOR_REQUEST_GROUPS.flatMap(group => {
    const jobs = list[group];
    if (jobs.length === 0) {
      return [];
    }

    return [
      {
        kind: 'heading' as const,
        key: `heading:${group}`,
        group,
        title: GROUP_TITLES[group],
        count: jobs.length,
      },
      ...requestLines(group, jobs),
    ];
  });
}
