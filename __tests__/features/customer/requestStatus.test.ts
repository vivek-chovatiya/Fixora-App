/**
 * The status model is a set of claims made to a customer about something the app
 * cannot see, so these tests pin the claims rather than the copy:
 *
 * - a stage is derived from section 21's status and the dispatch mode, and the
 *   same backend status reads differently for a chosen professional and for
 *   none — while nothing about a status the app does not know is guessed at
 * - every state has words, and those words come from one place
 * - nothing says a professional was notified, accepted, assigned or is on the
 *   way before the status says so
 * - the path never marks a step complete that has not happened, and a screen
 *   reader is told what is complete and current, not what is still to come
 */

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import {
  describeRequestStatus,
  hasAssignedProfessional,
  isCancellableState,
  presentRequestState,
  requestProgressOf,
  requestStateOf,
  type RequestLifecycleStage,
  type RequestStatusState,
} from '@/features/customer/constants/requestStatus';
import type { KnownRequestStatus } from '@/shared/services/types/RequestService';

const COPY = CUSTOMER_COPY.requestStatus;

const ALL_STATES: RequestStatusState[] = [
  'submitted',
  'searching',
  'awaiting_vendor',
  'awaiting_professional',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
  'rejected',
  'on_hold',
  'unknown',
];

const KNOWN_STATUSES: KnownRequestStatus[] = [
  'CREATED',
  'PENDING_VENDOR',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
  'REJECTED',
  'CANCELLED',
  'ON_HOLD',
];

describe('requestStateOf — reading section 21', () => {
  it('maps each section 21 status to the stage a customer understands', () => {
    expect(requestStateOf('CREATED', 'open')).toBe('submitted');
    expect(requestStateOf('ACCEPTED', 'open')).toBe('assigned');
    expect(requestStateOf('IN_PROGRESS', 'open')).toBe('in_progress');
    expect(requestStateOf('COMPLETED', 'open')).toBe('completed');
    expect(requestStateOf('CANCELLED', 'open')).toBe('cancelled');
    expect(requestStateOf('REJECTED', 'open')).toBe('rejected');
    expect(requestStateOf('ON_HOLD', 'open')).toBe('on_hold');
  });

  it('tells open dispatch from a chosen professional while nobody has taken it', () => {
    // One backend status, two different waits (section 20).
    expect(requestStateOf('PENDING_VENDOR', 'open')).toBe('searching');
    expect(requestStateOf('PENDING_VENDOR', 'directed')).toBe('awaiting_vendor');
  });

  it('says only "awaiting a professional" when it does not know which wait', () => {
    // A request card is drawn from a summary with no dispatch mode on it.
    expect(requestStateOf('PENDING_VENDOR')).toBe('awaiting_professional');
  });

  it('stops caring about dispatch once somebody has the job', () => {
    for (const status of ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] as const) {
      expect(requestStateOf(status, 'open')).toBe(requestStateOf(status, 'directed'));
    }
  });

  it('treats a closed request as a finished one', () => {
    expect(requestStateOf('CLOSED', 'directed')).toBe('completed');
  });

  it('recognises every status section 21 names', () => {
    for (const status of KNOWN_STATUSES) {
      for (const dispatch of ['open', 'directed'] as const) {
        expect(requestStateOf(status, dispatch)).not.toBe('unknown');
      }
    }
  });

  it('never guesses at a status it does not know — least of all as completed', () => {
    for (const status of ['AWAITING_PARTS', 'COMPLETE', 'DONE', '', 'accepted_by_vendor']) {
      expect(requestStateOf(status, 'open')).toBe('unknown');
    }
  });

  it('is not thrown by the backend changing its mind about case or padding', () => {
    expect(requestStateOf(' in_progress ', 'open')).toBe('in_progress');
    expect(requestStateOf('pending_vendor', 'open')).toBe('searching');
  });

  it('survives a value that is not a string at all', () => {
    expect(requestStateOf(undefined as never, 'open')).toBe('unknown');
  });
});

