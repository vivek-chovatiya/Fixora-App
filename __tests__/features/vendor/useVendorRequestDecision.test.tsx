/**
 * Answering a waiting request, as the hook both screens use does it
 * (PROJECT_BIBLE.md section 33, Phase 3E-4).
 *
 * Pinned here:
 *
 * - accepted and rejected each come back with the service's record, are said
 *   once, and tell the other screens the work changed
 * - a lost race, an answer already given and a request that is not this
 *   vendor's are said calmly as information, and every screen reads again
 * - a failure is said in the failure's own words and changes nothing — no
 *   "work changed", because nothing did
 * - five quick answers send one request; while it is in the air the hook says
 *   which request and which answer
 * - the guard opens again after every way an answer can end: accepted,
 *   refused, failed, and an exception that was not an AppError at all
 * - a failure is logged by its kind, never with the request's reference
 * - the work steps (3E-5) go through the same guard, the same toasts and the
 *   same signal: started and completed said once, a step refused because the
 *   job had moved on said calmly, a failed step changing nothing
 * - completing carries the vendor's record of the job (sections 36 and 37) to
 *   the service exactly as the form built it, through its own `complete` call
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import {
  useVendorRequestDecision,
  type VendorDecisionOutcome,
  type VendorReferenceAction,
  type VendorRequestDecisionState,
} from '@/features/vendor/hooks/useVendorRequestDecision';
import {
  useVendorWorkSync,
  VendorWorkSyncProvider,
  type VendorWorkSyncState,
} from '@/features/vendor/state/VendorWorkSync';
import { ToastProvider } from '@/shared/components';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { VendorJobDispatch } from '@/shared/services/types/VendorDashboardService';
import type {
  VendorCompletionInput,
  VendorRequestDecisionResult,
  VendorRequestDetails,
  VendorRequestService,
  VendorWorkStepResult,
} from '@/shared/services/types/VendorRequestService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const COPY = VENDOR_COPY.answer;
const WORK = VENDOR_COPY.work;

const RECORD: VendorRequestDetails = {
  id: 'REQ-31038',
  serviceName: 'Ceiling fan installation',
  customerName: 'Rahul Menon',
  priority: 'MEDIUM',
  status: 'ACCEPTED',
  createdAt: '2026-09-30T11:05:00.000Z',
};

let accept: jest.Mock<Promise<VendorRequestDecisionResult<'accepted'>>, [string]>;
let reject: jest.Mock<Promise<VendorRequestDecisionResult<'rejected'>>, [string]>;
let start: jest.Mock<Promise<VendorWorkStepResult<'started'>>, [string]>;
let complete: jest.Mock<Promise<VendorWorkStepResult<'completed'>>, [string, VendorCompletionInput]>;

let decision: VendorRequestDecisionState;
let sync: VendorWorkSyncState;
let renderer: ReactTestRenderer.ReactTestRenderer;
/** Failures are logged; the log is read, and kept off the test output. */
let consoleError: jest.SpyInstance;

function Probe() {
  decision = useVendorRequestDecision();
  sync = useVendorWorkSync();
  return null;
}

beforeEach(async () => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  resetServices();
  accept = jest.fn(
    async (_requestId: string): Promise<VendorRequestDecisionResult<'accepted'>> => ({
      outcome: 'accepted',
      request: RECORD,
    }),
  );
  reject = jest.fn(
    async (_requestId: string): Promise<VendorRequestDecisionResult<'rejected'>> => ({
      outcome: 'rejected',
      request: { ...RECORD, status: 'REJECTED' },
    }),
  );
  start = jest.fn(
    async (_requestId: string): Promise<VendorWorkStepResult<'started'>> => ({
      outcome: 'started',
      request: { ...RECORD, status: 'IN_PROGRESS' },
    }),
  );
  complete = jest.fn(
    async (_requestId: string, _completion: VendorCompletionInput): Promise<VendorWorkStepResult<'completed'>> => ({
      outcome: 'completed',
      request: { ...RECORD, status: 'COMPLETED', completedAt: '2026-10-05T12:00:00.000Z' },
    }),
  );
  registerService('vendorRequests', {
    listRequests: jest.fn(),
    getRequest: jest.fn(),
    acceptRequest: accept,
    rejectRequest: reject,
    startRequest: start,
    completeRequest: complete,
  } as unknown as VendorRequestService);

  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <ToastProvider>
          <VendorWorkSyncProvider>
            <Probe />
          </VendorWorkSyncProvider>
        </ToastProvider>
      </ThemeProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => renderer.unmount());
  consoleError.mockRestore();
});

