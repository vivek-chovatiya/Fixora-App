/**
 * Working hours form
 *
 * The week as the Working hours screen edits it, its one rule, and the week
 * the service is sent (PROJECT_BIBLE.md section 38, "Working Hours").
 *
 * ⚠️ The draft keeps a closed day's times; the week sent does not. Closing a
 * day and opening it again gives back the hours it had, which is what someone
 * flicking a switch by mistake expects — but the contract says a closed day has
 * no times, so `buildWorkingHours` leaves them out. Whether there is anything
 * to save is asked of the week that would be sent (`sameWorkingHours`), so
 * times hidden behind a closed day are never an unsaved change.
 *
 * ⚠️ One rule, the service's said to a person: an open day closes after it
 * opens, on the same day (`dayProblem`). The times can only be chosen from a
 * list in the contract's `HH:mm` form, so their format needs no check here;
 * the service checks it again anyway, and its own rules are the authority.
 *
 * Not react-hook-form and zod, unlike the other vendor forms: nothing is typed,
 * every value is a choice from a list, and the one rule spans two fields of one
 * day. A week of plain values and a function per rule says it more plainly
 * than a schema would.
 */

import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import {
  VENDOR_WORKING_DAYS,
  VENDOR_WORKING_TIME_FORMAT,
  type VendorWorkingDay,
} from '@/shared/services/types/VendorProfileService';

const COPY = VENDOR_COPY.workingHours;

/**
 * Where a day starts when it has no times of its own and is opened: nine to
 * seven, the same week a new vendor is given. A starting point to change, not
 * a rule.
 */
export const DRAFT_OPENS_AT = '09:00';
export const DRAFT_CLOSES_AT = '19:00';

/**
 * The gap between the times offered. Half an hour is as precise as a working
 * day is usually stated, and keeps the list to forty-eight choices.
 */
export const WORKING_TIME_STEP_MINUTES = 30;

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/** "Copy Monday to all weekdays" copies from this day to these. */
const MONDAY = 'MON';
const REST_OF_WORKING_WEEK: readonly string[] = ['TUE', 'WED', 'THU', 'FRI'];

/** One day on the screen. Both times always held, so reopening a day restores them. */
export interface WorkingDayDraft {
  day: string;
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
}

function isWorkingTime(value: unknown): value is string {
  return typeof value === 'string' && VENDOR_WORKING_TIME_FORMAT.test(value);
}

/**
 * The week the screen opens on: the seven days the app knows, in order, each
 * as the profile has it.
 *
 * Taken day by day rather than as the list came, so the screen always edits —
 * and always sends — the seven days the contract asks for. A day the profile
 * does not have opens closed, and a time it does not have, or has in a form
 * the contract does not use, starts at nine to seven: the screen offers it to
 * be set rather than inventing that it was.
 */
export function draftWeek(stored: readonly VendorWorkingDay[] | undefined): WorkingDayDraft[] {
  const days = Array.isArray(stored) ? stored : [];

  return VENDOR_WORKING_DAYS.map(day => {
    const entry = days.find(candidate => candidate?.day === day);

    return {
      day,
      isOpen: entry?.isOpen === true,
      opensAt: isWorkingTime(entry?.opensAt) ? entry.opensAt : DRAFT_OPENS_AT,
      closesAt: isWorkingTime(entry?.closesAt) ? entry.closesAt : DRAFT_CLOSES_AT,
    };
  });
}

/**
 * Every time a day may open or close at, from midnight in half-hour steps —
 * plus `current` in its place when it is a time of its own (a backend may
 * store a quarter past), so the time a day already has is always one of the
 * choices and never silently replaced.
 */
export function workingTimeOptions(current?: string): string[] {
  const times: string[] = [];
  for (let minutes = 0; minutes < MINUTES_PER_DAY; minutes += WORKING_TIME_STEP_MINUTES) {
    const hour = String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, '0');
    const minute = String(minutes % MINUTES_PER_HOUR).padStart(2, '0');
    times.push(`${hour}:${minute}`);
  }

  if (isWorkingTime(current) && !times.includes(current)) {
    times.push(current);
    // Zero-padded 24-hour times sort correctly as text.
    times.sort();
  }

  return times;
}

/** What is wrong with one day, in words for the vendor, or null. */
export function dayProblem(day: WorkingDayDraft): string | null {
  // No overnight shift in Phase 1: closing at or before opening is not a day.
  return day.isOpen && day.closesAt <= day.opensAt ? COPY.closesBeforeOpens : null;
}

/** The week as the service is sent it: times on an open day, and on no other. */
export function buildWorkingHours(week: readonly WorkingDayDraft[]): VendorWorkingDay[] {
  return week.map(({ day, isOpen, opensAt, closesAt }) =>
    isOpen ? { day, isOpen, opensAt, closesAt } : { day, isOpen },
  );
}

/** Whether two drafts would send the same week. */
export function sameWorkingHours(
  first: readonly WorkingDayDraft[],
  second: readonly WorkingDayDraft[],
): boolean {
  return JSON.stringify(buildWorkingHours(first)) === JSON.stringify(buildWorkingHours(second));
}

/**
 * Tuesday to Friday given Monday's hours — open or closed, and its times.
 * Saturday and Sunday are left as they are: they are not weekdays.
 */
export function copyMondayToWeekdays(week: readonly WorkingDayDraft[]): WorkingDayDraft[] {
  const monday = week.find(day => day.day === MONDAY);
  if (!monday) {
    return [...week];
  }

  return week.map(day =>
    REST_OF_WORKING_WEEK.includes(day.day)
      ? { ...day, isOpen: monday.isOpen, opensAt: monday.opensAt, closesAt: monday.closesAt }
      : day,
  );
}
