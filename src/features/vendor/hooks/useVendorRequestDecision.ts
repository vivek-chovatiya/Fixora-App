/**
 * useVendorRequestDecision
 *
 * Everything a vendor can do to a request, the same way from the list and from
 * a request's details: accept or reject one that is waiting (PROJECT_BIBLE.md
 * section 33, Phase 3E-4), and start or complete accepted work (sections 35 and
 * 36, Phase 3E-5).
 *
 *   Screen → hook → VendorRequestService → implementation
 *
 * ⚠️ One action at a time, and the guard cannot stick. A ref is taken the moment
 * an action is asked for — before any state lands, so five quick taps send one
 * request — and released in a `finally` when the service has answered, whatever
 * it answered: done, refused, failed, or threw something that was not an
 * `AppError` at all. Released by the call settling, never by watching a loading
 * flag (the 3E-2 bug). One guard for all four actions, so while a job is being
 * started nothing else on the screen can be accepted, rejected or completed.
 *
 * ⚠️ Nothing is shown as done before the service says it is (section 33.1). The
 * screen is handed the record the service returned, and changes what it shows
 * from that.
 *
 * Three ways it can end, each said once, here, so the list and the details
 * cannot say them differently:
 *
 * - **answered** — a short confirmation, and the other screens told the work
 *   changed so they read it again;
 * - **unavailable** — the request is not there for this action any more:
 *   another professional took it, it was already answered, its work had already
 *   moved on (an invalid transition), or it is no longer this vendor's.
 *   Information, not a fault (section 49.1): a calm message, and every screen
 *   reads again so the request shows where it really is;
 * - **failed** — nothing changed. The failure's own words, the request left
 *   exactly as it was, and the same button is the retry.
 *
 * The name is 3E-4's, when answering was all there was; "decision" now covers
 * the work steps too.
 *
 * ⚠️ Completing carries the vendor's record of the job — the final amount and
 * the offline payment (sections 36 and 37) — so it is its own call,
 * `complete(requestId, completion)`, and `answer` takes only the actions a
 * reference is enough for. Same guard, same toasts, same signal: it is still
 * one of the four actions, and while it is in the air nothing else is sent.
 *
 * ⚠️ Recording a payment after the job (owner decision, 21/10/2026) is
 * `recordPayment(requestId, payment)`, for the reason completing is its own
 * call: it carries what was recorded. Same guard, same toasts, same signal —
 * so the list and the dashboard hear of it — and a refusal (`invalidTransition`:
 * there is no "Not paid yet" record to change) is the calm 3E-5 message. It is
 * not one of section 54's events, so it sends none.
 *
 * ⚠️ Section 54's vendor events are sent here, from the service's answer and
 * nothing else — `request_accepted`, `request_rejected`, `work_started` and
 * `work_completed` when it says done, `request_accept_lost` when an accept is
 * refused as `taken` (section 33.1). Every other refusal (`notPending`,
 * `invalidTransition`), a request that is not this vendor's, a failure and an
 * ignored second tap send nothing: nothing happened that the vendor did. The
 * events carry the reference, and the routing or the payment status where
 * they apply — never the amount, the notes or anything about the customer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { createLogger } from '@/core/logger/Logger';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useVendorWorkSync } from '@/features/vendor/state/VendorWorkSync';
import { ERROR_PRESENTATION, useToast, type ToastOptions } from '@/shared/components';
import { useAnalytics } from '@/shared/hooks/useAnalytics';
import { getService } from '@/shared/services/ServiceRegistry';
import type {
  AnalyticsProperties,
  VendorAnalyticsEvent,
} from '@/shared/services/types/AnalyticsService';
import type { VendorJobDispatch } from '@/shared/services/types/VendorDashboardService';
import type {
  VendorCompletionInput,
  VendorPaymentInput,
  VendorRequestAction,
  VendorRequestDetails,
  VendorRequestRefusal,
  VendorRequestService,
  VendorWorkRefusal,
} from '@/shared/services/types/VendorRequestService';
import { AppError } from '@/shared/types/error';

const COPY = VENDOR_COPY.answer;
const WORK = VENDOR_COPY.work;

const log = createLogger('useVendorRequestDecision');

/** Why an action did not happen, as a business answer rather than a fault. */
export type VendorActionRefusal = VendorRequestRefusal | VendorWorkRefusal | 'notFound';