/**
 * A completion as the form sends it (sections 36 and 37). Completing is its
 * own call because it carries this; every other action is a reference alone.
 */
const COMPLETION: VendorCompletionInput = {
  finalAmountMinor: 125_050,
  currency: 'INR',
  paymentStatus: 'PAID',
  paymentMethodId: 'upi',
};

/** Any action, the way a screen asks for it. */
function send(
  requestId: string,
  which: 'accept' | 'reject' | 'start' | 'complete',
): Promise<VendorDecisionOutcome> {
  return which === 'complete'
    ? decision.complete(requestId, COMPLETION)
    : decision.answer(requestId, which);
}

async function answer(
  requestId: string,
  which: 'accept' | 'reject' | 'start' | 'complete',
): Promise<VendorDecisionOutcome> {
  let outcome!: VendorDecisionOutcome;
  await act(async () => {
    outcome = await send(requestId, which);
  });
  return outcome;
}

/** The message on screen in the toast, if one is showing. */
function toast(): string | undefined {
  const [node] = renderer.root.findAll(
    item => item.props?.accessibilityHint === 'Dismisses this message' && typeof item.props.onPress === 'function',
  );
  return node?.props.accessibilityLabel;
}

/** A service call that stays in the air until the test lets it land. */
function held<T>() {
  let land!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, rejectPromise) => {
    land = resolve;
    fail = rejectPromise;
  });
  return { promise, land, fail };
}

describe('An answer the service recorded', () => {
  it('accepts, hands back the service’s record, says so, and tells the other screens', async () => {
    const outcome = await answer('REQ-31038', 'accept');

    expect(accept).toHaveBeenCalledTimes(1);
    expect(accept).toHaveBeenCalledWith('REQ-31038');
    expect(outcome).toEqual({ kind: 'answered', decision: 'accept', request: RECORD });
    expect(toast()).toBe(COPY.accepted);
    expect(sync.revision).toBe(1);
    expect(decision.isAnswering).toBe(false);
  });

  it('rejects, and says so', async () => {
    const outcome = await answer('REQ-31038', 'reject');

    expect(reject).toHaveBeenCalledWith('REQ-31038');
    expect(accept).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ kind: 'answered', decision: 'reject', request: { status: 'REJECTED' } });
    expect(toast()).toBe(COPY.rejected);
    expect(sync.revision).toBe(1);
  });
});

describe('An answer that came too late', () => {
  it('says calmly that another professional took it, and has every screen read again', async () => {
    accept.mockResolvedValueOnce({ outcome: 'refused', reason: 'taken' });

    const outcome = await answer('REQ-31042', 'accept');

    expect(outcome).toEqual({ kind: 'unavailable', reason: 'taken' });
    expect(toast()).toBe(COPY.taken);
    expect(sync.revision).toBe(1);
  });

  it('says a request already answered is no longer waiting', async () => {
    reject.mockResolvedValueOnce({ outcome: 'refused', reason: 'notPending' });

    const outcome = await answer('REQ-31042', 'reject');

    expect(outcome).toEqual({ kind: 'unavailable', reason: 'notPending' });
    expect(toast()).toBe(COPY.notPending);
    expect(sync.revision).toBe(1);
  });

  it('treats a request that is not this vendor’s as no longer available, not as a fault', async () => {
    accept.mockRejectedValueOnce(new AppError({ kind: 'notFound', message: 'gone' }));

    const outcome = await answer('REQ-31038', 'accept');

    expect(outcome).toEqual({ kind: 'unavailable', reason: 'notFound' });
    expect(toast()).toBe(COPY.unavailable);
    expect(sync.revision).toBe(1);
  });
});

