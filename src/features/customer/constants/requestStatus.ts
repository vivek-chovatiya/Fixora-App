/**
 * Request status
 *
 * What a request's status means to the customer, in one place
 * (PROJECT_BIBLE.md sections 20 and 21).
 *
 * ⚠️ A stage is derived, never stored. The backend sends a section 21 status —
 * `CREATED`, `PENDING_VENDOR`, `ACCEPTED` — and the customer needs something
 * more specific: whether Fixora is searching for anyone, or waiting on the one
 * professional they chose. Section 21 says that difference is routing, not
 * status, and the owner confirmed on 2026-09-11 that the app should derive it
 * rather than invent statuses of its own. So `requestStateOf` reads the backend
 * status together with the dispatch mode, and the result lives only as long as
 * a render: nothing here is sent, saved, or put in the draft.
 *
 * ⚠️ Nothing here moves on its own. There is no timer, no polling and no
 * transition table — a stage changes when the backend's status does and the
 * screen reads it again. The progress steps describe the usual path a request
 * takes, not a promise about the next one; section 20 allows a directed request
 * to fall back to open dispatch, and whatever the backend then says is what the
 * next read shows.
 *
 * The rules the copy keeps (see `CUSTOMER_COPY.requestStatus`): nothing claims a
 * professional was notified, has accepted, is travelling or will arrive by a
 * time. "Assigned" appears only for `ACCEPTED` and later.
 *
 * A status the table does not know is shown as unavailable — neutral, with no
 * progress drawn — rather than guessed at. In particular it is never treated as
 * completed.
 */

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import type { StatusTone } from '@/shared/components';
import type { RequestStatus } from '@/shared/services/types/RequestService';
import type { IconName } from '@/shared/theme';

const COPY = CUSTOMER_COPY.requestStatus;

/** The usual path a request takes, in order. */
export type RequestLifecycleStage =
  | 'submitted'
  | 'searching'
  | 'awaiting_vendor'
  | 'assigned'
  | 'in_progress'
  | 'completed';

/**
 * Everything a customer can be told about where a request stands.
 *
 * The six stages, plus four states that are not steps on the path:
 *
 * - `awaiting_professional` — the pre-acceptance wait when the caller does not
 *   know the dispatch mode. Guessing "searching" or "awaiting response" there
 *   would be telling half of all customers something untrue. (Request cards knew
 *   no dispatch mode until Phase 3D-5 put the preference on the summary; they
 *   now say which wait it is, and this remains for any caller that cannot.)
 * - `cancelled`, `rejected`, `on_hold` — section 21's alternative states. Known
 *   and worded, but off the path, so no progress is drawn for them.
 * - `unknown` — any value section 21 does not name.
 */
export type RequestStatusState =
  | RequestLifecycleStage
  | 'awaiting_professional'
  | 'cancelled'
  | 'rejected'
  | 'on_hold'
  | 'unknown';

/**
 * How a request is being routed (PROJECT_BIBLE.md section 18A).
 *
 * `directed` when the customer chose a professional, `open` when they chose no
 * preference. Read from the request, never from a status.
 */
export type RequestDispatch = 'open' | 'directed';

export interface RequestStatusPresentation {
  state: RequestStatusState;
  /** Short enough for a badge on a card. */
  label: string;
  /** The heading on the request itself. */
  title: string;
  /** One sentence saying what the state means, and nothing it does not. */
  description: string;
  /** Emphasis only; the words always say which state this is (section 46). */
  tone: StatusTone;
  /** A glyph as well as a tone, so the state survives greyscale. */
  icon: IconName;
}

/**
 * Tone and glyph per state. The words come from the copy file.
 *
 * Tone carries emphasis, not identity: an unknown or cancelled request has not
 * earned alarm, and a completed one is the only state that earns success.
 */
const VISUALS: Readonly<Record<RequestStatusState, { tone: StatusTone; icon: IconName }>> =
  Object.freeze({
    submitted: { tone: 'neutral', icon: 'send' },
    searching: { tone: 'info', icon: 'search' },
    awaiting_vendor: { tone: 'info', icon: 'pending' },
    awaiting_professional: { tone: 'info', icon: 'pending' },
    assigned: { tone: 'info', icon: 'verified' },
    in_progress: { tone: 'warning', icon: 'pending' },
    completed: { tone: 'success', icon: 'success' },
    cancelled: { tone: 'neutral', icon: 'close' },
    rejected: { tone: 'danger', icon: 'error' },
    on_hold: { tone: 'warning', icon: 'warning' },
    unknown: { tone: 'neutral', icon: 'help' },
  });

/**
 * The customer-facing state of a backend status.
 *
 * `dispatch` is optional because a summary does not carry one. Without it, the
 * pre-acceptance wait is `awaiting_professional` — true of both kinds of wait —
 * rather than a guess at which one this is.
 *
 * Case and padding are forgiven, since a backend changing its mind about either
 * is not a new status.
 */
