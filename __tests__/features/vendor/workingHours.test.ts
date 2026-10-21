/**
 * Working hours, as words and as a form (PROJECT_BIBLE.md section 38,
 * "Working Hours").
 *
 * The class of mistake guarded against: a week that reads as something it is
 * not, or a form that sends something the vendor did not choose.
 *
 * - only neighbouring days with the same hours share a summary line, so a line
 *   never claims a day it does not hold; spoken lines use the days in full and
 *   "to" for every dash
 * - a day code the app does not know is shown tidied, never dropped, never a
 *   crash; an open day without times says "Open" rather than inventing hours
 * - the form always edits the seven known days in order, from whatever the
 *   profile holds; a missing day opens closed, a missing or malformed time
 *   starts at nine to seven
 * - the times offered are every half hour of the day, with a time of the
 *   day's own kept as one of them
 * - one rule — an open day closes after it opens — and the week sent carries
 *   times on open days only, so hidden times are never an unsaved change
 * - "Copy Monday to all weekdays" fills Tuesday to Friday and leaves the
 *   weekend alone
 *
 * Times are compared with the shared formatter's own answer, never a literal
 * "9:00 AM": the reader's clock decides the format.
 */

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import {
  presentDay,
  presentHours,
  summariseWorkingHours,
} from '@/features/vendor/constants/workingHoursPresentation';
import {
  DRAFT_CLOSES_AT,
  DRAFT_OPENS_AT,
  buildWorkingHours,
  copyMondayToWeekdays,
  dayProblem,
  draftWeek,
  sameWorkingHours,
  workingTimeOptions,
  type WorkingDayDraft,
} from '@/features/vendor/validation/workingHoursForm';
import { formatTimeValue } from '@/shared/presentation/clockTime';
import type { VendorWorkingDay } from '@/shared/services/types/VendorProfileService';

const COPY = VENDOR_COPY.workingHours;

const open = (day: string, opensAt: string, closesAt: string): VendorWorkingDay => ({
  day,
  isOpen: true,
  opensAt,
  closesAt,
});
const closed = (day: string): VendorWorkingDay => ({ day, isOpen: false });

const DEFAULT_WEEK: VendorWorkingDay[] = [
  open('MON', '09:00', '19:00'),
  open('TUE', '09:00', '19:00'),
  open('WED', '09:00', '19:00'),
  open('THU', '09:00', '19:00'),
  open('FRI', '09:00', '19:00'),
  open('SAT', '09:00', '19:00'),
  closed('SUN'),
];

const NINE = formatTimeValue('09:00');
const SEVEN = formatTimeValue('19:00');

describe('Working hours — the summary', () => {
  it('joins neighbouring days alike: "Mon–Sat 9:00 AM – 7:00 PM", "Sun Closed"', () => {
    const lines = summariseWorkingHours(DEFAULT_WEEK);

    expect(lines.map(({ days, hours }) => [days, hours])).toEqual([
      ['Mon–Sat', COPY.hours(NINE, SEVEN)],
      ['Sun', COPY.closed],
    ]);
  });

  it('speaks each line in full words, with "to" for every dash', () => {
    const lines = summariseWorkingHours(DEFAULT_WEEK);

    expect(lines.map(line => line.spoken)).toEqual([
      `Monday to Saturday, ${NINE} to ${SEVEN}`,
      'Sunday, closed',
    ]);
    expect(lines.map(line => line.spoken).join(' ')).not.toContain('–');
  });

  it('never joins days alike that are not neighbours — a dash would claim the day between', () => {
    const lines = summariseWorkingHours([
      open('MON', '09:00', '19:00'),
      closed('TUE'),
      open('WED', '09:00', '19:00'),
      open('THU', '09:00', '19:00'),
      open('FRI', '09:00', '19:00'),
      open('SAT', '10:00', '14:00'),
      closed('SUN'),
    ]);

    expect(lines.map(line => line.days)).toEqual(['Mon', 'Tue', 'Wed–Fri', 'Sat', 'Sun']);
  });

  it('is one line for a week all alike', () => {
    const lines = summariseWorkingHours(DEFAULT_WEEK.map(day => closed(day.day)));

    expect(lines).toHaveLength(1);
    expect(lines[0].days).toBe('Mon–Sun');
    expect(lines[0].spoken).toBe('Monday to Sunday, closed');
  });

  it('gives every line its own key', () => {
    const lines = summariseWorkingHours([
      open('MON', '09:00', '19:00'),
      closed('TUE'),
      open('WED', '09:00', '19:00'),
    ]);

    expect(new Set(lines.map(line => line.key)).size).toBe(3);
  });

  it('is nothing for something that is not a list, and skips a hole in one', () => {
    expect(summariseWorkingHours(undefined)).toEqual([]);
    expect(summariseWorkingHours('Mon–Sat' as unknown as VendorWorkingDay[])).toEqual([]);
    expect(
      summariseWorkingHours([null, closed('SUN')] as unknown as VendorWorkingDay[]).map(line => line.days),
    ).toEqual(['Sun']);
  });

  it('says "Open" for an open day sent without its times, rather than inventing them', () => {
    expect(presentHours({ day: 'MON', isOpen: true })).toEqual({
      text: COPY.open,
      spoken: COPY.openSpoken,
    });
    expect(presentHours({ day: 'MON', isOpen: true, opensAt: '09:00' }).text).toBe(COPY.open);
  });
});