describe('An answer that failed', () => {
  it('says what went wrong in the failure’s own words, and changes nothing', async () => {
    const offline = new AppError({ kind: 'network', message: 'socket hang up' });
    accept.mockRejectedValueOnce(offline);

    const outcome = await answer('REQ-31038', 'accept');

    expect(outcome).toEqual({ kind: 'failed', error: offline });
    expect(toast()).toBe(`${COPY.acceptFailed} ${offline.userMessage}`);
    expect(toast()).not.toContain('socket hang up');
    // Nothing happened, so no screen is told to read again.
    expect(sync.revision).toBe(0);
  });

  it('logs the kind of failure and never the request’s reference', async () => {
    accept.mockRejectedValueOnce(new AppError({ kind: 'network' }));

    await answer('REQ-31038', 'accept');

    expect(consoleError).toHaveBeenCalled();
    expect(JSON.stringify(consoleError.mock.calls)).toContain('network');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('REQ-31038');
  });

  it('words a failed rejection as one', async () => {
    reject.mockRejectedValueOnce(new AppError({ kind: 'server' }));

    await answer('REQ-31038', 'reject');

    expect(toast()).toBe(`${COPY.rejectFailed} ${new AppError({ kind: 'server' }).userMessage}`);
  });

  it('does not reveal anything about an expired session beyond asking to sign in again', async () => {
    accept.mockRejectedValueOnce(new AppError({ kind: 'unauthorized', message: 'Mock vendor requests: no vendor session' }));

    await answer('REQ-31038', 'accept');

    expect(toast()).toBe(`${COPY.acceptFailed} ${new AppError({ kind: 'unauthorized' }).userMessage}`);
    expect(sync.revision).toBe(0);
  });
});

describe('One answer at a time', () => {
  it('sends one request for five quick answers, and says which request is in the air', async () => {
    const call = held<VendorRequestDecisionResult<'accepted'>>();
    accept.mockReturnValueOnce(call.promise);

    const outcomes: Array<Promise<VendorDecisionOutcome>> = [];
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        outcomes.push(decision.answer('REQ-31038', 'accept'));
      }
      // And a rejection of another request, in the same breath.
      outcomes.push(decision.answer('REQ-31042', 'reject'));
    });

    expect(accept).toHaveBeenCalledTimes(1);
    expect(reject).not.toHaveBeenCalled();
    expect(decision.isAnswering).toBe(true);
    expect(decision.answeringId).toBe('REQ-31038');
    expect(decision.answering).toBe('accept');

    await act(async () => {
      call.land({ outcome: 'accepted', request: RECORD });
    });

    const settled = await Promise.all(outcomes);
    expect(settled.filter(outcome => outcome.kind === 'ignored')).toHaveLength(5);
    expect(settled[0].kind).toBe('answered');
    expect(decision.isAnswering).toBe(false);
    expect(decision.answeringId).toBeNull();
  });

  it.each([
    ['accepted', () => accept.mockResolvedValueOnce({ outcome: 'accepted', request: RECORD })],
    ['refused', () => accept.mockResolvedValueOnce({ outcome: 'refused', reason: 'taken' })],
    ['failed', () => accept.mockRejectedValueOnce(new AppError({ kind: 'network' }))],
    ['threw something that was not an AppError', () => accept.mockRejectedValueOnce(new TypeError('boom'))],
    [
      'failed at once, synchronously',
      () =>
        accept.mockImplementationOnce(() => {
          throw new Error('sync');
        }),
    ],
  ])('opens again once the answer has %s', async (_how, arrange) => {
    arrange();

    const first = await answer('REQ-31038', 'accept');
    expect(first.kind).not.toBe('ignored');
    expect(decision.isAnswering).toBe(false);

    const second = await answer('REQ-31038', 'accept');
    expect(second.kind).toBe('answered');
    expect(accept).toHaveBeenCalledTimes(2);
  });
});