describe('presentRequestState — what the customer is told', () => {
  it('gives every state a label, a heading, a sentence and a glyph', () => {
    for (const state of ALL_STATES) {
      const presentation = presentRequestState(state);

      expect(presentation.state).toBe(state);
      expect(presentation.label.trim().length).toBeGreaterThan(0);
      expect(presentation.title.trim().length).toBeGreaterThan(0);
      expect(presentation.description.trim().length).toBeGreaterThan(0);
      expect(presentation.icon.length).toBeGreaterThan(0);
    }
  });

  it('takes its words from the copy file and nowhere else', () => {
    for (const state of ALL_STATES) {
      const presentation = presentRequestState(state);

      expect(presentation.label).toBe(COPY[state].label);
      expect(presentation.title).toBe(COPY[state].title);
      expect(presentation.description).toBe(COPY[state].description);
    }
  });

  it('shows no raw backend constant', () => {
    for (const state of ALL_STATES) {
      const { label, title } = presentRequestState(state);

      for (const status of KNOWN_STATUSES) {
        expect(label).not.toBe(status);
        expect(title).not.toContain(status);
      }
    }
  });

  it('never claims a notification, travel or an arrival time', () => {
    for (const state of ALL_STATES) {
      const { title, description } = presentRequestState(state);

      expect(`${title} ${description}`).not.toMatch(
        /notif|alert|on (the|their|its) way|travel|arriv|minutes|\beta\b/i,
      );
    }
  });

  it('never says anyone accepted or was assigned before the status does', () => {
    const beforeAssignment: RequestStatusState[] = [
      'submitted',
      'searching',
      'awaiting_vendor',
      'awaiting_professional',
      'on_hold',
      'cancelled',
      'unknown',
    ];

    for (const state of beforeAssignment) {
      const { label, title, description } = presentRequestState(state);

      expect(`${label} ${title} ${description}`).not.toMatch(/assigned|accepted/i);
    }
  });

  it('presents an unknown state calmly, as unavailable rather than as anything', () => {
    const unknown = presentRequestState('unknown');

    expect(unknown.title).toBe(COPY.unknown.title);
    expect(unknown.tone).toBe('neutral');
  });

  it('keeps success for the one state that has earned it', () => {
    const succeeding = ALL_STATES.filter(state => presentRequestState(state).tone === 'success');

    expect(succeeding).toEqual(['completed']);
  });

  it('falls back to unavailable for a state outside the table', () => {
    expect(presentRequestState('teleporting' as never).state).toBe('unknown');
  });
});

describe('requestProgressOf — the path, as far as it goes', () => {
  const progress = (state: RequestStatusState, dispatch: 'open' | 'directed') =>
    requestProgressOf(state, dispatch)?.map(step => [step.stage, step.progress]);

  it('marks submitted complete and searching current for open dispatch', () => {
    expect(progress('searching', 'open')).toEqual([
      ['submitted', 'complete'],
      ['searching', 'current'],
      ['assigned', 'upcoming'],
      ['in_progress', 'upcoming'],
      ['completed', 'upcoming'],
    ]);
  });

  it('words the wait for the professional the customer chose', () => {
    expect(progress('awaiting_vendor', 'directed')).toEqual([
      ['submitted', 'complete'],
      ['awaiting_vendor', 'current'],
      ['assigned', 'upcoming'],
      ['in_progress', 'upcoming'],
      ['completed', 'upcoming'],
    ]);
  });

  it('keeps the dispatch mode in the path after the wait is over', () => {
    expect(progress('assigned', 'directed')?.[1]).toEqual(['awaiting_vendor', 'complete']);
    expect(progress('assigned', 'open')?.[1]).toEqual(['searching', 'complete']);
  });

  it('shows a new request with everything after submission still to come', () => {
    expect(progress('submitted', 'open')).toEqual([
      ['submitted', 'current'],
      ['searching', 'upcoming'],
      ['assigned', 'upcoming'],
      ['in_progress', 'upcoming'],
      ['completed', 'upcoming'],
    ]);
  });

  it('marks a finished request finished, with nothing left current', () => {
    const steps = requestProgressOf('completed', 'open') ?? [];

    expect(steps).toHaveLength(5);
    expect(steps.every(step => step.progress === 'complete')).toBe(true);
  });

  it('never marks a step complete that comes after the current one', () => {
    const onPath: RequestLifecycleStage[] = [
      'submitted',
      'searching',
      'awaiting_vendor',
      'assigned',
      'in_progress',
    ];

    for (const state of onPath) {
      const steps = requestProgressOf(state, state === 'awaiting_vendor' ? 'directed' : 'open') ?? [];
      const current = steps.findIndex(step => step.progress === 'current');

      expect(current).toBeGreaterThanOrEqual(0);
      expect(steps.slice(current + 1).every(step => step.progress === 'upcoming')).toBe(true);
      expect(steps.slice(0, current).every(step => step.progress === 'complete')).toBe(true);
    }
  });

  it('draws no path for a state that is not on it', () => {
    for (const state of ['cancelled', 'rejected', 'on_hold', 'unknown', 'awaiting_professional'] as const) {
      expect(requestProgressOf(state, 'open')).toBeNull();
    }
  });

  it('names each step with the same heading its state uses', () => {
    for (const step of requestProgressOf('in_progress', 'directed') ?? []) {
      expect(step.title).toBe(COPY[step.stage].title);
    }
  });
});