export function requestStateOf(status: RequestStatus, dispatch?: RequestDispatch): RequestStatusState {
  const normalised = typeof status === 'string' ? status.trim().toUpperCase() : '';

  switch (normalised) {
    case 'CREATED':
      return 'submitted';
    case 'PENDING_VENDOR':
      if (dispatch === 'open') {
        return 'searching';
      }
      return dispatch === 'directed' ? 'awaiting_vendor' : 'awaiting_professional';
    case 'ACCEPTED':
      return 'assigned';
    case 'IN_PROGRESS':
      return 'in_progress';
    // Section 21 lists both. To a customer, a closed request is a finished one.
    case 'COMPLETED':
    case 'CLOSED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    case 'REJECTED':
      return 'rejected';
    case 'ON_HOLD':
      return 'on_hold';
    default:
      return 'unknown';
  }
}

export function presentRequestState(state: RequestStatusState): RequestStatusPresentation {
  // Guarded at runtime as well as by type: a state that is not in the table is
  // presented as unknown rather than as a blank.
  const known: RequestStatusState = state in VISUALS ? state : 'unknown';
  const words = COPY[known];
  const visuals = VISUALS[known];

  return {
    state: known,
    label: words.label,
    title: words.title,
    description: words.description,
    tone: visuals.tone,
    icon: visuals.icon,
  };
}

/**
 * Whether the backend has put somebody on the job.
 *
 * ⚠️ The only gate on showing an assigned professional. A record may carry a
 * vendor name before this is true, and drawing it then would be telling a
 * customer their request was accepted when the status says it was not.
 */
export function hasAssignedProfessional(state: RequestStatusState): boolean {
  return state === 'assigned' || state === 'in_progress' || state === 'completed';
}

/**
 * Whether the customer may cancel a request in this state (owner decision,
 * 21/10/2026).
 *
 * Only while no professional has accepted it: received, searching, or waiting
 * for the professional they chose — through either dispatch mode, or when the
 * mode is not known. Before acceptance nobody has committed any time; after it,
 * cancelling would mean talking to the professional, and Phase 1 has no channel
 * for that.
 *
 * ⚠️ It fails closed. Assigned, in progress, completed, cancelled, not accepted,
 * on hold — where it is not known whether anybody is involved — and any status
 * section 21 does not name are all `false`. Deciding what to show is all this
 * does: the service keeps its own copy of the rule and refuses the rest, which is
 * how a professional accepting it in the meantime is answered.
 */
export function isCancellableState(state: RequestStatusState): boolean {
  return (
    state === 'submitted' ||
    state === 'searching' ||
    state === 'awaiting_vendor' ||
    state === 'awaiting_professional'
  );
}

export type RequestStepProgress = 'complete' | 'current' | 'upcoming';

export interface RequestProgressStep {
  stage: RequestLifecycleStage;
  title: string;
  progress: RequestStepProgress;
}

/** Where each stage sits on the path. States off the path have no position. */
const STEP_INDEX: Readonly<Partial<Record<RequestStatusState, number>>> = Object.freeze({
  submitted: 0,
  searching: 1,
  awaiting_vendor: 1,
  assigned: 2,
  in_progress: 3,
  completed: 4,
});

/**
 * The path, marked with where this request is on it — or null when it is not
 * on the path at all.
 *
 * ⚠️ Only what has happened is marked complete. Steps after the current one are
 * `upcoming` and must be drawn as not having happened; the second step is worded
 * for this request's own dispatch mode, so an open request is never shown as
 * waiting on a professional nobody chose.
 *
 * `completed` is the one state whose own step is complete rather than current:
 * a finished request has nothing still under way.
 */
export function requestProgressOf(
  state: RequestStatusState,
  dispatch: RequestDispatch,
): RequestProgressStep[] | null {
  const current = STEP_INDEX[state];

  if (current === undefined) {
    return null;
  }

  const waiting: RequestLifecycleStage =
    state === 'searching' || state === 'awaiting_vendor'
      ? state
      : dispatch === 'directed'
        ? 'awaiting_vendor'
        : 'searching';

  const path: RequestLifecycleStage[] = ['submitted', waiting, 'assigned', 'in_progress', 'completed'];

  return path.map((stage, index) => ({
    stage,
    title: COPY[stage].title,
    progress:
      index < current || (index === current && stage === 'completed')
        ? 'complete'
        : index === current
          ? 'current'
          : 'upcoming',
  }));
}

/**
 * What a screen reader hears for the whole status block.
 *
 * The state and what it means first, then the path so far — what is complete and
 * what is current. Upcoming steps are not read out: they have not happened, and
 * listing them in the same breath as the ones that have is the audio version of
 * drawing them filled in.
 */
export function describeRequestStatus(
  presentation: RequestStatusPresentation,
  steps: RequestProgressStep[] | null,
): string {
  const parts = [`${COPY.summaryPrefix}: ${presentation.title}.`, presentation.description];

  for (const step of steps ?? []) {
    if (step.progress === 'complete') {
      parts.push(`${step.title} ${COPY.stepComplete}.`);
    } else if (step.progress === 'current') {
      parts.push(`${step.title} ${COPY.stepCurrent}.`);
    }
  }

  return parts.join(' ');
}
