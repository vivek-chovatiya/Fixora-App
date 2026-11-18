/**
 * Preferred date and time ↔ the backend's `scheduledAt`
 *
 * The app holds a customer's preference as two separate answers — a calendar
 * date `YYYY-MM-DD` and a 24-hour time `HH:mm`, either of which may be absent
 * (PROJECT_BIBLE.md section 14). The backend holds one timestamp,
 * `scheduledAt`. This is the one place the two are converted, for every Api
 * service that sends or reads it.
 *
 * Decisions:
 * - India time. Fixora serves one country (`AppConfig.app.defaultCountry`,
 *   `AppConfig.phone.dialCode`), and India has one time zone with no daylight
 *   saving: UTC+05:30 all year. A preference of "the 20th at 9:00" is 9:00 in
 *   India whatever the phone's own clock is set to, so the offset is written
 *   into the timestamp (`2026-11-20T09:00:00+05:30`) rather than taken from the
 *   device. Reading back shifts the stored instant by the same offset.
 * - A date with no time is sent as that date at 00:00 India time, and 00:00 is
 *   read back as "no time". The app never offers midnight — its times run from
 *   07:00 to 20:00 (`requestScheduling.ts`) — so the two cannot be confused for a
 *   request this app raised. A request written elsewhere at exactly midnight
 *   reads as a date alone, which is the safer misreading.
 * - A time with no date cannot be held: a timestamp needs a day, and choosing
 *   one would be the app inventing a preference. It is not sent, and the
 *   caller says so (WORKING_NOTES: backend gap — no field for a time alone).
 *
 * ⚠️ When multi-country arrives this offset becomes the request's own (or the
 * backend's), not a constant. Nothing else should hard-code +05:30.
 */

import { AppError } from '@/shared/types/error';

/** India Standard Time. No daylight saving, so one constant is the whole truth. */
const SERVICE_UTC_OFFSET = '+05:30';
const SERVICE_UTC_OFFSET_MS = (5 * 60 + 30) * 60_000;

const DATE_VALUE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_VALUE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** The preference as the app's two answers. Either may be absent. */
export interface PreferredSchedule {
  preferredDate?: string;
  preferredTime?: string;
}

function isCalendarDate(value: string): boolean {
  const match = DATE_VALUE.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function refused(field: string): AppError {
  // The field, never the value: a preference is the customer's own.
  return new AppError({ kind: 'validation', message: `Unreadable preferred ${field}` });
}

/**
 * The backend's `scheduledAt` for a preference, or undefined when there is
 * nothing it can hold — no date (a time alone is dropped; see above).
 *
 * Refuses, as a validation error, a date or time that is not the shape the
 * contract promises. The form only ever produces valid ones.
 */
export function toScheduledAt(preferredDate?: string, preferredTime?: string): string | undefined {
  if (preferredTime !== undefined && !TIME_VALUE.test(preferredTime)) {
    throw refused('time');
  }
  if (preferredDate === undefined) {
    return undefined;
  }
  if (!isCalendarDate(preferredDate)) {
    throw refused('date');
  }

  return `${preferredDate}T${preferredTime ?? '00:00'}:00${SERVICE_UTC_OFFSET}`;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * The app's two answers for a stored `scheduledAt`. Nothing for `null`, a
 * missing value or one that does not parse — no preference is a normal answer.
 */
export function fromScheduledAt(value: unknown): PreferredSchedule {
  if (typeof value !== 'string' || value.trim() === '') {
    return {};
  }
  const instant = Date.parse(value);
  if (Number.isNaN(instant)) {
    return {};
  }

  // The instant moved to India's wall clock, then read with the UTC getters.
  const local = new Date(instant + SERVICE_UTC_OFFSET_MS);
  const preferredDate = `${local.getUTCFullYear()}-${twoDigits(local.getUTCMonth() + 1)}-${twoDigits(
    local.getUTCDate(),
  )}`;
  const hours = local.getUTCHours();
  const minutes = local.getUTCMinutes();

  if (hours === 0 && minutes === 0) {
    return { preferredDate };
  }
  return { preferredDate, preferredTime: `${twoDigits(hours)}:${twoDigits(minutes)}` };
}
