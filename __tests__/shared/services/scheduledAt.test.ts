/**
 * The preferred date and time become one `scheduledAt` timestamp in India time
 * and come back as the same two answers. Pinned: the offset is written into
 * the value (never the phone's own zone), midnight means "a day, no time",
 * a time with no day is not sent, and a malformed answer is refused by field —
 * never quoted.
 */

import { fromScheduledAt, toScheduledAt } from '@/shared/services/api/scheduledAt';
import { AppError } from '@/shared/types/error';

describe('toScheduledAt', () => {
  it('writes the date and time as India time, offset and all', () => {
    expect(toScheduledAt('2026-11-20', '09:00')).toBe('2026-11-20T09:00:00+05:30');
    expect(Date.parse(toScheduledAt('2026-11-20', '09:00') as string)).toBe(Date.UTC(2026, 10, 20, 3, 30));
  });

  it('sends a day with no time as that day’s midnight', () => {
    expect(toScheduledAt('2026-11-20')).toBe('2026-11-20T00:00:00+05:30');
  });

  it.each([
    ['a time with no day', undefined, '09:00'],
    ['no preference', undefined, undefined],
  ])('sends nothing for %s', (_case, date, time) => {
    expect(toScheduledAt(date, time)).toBeUndefined();
  });

  it.each([
    ['a date that is not a day', '2026-02-30', undefined],
    ['a formatted date', '20/11/2026', undefined],
    ['a time past the day', '2026-11-20', '24:00'],
    ['a formatted time', '2026-11-20', '9:00 AM'],
  ])('refuses %s, naming the field and not the value', (_case, date, time) => {
    let caught: unknown;
    try {
      toScheduledAt(date, time);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).kind).toBe('validation');
    expect(JSON.stringify({ ...(caught as AppError), message: (caught as AppError).message })).not.toContain(
      String(time ?? date),
    );
  });
});

describe('fromScheduledAt', () => {
  it('reads a stored instant back on India’s clock', () => {
    expect(fromScheduledAt('2026-11-20T03:30:00.000Z')).toEqual({ preferredDate: '2026-11-20', preferredTime: '09:00' });
  });

  it('reads the instant that crosses midnight in UTC as the right Indian day', () => {
    // 20:00 on the 20th in India is 14:30 UTC the same day; 21:30 UTC is 03:00 the next day.
    expect(fromScheduledAt('2026-11-20T21:30:00.000Z')).toEqual({ preferredDate: '2026-11-21', preferredTime: '03:00' });
  });

  it('reads midnight as a day with no time', () => {
    expect(fromScheduledAt('2026-11-19T18:30:00.000Z')).toEqual({ preferredDate: '2026-11-20' });
  });

  it('round-trips every hour the app offers', () => {
    for (let hour = 7; hour <= 20; hour += 1) {
      const time = `${String(hour).padStart(2, '0')}:00`;
      expect(fromScheduledAt(new Date(toScheduledAt('2026-11-20', time) as string).toISOString())).toEqual({
        preferredDate: '2026-11-20',
        preferredTime: time,
      });
    }
  });

  it.each([
    ['null', null],
    ['blank', ''],
    ['unreadable', 'next Tuesday'],
    ['a number', 1763609400000],
  ])('reads %s as no preference', (_case, value) => {
    expect(fromScheduledAt(value)).toEqual({});
  });
});