/**
 * The actions a reference is enough for. Completing, and recording a payment
 * later, also carry what was recorded.
 */
export type VendorReferenceAction = Exclude<VendorRequestAction, 'complete' | 'recordPayment'>;

export type VendorDecisionOutcome =
  /** The service recorded it; `request` is the record as it now stands. */
  | { kind: 'answered'; decision: VendorRequestAction; request: VendorRequestDetails }
  /** Not there for this action any more — `notFound` when it is not this vendor's at all. */
  | { kind: 'unavailable'; reason: VendorActionRefusal }
  /** Nothing changed. */
  | { kind: 'failed'; error: AppError }
  /** Another action was already in the air; this one was not sent. */
  | { kind: 'ignored' };

export interface VendorRequestDecisionState {
  /** The request an action is being sent for, so only its controls show progress. */
  answeringId: string | null;
  /** Which action is in the air. */
  answering: VendorRequestAction | null;
  /** Any action is in the air: every action button on the screen waits for it. */
  isAnswering: boolean;
  /**
   * `dispatch` is how the waiting request reached this vendor, as the record
   * on screen says — passed by the caller that already holds it, because the
   * record the service answers with is no longer waiting and has none. Only
   * section 54's accept and reject events carry it; nothing is read to find it.
   */
  answer: (
    requestId: string,
    decision: VendorReferenceAction,
    dispatch?: VendorJobDispatch,
  ) => Promise<VendorDecisionOutcome>;
  /** Completes work under way with the vendor's record of it (sections 36 and 37). */
  complete: (requestId: string, completion: VendorCompletionInput) => Promise<VendorDecisionOutcome>;
  /** Records that the customer of a finished, unpaid job has now paid (21/10/2026). */
  recordPayment: (requestId: string, payment: VendorPaymentInput) => Promise<VendorDecisionOutcome>;
}

/** One service call, whatever the action: done with a record, or refused with a reason. */
type Sent =
  | { outcome: 'done'; request: VendorRequestDetails }
  | { outcome: 'refused'; reason: VendorRequestRefusal | VendorWorkRefusal };

/** How the call behind an action is made, once everything it needs is in hand. */
type Send = (service: VendorRequestService) => Promise<Sent>;

interface ActionSpec {
  done: ToastOptions;
  /** Said before the failure's own message. */
  failed: string;
}

/** Each service result, with its outcome named once: done or refused. */
function sent(
  result:
    | { outcome: string; request: VendorRequestDetails }
    | { outcome: 'refused'; reason: VendorRequestRefusal | VendorWorkRefusal },
): Sent {
  return 'reason' in result ? result : { outcome: 'done', request: result.request };
}

/*
  ⚠️ Each entry is a function, called when its toast is shown. They were
  objects of strings read when this module loaded, which kept every accept,
  reject and work toast in that moment's language after the app switched
  (Phase 5, 28/11/2026). The same holds for REFUSAL_COPY below.
*/
const ACTIONS: Readonly<Record<VendorRequestAction, () => ActionSpec>> = {
  accept: () => ({
    done: { message: COPY.accepted, tone: 'success', icon: 'success' },
    failed: COPY.acceptFailed,
  }),
  reject: () => ({
    done: { message: COPY.rejected, tone: 'neutral', icon: 'reject' },
    failed: COPY.rejectFailed,
  }),
  start: () => ({
    done: { message: WORK.started, tone: 'info', icon: 'startWork' },
    failed: WORK.startFailed,
  }),
  complete: () => ({
    done: { message: WORK.completed, tone: 'success', icon: 'completeWork' },
    failed: WORK.completeFailed,
  }),
  recordPayment: () => ({
    done: { message: WORK.paymentRecorded, tone: 'success', icon: 'success' },
    failed: WORK.recordPaymentFailed,
  }),
};

/** The calls behind the actions a reference is enough for. */
const BY_REFERENCE: Readonly<
  Record<VendorReferenceAction, (service: VendorRequestService, id: string) => Promise<Sent>>
> = {
  accept: async (service, id) => sent(await service.acceptRequest(id)),
  reject: async (service, id) => sent(await service.rejectRequest(id)),
  start: async (service, id) => sent(await service.startRequest(id)),
};