describe('Working hours — naming a day', () => {
  it('names the seven days it knows, short and in full', () => {
    expect(presentDay('MON')).toEqual({ short: 'Mon', long: 'Monday' });
    expect(presentDay('SUN')).toEqual({ short: 'Sun', long: 'Sunday' });
  });

  it('shows a day it does not know tidied — never dropped, never a crash', () => {
    expect(presentDay('PUBLIC_HOLIDAY')).toEqual({ short: 'Public holiday', long: 'Public holiday' });
    expect(presentDay('')).toEqual({ short: COPY.unknownDay, long: COPY.unknownDay });
    expect(presentDay(undefined as unknown as string)).toEqual({
      short: COPY.unknownDay,
      long: COPY.unknownDay,
    });
  });

  it('draws an unknown day in the summary as itself', () => {
    const [line] = summariseWorkingHours([closed('PUBLIC_HOLIDAY')]);

    expect(line.days).toBe('Public holiday');
  });
});

describe('Working hours — the form opens on', () => {
  it('the profile’s week, day by day', () => {
    expect(draftWeek(DEFAULT_WEEK)).toEqual([
      { day: 'MON', isOpen: true, opensAt: '09:00', closesAt: '19:00' },
      { day: 'TUE', isOpen: true, opensAt: '09:00', closesAt: '19:00' },
      { day: 'WED', isOpen: true, opensAt: '09:00', closesAt: '19:00' },
      { day: 'THU', isOpen: true, opensAt: '09:00', closesAt: '19:00' },
      { day: 'FRI', isOpen: true, opensAt: '09:00', closesAt: '19:00' },
      { day: 'SAT', isOpen: true, opensAt: '09:00', closesAt: '19:00' },
      // Times to reopen with: the week sent leaves them off (below).
      { day: 'SUN', isOpen: false, opensAt: DRAFT_OPENS_AT, closesAt: DRAFT_CLOSES_AT },
    ]);
  });

  it('the seven known days in order, whatever order and gaps the profile has', () => {
    const drafts = draftWeek([closed('SUN'), open('WED', '10:00', '16:00'), closed('HOLIDAY')]);

    expect(drafts.map(day => day.day)).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
    expect(drafts[2]).toEqual({ day: 'WED', isOpen: true, opensAt: '10:00', closesAt: '16:00' });
    // Missing from the profile: closed, not invented as open.
    expect(drafts[0].isOpen).toBe(false);
  });

  it('nine to seven for a time missing or not in the contract’s form', () => {
    const drafts = draftWeek([
      { day: 'MON', isOpen: true },
      open('TUE', '9am', '18:00'),
    ] as VendorWorkingDay[]);

    expect(drafts[0]).toMatchObject({ isOpen: true, opensAt: '09:00', closesAt: '19:00' });
    expect(drafts[1]).toMatchObject({ isOpen: true, opensAt: '09:00', closesAt: '18:00' });
  });

  it('the seven days closed when the profile has no week at all', () => {
    for (const stored of [undefined, [], 'week' as unknown as VendorWorkingDay[]]) {
      const drafts = draftWeek(stored);
      expect(drafts).toHaveLength(7);
      expect(drafts.every(day => !day.isOpen)).toBe(true);
    }
  });
});

