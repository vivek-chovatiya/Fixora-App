/**
 * Clock time, made readable
 *
 * How a stored `HH:mm` is shown — to whoever is looking. Written for the
 * customer's preferred time (`requestScheduling.ts`) and shared when the
 * vendor's working hours (PROJECT_BIBLE.md section 38) needed the same thing:
 * two formatters are two clocks that drift, and a time must not read "7:00 PM"
 * on one screen and "19:00" on the next for the same reader. The customer's
 * module re-exports it, so every import of it there still resolves.
 *
 * ⚠️ The reader's own clock, never one the app picks. `toLocaleTimeString` is
 * what turns 19:00 into "7:00 PM" for a reader whose locale wants that and
 * leaves it as "19:00" for one whose locale does not — so a test compares with
 * this function's own answer, never with a literal "7:00 PM".
 *
 * Since Phase 5 (28/11/2026) it follows the interface's language when that is
 * Hindi or Gujarati (`intlLocaleTag`); in English it is the device's own clock,
 * exactly as before.
 */

import { intlLocaleTag } from '@/core/i18n';

/**
 * Reads a stored `HH:mm` back out in the reader's own clock format. A value it
 * cannot read is shown as it came, never dropped.
 *
 * The date the time is placed on is arbitrary — only the hour and minute are
 * read — but it has to be a real one for the locale to format.
 */
export function formatTimeValue(value: string): string {
  const [hour, minute] = value.split(':').map(Number);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value;
  }

  const reference = new Date(2000, 0, 1, hour, minute);
  return reference.toLocaleTimeString(intlLocaleTag(), { hour: 'numeric', minute: '2-digit' });
}
