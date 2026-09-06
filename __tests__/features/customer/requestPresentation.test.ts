/**
 * The presentation layer's only real responsibility is to survive a backend it
 * does not fully know.
 *
 * PROJECT_BIBLE.md section 21 says the frontend must never invent a status, so
 * these tests care much less about the copy chosen for the states we do know
 * than about what happens to a state we do not: it must render, it must not
 * claim a tone it has not earned, and it must never be blank.
 */

import {
  formatRequestDate,
  humaniseToken,
  presentPriority,
  presentStatus,
} from '@/features/customer/constants/requestPresentation';

describe('presentStatus', () => {
  it('gives every roadmap status a word and a glyph, not only a tone', () => {
    const statuses = [
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

    for (const status of statuses) {
      const presented = presentStatus(status);

      expect(presented.label.length).toBeGreaterThan(0);
      // Never the raw constant: a customer should not be shown a database value.
      expect(presented.label).not.toBe(status);
      expect(presented.icon.length).toBeGreaterThan(0);
    }
  });

  it('renders a status it has never heard of instead of failing', () => {
    const presented = presentStatus('AWAITING_PARTS');

    expect(presented.label).toBe('Awaiting parts');
    // Neutral, because an unknown state has not earned alarm or reassurance.
    expect(presented.tone).toBe('neutral');
  });

  it('is not thrown by the backend changing its mind about case or padding', () => {
    expect(presentStatus(' in_progress ').label).toBe(presentStatus('IN_PROGRESS').label);
  });
});

describe('presentPriority', () => {
  it('uses the human labels the roadmap asks for', () => {
    expect(presentPriority('LOW').label).toBe('Low');
    expect(presentPriority('MEDIUM').label).toBe('Medium');
    expect(presentPriority('HIGH').label).toBe('High');
    expect(presentPriority('EMERGENCY').label).toBe('Emergency');
  });

  it('escalates the tone with the priority', () => {
    expect(presentPriority('LOW').tone).toBe('neutral');
    expect(presentPriority('EMERGENCY').tone).toBe('danger');
  });
});

describe('humaniseToken', () => {
  it('tidies a constant without pretending to translate it', () => {
    expect(humaniseToken('ON_HOLD')).toBe('On hold');
    expect(humaniseToken('closed')).toBe('Closed');
    expect(humaniseToken('')).toBe('');
  });
});

describe('formatRequestDate', () => {
  const now = new Date('2026-08-31T12:00:00.000Z');
  const ago = (minutes: number) =>
    new Date(now.getTime() - minutes * 60_000).toISOString();

  it('reads as relative while relative is the more useful answer', () => {
    expect(formatRequestDate(ago(0), now)).toBe('Just now');
    expect(formatRequestDate(ago(20), now)).toBe('20 min ago');
    expect(formatRequestDate(ago(3 * 60), now)).toBe('3 hr ago');
    expect(formatRequestDate(ago(24 * 60), now)).toBe('1 day ago');
    expect(formatRequestDate(ago(3 * 24 * 60), now)).toBe('3 days ago');
  });

  it('falls back to a date once "eleven days ago" has stopped meaning anything', () => {
    const older = formatRequestDate(ago(20 * 24 * 60), now);

    expect(older).not.toContain('ago');
    expect(older.length).toBeGreaterThan(0);
  });

  it('treats a clock running slightly fast as now, not as the future', () => {
    const ahead = new Date(now.getTime() + 60_000).toISOString();

    expect(formatRequestDate(ahead, now)).toBe('Just now');
  });

  it('says nothing rather than inventing a date it cannot read', () => {
    expect(formatRequestDate('not-a-date', now)).toBe('');
  });
});