describe('Working hours — the times offered', () => {
  it('every half hour from midnight to half past eleven at night', () => {
    const times = workingTimeOptions();

    expect(times).toHaveLength(48);
    expect(times.slice(0, 3)).toEqual(['00:00', '00:30', '01:00']);
    expect(times.slice(-2)).toEqual(['23:00', '23:30']);
    expect(times).toContain('09:00');
    expect(times).toContain('19:00');
  });

  it('keeps a day’s own time off the half hour as one of the choices, in its place', () => {
    const times = workingTimeOptions('09:15');

    expect(times).toHaveLength(49);
    expect(times.slice(times.indexOf('09:00'), times.indexOf('09:00') + 3)).toEqual([
      '09:00',
      '09:15',
      '09:30',
    ]);
  });

  it('adds nothing for a time already offered, or one not in the contract’s form', () => {
    expect(workingTimeOptions('09:30')).toHaveLength(48);
    expect(workingTimeOptions('9:15')).toHaveLength(48);
  });
});

describe('Working hours — the rule and the week sent', () => {
  const monday = (change: Partial<WorkingDayDraft>): WorkingDayDraft => ({
    day: 'MON',
    isOpen: true,
    opensAt: '09:00',
    closesAt: '19:00',
    ...change,
  });

  it('an open day must close after it opens — at or before is refused', () => {
    expect(dayProblem(monday({}))).toBeNull();
    expect(dayProblem(monday({ closesAt: '09:00' }))).toBe(COPY.closesBeforeOpens);
    expect(dayProblem(monday({ opensAt: '20:00' }))).toBe(COPY.closesBeforeOpens);
    // Text order is time order only because the times are zero-padded.
    expect(dayProblem(monday({ opensAt: '09:30', closesAt: '10:00' }))).toBeNull();
  });

  it('a closed day is never wrong, whatever times it is holding', () => {
    expect(dayProblem(monday({ isOpen: false, opensAt: '20:00', closesAt: '08:00' }))).toBeNull();
  });

  it('sends times on an open day and none at all on a closed one', () => {
    const sent = buildWorkingHours(draftWeek(DEFAULT_WEEK));

    expect(sent).toEqual(DEFAULT_WEEK);
    expect(Object.keys(sent[0]).sort()).toEqual(['closesAt', 'day', 'isOpen', 'opensAt']);
    expect(Object.keys(sent[6]).sort()).toEqual(['day', 'isOpen']);
  });

  it('never counts times hidden behind a closed day as a change', () => {
    const before = draftWeek(DEFAULT_WEEK);
    const after = before.map(day =>
      day.day === 'SUN' ? { ...day, opensAt: '06:00', closesAt: '22:00' } : day,
    );

    expect(sameWorkingHours(before, after)).toBe(true);
    const reopened = after.map(day => (day.day === 'SUN' ? { ...day, isOpen: true } : day));
    expect(sameWorkingHours(before, reopened)).toBe(false);
  });
});

describe('Working hours — copying Monday', () => {
  it('gives Tuesday to Friday Monday’s hours and leaves the weekend alone', () => {
    const week = draftWeek([
      open('MON', '08:00', '17:30'),
      closed('TUE'),
      open('WED', '10:00', '12:00'),
      open('THU', '09:00', '19:00'),
      open('FRI', '09:00', '19:00'),
      open('SAT', '10:00', '14:00'),
      closed('SUN'),
    ]);

    const copied = buildWorkingHours(copyMondayToWeekdays(week));

    expect(copied).toEqual([
      open('MON', '08:00', '17:30'),
      open('TUE', '08:00', '17:30'),
      open('WED', '08:00', '17:30'),
      open('THU', '08:00', '17:30'),
      open('FRI', '08:00', '17:30'),
      open('SAT', '10:00', '14:00'),
      closed('SUN'),
    ]);
  });

  it('copies a closed Monday as closed', () => {
    const week = draftWeek(DEFAULT_WEEK).map(day => (day.day === 'MON' ? { ...day, isOpen: false } : day));

    const copied = copyMondayToWeekdays(week);

    expect(copied.slice(0, 5).every(day => !day.isOpen)).toBe(true);
    expect(copied[5].isOpen).toBe(true);
  });
});
