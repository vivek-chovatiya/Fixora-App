/**
 * What a backend status says on a vendor's card (PROJECT_BIBLE.md sections 21
 * and 31.1), and the dashboard's greeting.
 *
 * Pinned: a waiting request is named by how it arrived; work under way and
 * finished work read as themselves; a status the app has never seen reads
 * "Status unavailable" — never hidden, never guessed at, and never the raw value.
 */

import {
  holdsWork,
  isAwaitingAnswer,
  isFinishedWork,
  nextWorkStep,
  presentJobStatus,
} from '@/features/vendor/constants/jobPresentation';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { vendorGreetingFor } from '@/features/vendor/hooks/useVendorDashboard';

const COPY = VENDOR_COPY.job;

describe('presentJobStatus', () => {
  it('names a waiting request by how it reached the vendor', () => {
    expect(presentJobStatus({ status: 'PENDING_VENDOR', dispatch: 'directed' }).label).toBe(
      COPY.statusDirected,
    );
    expect(presentJobStatus({ status: 'PENDING_VENDOR', dispatch: 'broadcast' }).label).toBe(
      COPY.statusBroadcast,
    );
  });

  it('calls it new when the backend does not say how it arrived', () => {
    expect(presentJobStatus({ status: 'PENDING_VENDOR' }).label).toBe(COPY.statusNew);
  });

  it('emphasises a direct request over an open one', () => {
    expect(presentJobStatus({ status: 'PENDING_VENDOR', dispatch: 'directed' }).tone).toBe('info');
    expect(presentJobStatus({ status: 'PENDING_VENDOR', dispatch: 'broadcast' }).tone).toBe(
      'neutral',
    );
  });

  it('tells accepted work from work in progress', () => {
    expect(presentJobStatus({ status: 'ACCEPTED' }).label).toBe(COPY.statusAccepted);
    expect(presentJobStatus({ status: 'IN_PROGRESS' }).label).toBe(COPY.statusInProgress);
  });

  it.each(['COMPLETED', 'CLOSED'])('reads %s as completed, the only state that earns success', status => {
    expect(presentJobStatus({ status })).toMatchObject({
      label: COPY.statusCompleted,
      tone: 'success',
    });
  });

  it('forgives case and padding', () => {
    expect(presentJobStatus({ status: '  in_progress ' }).label).toBe(COPY.statusInProgress);
  });

  it('says a status it has never seen is unavailable, and never draws the raw value', () => {
    const shown = presentJobStatus({ status: 'AWAITING_PARTS' });

    expect(shown).toMatchObject({ label: COPY.statusUnknown, tone: 'neutral' });
    expect(shown.label.toLowerCase()).not.toContain('awaiting');
  });

  it('says so when the status is blank rather than inventing one', () => {
    expect(presentJobStatus({ status: '' }).label).toBe(COPY.statusUnknown);
  });

  it('always gives a glyph, so no state is carried by colour alone', () => {
    for (const status of ['PENDING_VENDOR', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'ODD']) {
      expect(presentJobStatus({ status }).icon).toBeTruthy();
    }
  });

  it('says a rejected request is rejected, in a word and a glyph, not in an alarm colour (3E-4)', () => {
    expect(presentJobStatus({ status: 'REJECTED' })).toEqual({
      label: VENDOR_COPY.job.statusRejected,
      tone: 'neutral',
      icon: 'reject',
    });
  });
});

describe('isAwaitingAnswer', () => {
  it.each(['PENDING_VENDOR', 'CREATED', ' pending_vendor '])('offers an answer for %p', status => {
    expect(isAwaitingAnswer({ status })).toBe(true);
  });

  it.each(['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'REJECTED', 'CANCELLED', 'ON_HOLD', 'AWAITING_PARTS', ''])(
    'never offers one for %p — including a status it does not recognise',
    status => {
      expect(isAwaitingAnswer({ status })).toBe(false);
    },
  );
});

describe('nextWorkStep (3E-5)', () => {
  it('offers Start on accepted work and Complete on work in progress — forgiving case and padding', () => {
    expect(nextWorkStep({ status: 'ACCEPTED' })).toBe('start');
    expect(nextWorkStep({ status: ' accepted ' })).toBe('start');
    expect(nextWorkStep({ status: 'IN_PROGRESS' })).toBe('complete');
  });

  it.each(['PENDING_VENDOR', 'CREATED', 'COMPLETED', 'CLOSED', 'REJECTED', 'CANCELLED', 'ON_HOLD', 'AWAITING_PARTS', ''])(
    'offers no step for %p — including a status it does not recognise',
    status => {
      expect(nextWorkStep({ status })).toBeNull();
    },
  );
});

describe('isFinishedWork (the offline payment record)', () => {
  it.each(['COMPLETED', 'CLOSED', ' completed '])('is finished for %p — what "Completed" covers', status => {
    expect(isFinishedWork({ status })).toBe(true);
    expect(presentJobStatus({ status }).label).toBe(VENDOR_COPY.job.statusCompleted);
  });

  it.each(['PENDING_VENDOR', 'ACCEPTED', 'IN_PROGRESS', 'REJECTED', 'AWAITING_PARTS', ''])(
    'is not finished for %p, so no payment is shown on it',
    status => {
      expect(isFinishedWork({ status })).toBe(false);
    },
  );
});

describe('vendorGreetingFor', () => {
  const at = (hour: number) => new Date(2026, 8, 30, hour, 0, 0);

  it.each([
    [0, VENDOR_COPY.dashboard.greetingMorning],
    [11, VENDOR_COPY.dashboard.greetingMorning],
    [12, VENDOR_COPY.dashboard.greetingAfternoon],
    [16, VENDOR_COPY.dashboard.greetingAfternoon],
    [17, VENDOR_COPY.dashboard.greetingEvening],
    [23, VENDOR_COPY.dashboard.greetingEvening],
  ])('greets at %i:00 with "%s"', (hour, greeting) => {
    expect(vendorGreetingFor(at(hour))).toBe(greeting);
  });
});

/*
  Whether a request's details may show who the customer is and exactly where
  (owner decision, 21/10/2026): only once the vendor holds the work. Anything
  the app cannot read shows the less.
*/
describe('holdsWork (who and where, only for work the vendor holds)', () => {
  it.each(['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', ' in_progress '])(
    'holds the work for %p',
    status => {
      expect(holdsWork({ status })).toBe(true);
    },
  );

  it.each(['CREATED', 'PENDING_VENDOR', 'REJECTED', 'AWAITING_PARTS', ''])(
    'does not hold the work for %p, so nothing of the customer is shown',
    status => {
      expect(holdsWork({ status })).toBe(false);
    },
  );
});