const REFUSAL_COPY: Readonly<Record<VendorActionRefusal, () => string>> = {
  taken: () => COPY.taken,
  notPending: () => COPY.notPending,
  invalidTransition: () => WORK.changed,
  notFound: () => COPY.unavailable,
};

/**
 * Section 54's event for each action the service said was done. A payment
 * recorded later has none: section 54 lists only essential events, and this is
 * not one of them.
 */
const DONE_EVENT: Readonly<Partial<Record<VendorRequestAction, VendorAnalyticsEvent>>> = {
  accept: 'request_accepted',
  reject: 'request_rejected',
  start: 'work_started',
  complete: 'work_completed',
};

export function useVendorRequestDecision(): VendorRequestDecisionState {
  const { showToast } = useToast();
  const { workChanged } = useVendorWorkSync();
  const { track } = useAnalytics();

  const [inAir, setInAir] = useState<{ requestId: string; decision: VendorRequestAction } | null>(
    null,
  );

  const inFlight = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Every action, sent through the one guard. `counted` is what its done event carries. */
  const run = useCallback(
    async (
      requestId: string,
      decision: VendorRequestAction,
      send: Send,
      counted: AnalyticsProperties,
    ): Promise<VendorDecisionOutcome> => {
      if (inFlight.current) {
        return { kind: 'ignored' };
      }
      inFlight.current = true;
      setInAir({ requestId, decision });

      const action = ACTIONS[decision];

      const unavailable = (reason: VendorActionRefusal): VendorDecisionOutcome => {
        showToast({ message: REFUSAL_COPY[reason](), tone: 'info', icon: 'info' });
        // What is on screen is wrong about this request; every view reads again.
        workChanged();
        return { kind: 'unavailable', reason };
      };

      try {
        const result = await send(getService('vendorRequests'));

        if (result.outcome === 'refused') {
          // Only a lost race is an event: section 54 counts it to learn how
          // contested open dispatch is. Being refused because the vendor had
          // already answered, or the work had moved on, is not a race.
          if (decision === 'accept' && result.reason === 'taken') {
            track('request_accept_lost', { requestId });
          }
          return unavailable(result.reason);
        }

        const event = DONE_EVENT[decision];
        if (event) {
          track(event, counted);
        }
        showToast(action().done);
        workChanged();
        return { kind: 'answered', decision, request: result.request };
      } catch (caught) {
        const error = AppError.from(caught);
        // The kind and the action only: a reference is the customer's, not the log's.
        log.error('answer failed', { kind: error.kind, decision });

        // Not this vendor's (any more): the same calm answer as a lost race.
        if (error.kind === 'notFound') {
          return unavailable('notFound');
        }

        const { tone, icon } = ERROR_PRESENTATION[error.kind];
        showToast({ message: `${action().failed} ${error.userMessage}`, tone, icon });
        return { kind: 'failed', error };
      } finally {
        inFlight.current = false;
        if (mountedRef.current) {
          setInAir(null);
        }
      }
    },
    [showToast, workChanged, track],
  );

  const answer = useCallback(
    (requestId: string, decision: VendorReferenceAction, dispatch?: VendorJobDispatch) =>
      run(
        requestId,
        decision,
        service => BY_REFERENCE[decision](service, requestId),
        // Routing belongs to the answer, and only when the record said it;
        // started work is past routing.
        decision !== 'start' && dispatch ? { requestId, dispatch } : { requestId },
      ),
    [run],
  );

  const complete = useCallback(
    (requestId: string, completion: VendorCompletionInput) =>
      run(
        requestId,
        'complete',
        async service => sent(await service.completeRequest(requestId, completion)),
        // Paid or not, as recorded — never the amount, the method or the notes.
        { requestId, paymentStatus: completion.paymentStatus },
      ),
    [run],
  );

  const recordPayment = useCallback(
    (requestId: string, payment: VendorPaymentInput) =>
      run(
        requestId,
        'recordPayment',
        async service => sent(await service.recordPayment(requestId, payment)),
        // Never sent: no section 54 event is named for it (see DONE_EVENT).
        {},
      ),
    [run],
  );

  return {
    answeringId: inAir?.requestId ?? null,
    answering: inAir?.decision ?? null,
    isAnswering: inAir !== null,
    answer,
    complete,
    recordPayment,
  };
}
