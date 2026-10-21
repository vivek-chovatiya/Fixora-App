/**
 * Request scheduling
 *
 * Builds the choices behind "preferred date" and "preferred time", and keeps the
 * value the backend receives separate from the words the customer reads.
 *
 * ⚠️ The two are never the same string. `CreateRequestInput` takes a calendar
 * date and a 24-hour time; a customer sees "Tomorrow" and "7:00 AM", formatted
 * to their locale. Submitting the label would send the device's language and
 * clock format to the backend as though they were data.
 *
 * The bounds below are the reach of a picker, not a claim about anyone's
 * working hours. PROJECT_BIBLE.md section 18A puts availability, eligibility and
 * scheduling squarely with the backend, so nothing here says a vendor can be
 * had at eight in the morning — only that a customer may say they would prefer
 * one. They live in the feature rather than in AppConfig for the reason the auth
 * schemas give for their own limits: each is used by exactly one control on one
 * screen, and AppConfig is for values that cross features.
 *
 * How a date and a time are read back out is shared (`calendarDate`,
 * `clockTime`): the vendor reads the same preference the customer chose.
 */

import { formatDayLabel } from '@/shared/presentation/calendarDate';

/** How far ahead a preference may be expressed. */
const DAYS_AHEAD = 14;

/** First and last hour offered, inclusive. Not a statement about availability. */
const FIRST_HOUR = 7;
const LAST_HOUR = 20;

/**
 * The absence of a preference, as a value the control can hold.
 *
 * An empty string rather than `undefined` so the rails have something to mark
 * selected: "no preference" is an answer a customer gives on purpose, and a
 * control with nothing selected reads as one they have not reached yet. It is
 * translated back to an omitted field on the way to the service.
 */
export const NO_PREFERENCE = '';

export interface ScheduleOption {
  /** What the service receives. `NO_PREFERENCE` for the opening choice. */
  value: string;
  /** What the customer reads, in their own locale. */
  label: string;
}

/**
 * Local calendar date as `YYYY-MM-DD` — from local components, never through
 * `toISOString`, which converts to UTC first and would record half past
 * midnight in Delhi as the day before.
 */
function toDateValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The words the rails need that are not dates. Passed in, never imported here. */
export interface ScheduleCopy {
  anyDate: string;
  anyTime: string;
  today: string;
  tomorrow: string;
}

/**
 * The days a customer may ask for, starting today.
 *
 * `now` is a parameter for the same reason `formatRequestDate` takes one: a
 * function that reads the clock itself can only be tested by pretending to be a
 * clock.
 */
export function buildDateOptions(copy: ScheduleCopy, now: Date = new Date()): ScheduleOption[] {
  const options: ScheduleOption[] = [{ value: NO_PREFERENCE, label: copy.anyDate }];

  for (let offset = 0; offset < DAYS_AHEAD; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    options.push({ value: toDateValue(date), label: formatDayLabel(date, now, copy) });
  }

  return options;
}

/**
 * The times a customer may ask for, on the hour.
 *
 * Hourly rather than by the half hour: the value is a preference a dispatcher
 * reads, and offering twenty-eight choices instead of fourteen would suggest a
 * precision the request cannot carry.
 *
 * The date the label is formatted from is arbitrary — only the hour is read —
 * but it has to be a real one, because `toLocaleTimeString` is what turns 13:00
 * into "1:00 PM" for a reader whose locale wants that and leaves it as "13:00"
 * for one whose locale does not.
 */
export function buildTimeOptions(copy: ScheduleCopy): ScheduleOption[] {
  const options: ScheduleOption[] = [{ value: NO_PREFERENCE, label: copy.anyTime }];
  const reference = new Date(2000, 0, 1);

  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour += 1) {
    reference.setHours(hour, 0, 0, 0);
    options.push({
      value: `${String(hour).padStart(2, '0')}:00`,
      label: reference.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    });
  }

  return options;
}

/**
 * Reads a stored date back out for a person. Moved, unchanged, to
 * `shared/presentation/calendarDate.ts` when the vendor's request details
 * needed the same date (21/10/2026); re-exported so every import of it here
 * resolves. A `ScheduleCopy` is still what is passed — it carries the two day
 * words the shared formatter asks for.
 */
export { formatDateValue } from '@/shared/presentation/calendarDate';

/**
 * Reads a stored `HH:mm` back out in the reader's own clock format. Moved,
 * unchanged, to `shared/presentation/clockTime.ts` when the vendor's working
 * hours needed the same clock; re-exported so every import of it here resolves.
 */
export { formatTimeValue } from '@/shared/presentation/clockTime';

/**
 * Drops a "no preference" answer on the way to the service.
 *
 * The control needs a value for it; `CreateRequestInput` marks the field
 * optional, and an empty string is not an optional field — it is a preference
 * for the empty string.
 */
export function toOptionalValue(value: string): string | undefined {
  return value === NO_PREFERENCE ? undefined : value;
}