describe('describeRequestStatus — what a screen reader hears', () => {
  it('says the state, what it means, and what is complete and current', () => {
    const presentation = presentRequestState('searching');

    expect(describeRequestStatus(presentation, requestProgressOf('searching', 'open'))).toBe(
      'Request status: Searching for a professional. ' +
        'We are looking for an available professional for your request. ' +
        'Request submitted is complete. ' +
        'Searching for a professional is current.',
    );
  });

  it('does not read out steps that have not happened', () => {
    const summary = describeRequestStatus(
      presentRequestState('awaiting_vendor'),
      requestProgressOf('awaiting_vendor', 'directed'),
    );

    expect(summary).not.toContain(COPY.assigned.title);
    expect(summary).not.toContain(COPY.completed.title);
  });

  it('says only the state and its meaning when there is no path', () => {
    const presentation = presentRequestState('unknown');

    expect(describeRequestStatus(presentation, null)).toBe(
      `${COPY.summaryPrefix}: ${COPY.unknown.title}. ${COPY.unknown.description}`,
    );
  });
});

describe('hasAssignedProfessional', () => {
  it('is true only once the status says somebody has the job', () => {
    const assigned = ALL_STATES.filter(hasAssignedProfessional);

    expect(assigned).toEqual(['assigned', 'in_progress', 'completed']);
  });
});

/**
 * The owner's rule of 21/10/2026: a customer may cancel only while no
 * professional has accepted the request.
 */
describe('isCancellableState', () => {
  it('is true only before anybody has accepted the request', () => {
    const cancellable = ALL_STATES.filter(isCancellableState);

    expect(cancellable).toEqual(['submitted', 'searching', 'awaiting_vendor', 'awaiting_professional']);
  });

  it('never overlaps a state where somebody has the job', () => {
    for (const state of ALL_STATES) {
      expect(isCancellableState(state) && hasAssignedProfessional(state)).toBe(false);
    }
  });

  it('allows section 21’s waiting statuses through every dispatch mode, and nothing else', () => {
    const statuses: KnownRequestStatus[] = [
      'CREATED',
      'PENDING_VENDOR',
      'ACCEPTED',
      'IN_PROGRESS',
      'COMPLETED',
      'CLOSED',
      'REJECTED',
      'CANCELLED',
      'ON_HOLD',
    ];

    for (const dispatch of ['open', 'directed', undefined] as const) {
      const allowed = statuses.filter(status => isCancellableState(requestStateOf(status, dispatch)));

      expect(allowed).toEqual(['CREATED', 'PENDING_VENDOR']);
    }
  });

  it('fails closed for a status section 21 does not name', () => {
    expect(isCancellableState(requestStateOf('ESCALATED_TO_REGION', 'open'))).toBe(false);
    expect(isCancellableState(requestStateOf('', 'directed'))).toBe(false);
  });
});