describe('Moving accepted work along (3E-5)', () => {
  it('starts, hands back the service’s record, says so, and tells the other screens', async () => {
    const outcome = await answer('REQ-30961', 'start');

    expect(start).toHaveBeenCalledWith('REQ-30961');
    expect(complete).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ kind: 'answered', decision: 'start', request: { status: 'IN_PROGRESS' } });
    expect(toast()).toBe(WORK.started);
    expect(sync.revision).toBe(1);
  });

  it('completes, and says so', async () => {
    const outcome = await answer('REQ-30954', 'complete');

    // With the record exactly as the form built it: nothing added, nothing dropped.
    expect(complete).toHaveBeenCalledWith('REQ-30954', COMPLETION);
    expect(outcome).toMatchObject({ kind: 'answered', decision: 'complete', request: { status: 'COMPLETED' } });
    expect(toast()).toBe(WORK.completed);
    expect(sync.revision).toBe(1);
  });

  it.each(['start', 'complete'] as const)(
    'says calmly when the job had already moved on (%s), and has every screen read again',
    async which => {
      (which === 'start' ? start : complete).mockResolvedValueOnce({
        outcome: 'refused',
        reason: 'invalidTransition',
      });

      const outcome = await answer('REQ-30961', which);

      expect(outcome).toEqual({ kind: 'unavailable', reason: 'invalidTransition' });
      expect(toast()).toBe(WORK.changed);
      expect(sync.revision).toBe(1);
    },
  );

  it.each([
    ['start', () => start, WORK.startFailed],
    ['complete', () => complete, WORK.completeFailed],
  ] as const)('says a failed %s failed, in the failure’s own words, and changes nothing', async (which, mock, words) => {
    const offline = new AppError({ kind: 'network', message: 'socket hang up' });
    mock().mockRejectedValueOnce(offline);

    const outcome = await answer('REQ-30961', which);

    expect(outcome).toEqual({ kind: 'failed', error: offline });
    expect(toast()).toBe(`${words} ${offline.userMessage}`);
    expect(sync.revision).toBe(0);
  });

  it.each([
    ['start', () => start],
    ['complete', () => complete],
  ] as const)('sends one %s for five quick taps', async (which, mock) => {
    const call = held<VendorWorkStepResult<'started'> & VendorWorkStepResult<'completed'>>();
    mock().mockReturnValueOnce(call.promise as never);

    const outcomes: Array<Promise<VendorDecisionOutcome>> = [];
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        outcomes.push(send('REQ-30961', which));
      }
      // And an answer to another request in the same breath: one guard for every action.
      outcomes.push(decision.answer('REQ-31038', 'accept'));
    });

    expect(mock()).toHaveBeenCalledTimes(1);
    expect(accept).not.toHaveBeenCalled();
    expect(decision.answeringId).toBe('REQ-30961');
    expect(decision.answering).toBe(which);

    await act(async () => {
      call.land({ outcome: 'refused', reason: 'invalidTransition' });
    });
    const settled = await Promise.all(outcomes);
    expect(settled.filter(outcome => outcome.kind === 'ignored')).toHaveLength(5);
    expect(decision.isAnswering).toBe(false);
  });

  it.each([
    // The default answer: done.
    ['done', (_mock: jest.Mock) => undefined],
    [
      'refused',
      (mock: jest.Mock) => mock.mockResolvedValueOnce({ outcome: 'refused', reason: 'invalidTransition' }),
    ],
    ['failed', (mock: jest.Mock) => mock.mockRejectedValueOnce(new AppError({ kind: 'server' }))],
    ['threw something that was not an AppError', (mock: jest.Mock) => mock.mockRejectedValueOnce(new TypeError('boom'))],
  ])('opens again once a step has %s', async (_how, arrange) => {
    for (const [which, mock] of [
      ['start', start],
      ['complete', complete],
    ] as const) {
      arrange(mock);

      const first = await answer('REQ-30961', which);
      expect(first.kind).not.toBe('ignored');
      expect(decision.isAnswering).toBe(false);

      const second = await answer('REQ-30961', which);
      expect(second.kind).toBe('answered');
    }
    expect(start).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenCalledTimes(2);
  });
});

