/**
 * Calendar dates, made readable
 *
 * How a stored `YYYY-MM-DD` is shown — to whoever is looking: "Today",
 * "Tomorrow", then "Thu 11 Sep". Written for the customer's preferred date
 * (`requestScheduling.ts`) and moved here on 21/10/2026, when the vendor's
 * request details needed the same date (PROJECT_BIBLE.md section 32,
 * "Preferred Date/Time") — the `clockTime` precedent: two formatters are two
 * calendars that drift, and the date a customer asked for must read the same
 * to the professional who reads it back. The customer's module re-exports it,
 * so every import of it there still resolves.
 *
 * ⚠️ The words are passed in, never imported here. "Today" and "Tomorrow" are
 * each feature's own copy (the seam translation plugs into), so this module
 * holds no sentence of its own.
 *
 * ⚠️ The reader's own calendar. `toLocaleDateString` writes the weekday and the
 * month the way the reader's locale does, so a test compares with this
 * function's own answer, never with a literal "Thu 11 Sep".
 *
 * Since Phase 5 (28/11/2026) the weekday and month follow the interface when it
 * speaks Hindi or Gujarati (`intlLocaleTag`), so a date reads in the same
 * language as the sentence around it. In English the tag is `undefined`, the
 * device's own format, exactly as before.
 */

import { intlLocaleTag } from '@/core/i18n';

const MS_PER_DAY = 86_400_000;

/** The two days that are called by name rather than by date. */
export interface DayWords {
  today: string;
  tomorrow: string;
}

/**
 * Midnight local time, so a day is a day.
 *
 * `toISOString` is the obvious way to get `YYYY-MM-DD` and the wrong one: it
 * converts to UTC first, so half past midnight in Delhi is still yesterday in
 * Greenwich and a customer asking for tomorrow would be recorded as asking for
 * today.
 */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Names a day the way someone would say it out loud.
 *
 * The next two days get words because that is what they are called; after that
 * the weekday matters more than the ordinal, since "Thu 11 Sep" is something a
 * customer can check against their week and "11 Sep" is not. A day already
 * gone is written as a date too — the vendor may read a request back after the
 * day the customer asked for.
 */
export function formatDayLabel(date: Date, today: Date, copy: DayWords): string {
  const days = Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / MS_PER_DAY);

  if (days === 0) {
    return copy.today;
  }
  if (days === 1) {
    return copy.tomorrow;
  }

  return date.toLocaleDateString(intlLocaleTag(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Reads a stored date back out for a person.
 *
 * The value is the contract's `YYYY-MM-DD`; this is the sentence a reader
 * sees. Parsed into local components rather than handed to `new Date(value)`,
 * which reads a bare date as UTC midnight and can therefore print the day
 * before in any timezone behind Greenwich. A value it cannot read is shown as
 * it came, never dropped.
 */
export function formatDateValue(value: string, copy: DayWords, now: Date = new Date()): string {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return formatDayLabel(new Date(year, month - 1, day), now, copy);
}
