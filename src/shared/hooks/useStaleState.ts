/**
 * useStaleState
 *
 * The one rule for a read that failed with something already on screen: the
 * screen keeps what it has and says it may be out of date (`StaleNotice`); only
 * a failure that left nothing to show is the error state.
 *
 * Written once for what had been written seven times — the vendor's requests,
 * reviews, team, report and shop images, the customer's categories and Home's
 * recent requests — each as `hasData && error`, each the same three lines.
 * `useServiceQuery` is unchanged: it keeps the last answer when a refresh fails
 * and reports the failure beside it, which is what every one of them relies on.
 *
 * ⚠️ The notice stays while it is being answered. `useServiceQuery` clears its
 * error the moment a refresh starts, so a rule read straight off it dropped the
 * notice as soon as Try again was pressed — its spinner was never seen — and a
 * second failure drew it again from nothing, to be announced as if new. So the
 * last stale failure is held for as long as a refresh is in the air: the notice
 * keeps its place with Try again busy, goes when a read answers, and takes the
 * newer reason when one fails. Held through any refresh, not only one started
 * from the notice: a pull and Try again are the same `refresh`, and in both the
 * list on screen is still the one from before the failure until a read answers.
 *
 * ⚠️ Never re-announced for the same failure. Because the notice is never taken
 * down while its retry is out, a second failure with the same reason changes
 * nothing it says, and a screen reader is not told it again; a different reason
 * changes its words, and is. That is decided here and not in the notice: the
 * notice cannot tell a retry's failure from a first one.
 *
 * `error` is a failure with nothing on screen, for the error state. A failure
 * with something on screen is `isStale` with its `staleError`, and never also an
 * `error`.
 */

import { useRef } from 'react';

import type { AppError } from '@/shared/types/error';

export interface StaleInput {
  /** Something is on screen: a read has answered. */
  hasData: boolean;
  /** The last read's failure, as the query reports it — cleared when a read starts. */
  error: AppError | null;
  /** A refresh is in the air. */
  isRefreshing: boolean;
}

export interface StaleState {
  /** The read failed and there is nothing to show. Null whenever something is on screen. */
  error: AppError | null;
  /** Something is on screen and the last refresh failed, or is being tried again after failing. */
  isStale: boolean;
  /** Why, for the notice. Null unless `isStale`. */
  staleError: AppError | null;
}

/**
 * The rule itself, given the failure held from before. Exported for its test;
 * screens' hooks use `useStaleState`, which does the holding.
 */
export function splitStale(
  { hasData, error, isRefreshing }: StaleInput,
  held: AppError | null,
): StaleState {
  if (!hasData) {
    return { error, isStale: false, staleError: null };
  }

  const staleError = error ?? (isRefreshing ? held : null);
  return { error: null, isStale: staleError !== null, staleError };
}

export function useStaleState(input: StaleInput): StaleState {
  /*
    The failure the notice last showed. Written as the render reads it, as the
    query's own refs are: the next render that needs it is the one that follows
    a refresh starting, and by then this is what the notice was showing.
  */
  const held = useRef<AppError | null>(null);

  const state = splitStale(input, held.current);
  held.current = state.staleError;
  return state;
}