/**
 * Section 54's vendor events, sent from the service's answer and nothing else:
 * each once, with exactly its keys, and nothing at all for a refusal that is
 * not a lost race, a failure, or a tap ignored while another was in the air.
 * A stub analytics service records the calls, as the auth events' suite does.
 */
describe('What analytics is told (section 54)', () => {
  let track: jest.Mock;

  beforeEach(() => {
    track = jest.fn();
    registerService('analytics', { track, identify: jest.fn() });
  });

  /** Every event sent, by name, in order. */
  const events = () => track.mock.calls.map(call => call[0] as string);

  async function answerWith(
    requestId: string,
    which: VendorReferenceAction,
    dispatch?: VendorJobDispatch,
  ): Promise<VendorDecisionOutcome> {
    let outcome!: VendorDecisionOutcome;
    await act(async () => {
      outcome = await decision.answer(requestId, which, dispatch);
    });
    return outcome;
  }

  it('counts an accept once, with how the request reached the vendor', async () => {
    await answerWith('REQ-31038', 'accept', 'directed');

    expect(track).toHaveBeenCalledTimes(1);
    const [event, properties] = track.mock.calls[0];
    expect(event).toBe('request_accepted');
    expect(Object.keys(properties).sort()).toEqual(['dispatch', 'requestId']);
    expect(properties).toEqual({ requestId: 'REQ-31038', dispatch: 'directed' });
  });

  it('counts a reject once, the same way', async () => {
    await answerWith('REQ-31042', 'reject', 'broadcast');

    expect(events()).toEqual(['request_rejected']);
    expect(track.mock.calls[0][1]).toEqual({ requestId: 'REQ-31042', dispatch: 'broadcast' });
  });

  it('leaves the routing out, rather than guessing it, when the record did not say', async () => {
    await answerWith('REQ-30987', 'accept');

    expect(events()).toEqual(['request_accepted']);
    expect(Object.keys(track.mock.calls[0][1])).toEqual(['requestId']);
  });

  it('counts a lost race as request_accept_lost, by its reference alone, and not as an accept', async () => {
    accept.mockResolvedValueOnce({ outcome: 'refused', reason: 'taken' });

    await answerWith('REQ-31042', 'accept', 'broadcast');

    expect(events()).toEqual(['request_accept_lost']);
    const properties = track.mock.calls[0][1];
    expect(Object.keys(properties).sort()).toEqual(['requestId']);
    expect(properties).toEqual({ requestId: 'REQ-31042' });
  });

  it.each([
    [
      'an accept refused as already answered',
      'accept',
      () => accept.mockResolvedValueOnce({ outcome: 'refused', reason: 'notPending' }),
    ],
    [
      'a reject refused as already answered',
      'reject',
      () => reject.mockResolvedValueOnce({ outcome: 'refused', reason: 'notPending' }),
    ],
    [
      // Declining what somebody else took first is not losing a race to accept it.
      'a reject refused because another professional took it',
      'reject',
      () => reject.mockResolvedValueOnce({ outcome: 'refused', reason: 'taken' }),
    ],
    [
      'an accept for a request that is not this vendor’s',
      'accept',
      () => accept.mockRejectedValueOnce(new AppError({ kind: 'notFound', message: 'gone' })),
    ],
    [
      'a failed accept',
      'accept',
      () => accept.mockRejectedValueOnce(new AppError({ kind: 'network', message: 'socket hang up' })),
    ],
    [
      'a failed reject',
      'reject',
      () => reject.mockRejectedValueOnce(new AppError({ kind: 'server' })),
    ],
    [
      'an accept that threw something that was not an AppError',
      'accept',
      () => accept.mockRejectedValueOnce(new TypeError('boom')),
    ],
  ] as const)('counts nothing for %s', async (_what, which, arrange) => {
    arrange();

    await answerWith('REQ-31042', which, 'broadcast');

    expect(track).not.toHaveBeenCalled();
  });

  it('counts the retry that worked after a failure — once', async () => {
    accept.mockRejectedValueOnce(new AppError({ kind: 'network' }));

    await answerWith('REQ-31038', 'accept', 'directed');
    expect(track).not.toHaveBeenCalled();

    await answerWith('REQ-31038', 'accept', 'directed');
    expect(events()).toEqual(['request_accepted']);
  });

  it('counts one accept for five quick taps, and nothing before the service answers', async () => {
    const call = held<VendorRequestDecisionResult<'accepted'>>();
    accept.mockReturnValueOnce(call.promise);

    const outcomes: Array<Promise<VendorDecisionOutcome>> = [];
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        outcomes.push(decision.answer('REQ-31038', 'accept', 'directed'));
      }
    });
    expect(track).not.toHaveBeenCalled();

    await act(async () => {
      call.land({ outcome: 'accepted', request: RECORD });
    });
    await Promise.all(outcomes);

    expect(events()).toEqual(['request_accepted']);
  });

  it('counts started work by its reference alone — routing is the answer’s, not the work’s', async () => {
    await answerWith('REQ-30961', 'start', 'directed');

    expect(events()).toEqual(['work_started']);
    const properties = track.mock.calls[0][1];
    expect(Object.keys(properties).sort()).toEqual(['requestId']);
    expect(properties).toEqual({ requestId: 'REQ-30961' });
  });

  it('counts completed work with whether it was paid — never the amount, the method or the notes', async () => {
    await act(async () => {
      await decision.complete('REQ-30954', { ...COMPLETION, notes: 'Replaced the capacitor.' });
    });

    expect(events()).toEqual(['work_completed']);
    const properties = track.mock.calls[0][1];
    expect(Object.keys(properties).sort()).toEqual(['paymentStatus', 'requestId']);
    expect(properties).toEqual({ requestId: 'REQ-30954', paymentStatus: 'PAID' });

    const serialised = JSON.stringify(track.mock.calls);
    expect(serialised).not.toContain('125050');
    expect(serialised).not.toContain('INR');
    expect(serialised).not.toContain('upi');
    expect(serialised).not.toContain('capacitor');
  });

  it.each(['start', 'complete'] as const)(
    'counts nothing when the work had already moved on (%s)',
    async which => {
      (which === 'start' ? start : complete).mockResolvedValueOnce({
        outcome: 'refused',
        reason: 'invalidTransition',
      });

      await answer('REQ-30961', which);

      expect(track).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['start', () => start],
    ['complete', () => complete],
  ] as const)('counts nothing for a failed %s', async (which, mock) => {
    mock().mockRejectedValueOnce(new AppError({ kind: 'network' }));

    await answer('REQ-30961', which);

    expect(track).not.toHaveBeenCalled();
  });

  it('never carries anything about the customer or the job, whatever the record held', async () => {
    await answerWith('REQ-31038', 'accept', 'directed');
    await answerWith('REQ-31038', 'reject', 'directed');
    await answerWith('REQ-30961', 'start');
    await answer('REQ-30954', 'complete');

    expect(events()).toEqual([
      'request_accepted',
      'request_rejected',
      'work_started',
      'work_completed',
    ]);
    const serialised = JSON.stringify(track.mock.calls);
    expect(serialised).not.toContain(RECORD.customerName);
    expect(serialised).not.toContain(RECORD.serviceName);
    expect(serialised).not.toContain(RECORD.priority);
  });

  it('still answers, and says so, when analytics throws', async () => {
    registerService('analytics', {
      track: jest.fn(() => {
        throw new Error('provider exploded');
      }),
      identify: jest.fn(),
    });

    const outcome = await answerWith('REQ-31038', 'accept', 'directed');

    expect(outcome).toEqual({ kind: 'answered', decision: 'accept', request: RECORD });
    expect(toast()).toBe(COPY.accepted);
    expect(sync.revision).toBe(1);
  });
});
