/**
 * Request tokens, made readable
 *
 * How a priority and a timestamp are shown — to whoever is looking. Written for
 * the customer's request cards and shared in Phase 3E-2, when the vendor
 * dashboard had to show the same request's priority and age: two tables of
 * priority labels are two tables that drift, and a request must not read
 * "High" to the customer and something else to the vendor.
 *
 * Nothing here decides anything. A value the app has never seen is tidied and
 * shown, never dropped and never guessed at.
 */

import type { StatusTone } from '@/shared/components/StatusBadge';
import type { IconName } from '@/shared/theme';

/**
 * Words for "how long ago". Numbers and units rather than sentences, so a
 * translator is never handed a fragment to treat as one.
 */
export const RELATIVE_TIME_COPY = Object.freeze({
  justNow: 'Just now',
  minute: '{count} min ago',
  hour: '{count} hr ago',
  day: '{count} day ago',
  days: '{count} days ago',
});

export interface TokenPresentation {
  label: string;
  tone: StatusTone;
  icon: IconName;
}

/** Priorities as PROJECT_BIBLE.md section 15 lists them, with its own labels. */
const PRIORITY: Readonly<Record<string, TokenPresentation>> = Object.freeze({
  LOW: { label: 'Low', tone: 'neutral', icon: 'priority' },
  MEDIUM: { label: 'Medium', tone: 'info', icon: 'priority' },
  HIGH: { label: 'High', tone: 'warning', icon: 'priority' },
  EMERGENCY: { label: 'Emergency', tone: 'danger', icon: 'warning' },
});

/**
 * Makes a backend constant readable without pretending to understand it.
 *
 * `ON_HOLD` becomes `On hold`. It is not a translation and it is not a guess at
 * meaning — it is the raw value, tidied, so an unrecognised priority is still
 * something a support conversation can refer to.
 */
export function humaniseToken(token: string): string {
  const words = token.trim().toLowerCase().replace(/[_-]+/g, ' ');

  return words.length === 0 ? '' : words.charAt(0).toUpperCase() + words.slice(1);
}

export function presentPriority(priority: string): TokenPresentation {
  return (
    PRIORITY[priority.trim().toUpperCase()] ?? {
      label: humaniseToken(priority),
      tone: 'neutral',
      icon: 'priority',
    }
  );
}

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
/** Beyond this a relative time stops being easier to read than a date. */
const RELATIVE_DAY_LIMIT = 7;

function fill(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

/**
 * How long ago a request was raised.
 *
 * Relative while that is the more useful answer — someone scanning recent
 * requests cares that one is from this morning, not that it was the fourteenth —
 * and an absolute date once "eleven days ago" has stopped meaning anything.
 *
 * `now` is a parameter so the result is a pure function of its inputs. A helper
 * that reads the clock itself can only be tested by pretending to be a clock.
 */
export function formatRequestDate(iso: string, now: Date = new Date()): string {
  const created = new Date(iso);

  if (Number.isNaN(created.getTime())) {
    // A date the backend sent that cannot be parsed is not worth a crash, and
    // an invented date would be worse than none.
    return '';
  }

  const minutes = Math.floor((now.getTime() - created.getTime()) / MS_PER_MINUTE);

  // A clock skewed a little the other way is common enough that a future
  // timestamp should read as "now" rather than as a negative age.
  if (minutes < 1) {
    return RELATIVE_TIME_COPY.justNow;
  }

  if (minutes < MINUTES_PER_HOUR) {
    return fill(RELATIVE_TIME_COPY.minute, minutes);
  }

  const hours = Math.floor(minutes / MINUTES_PER_HOUR);

  if (hours < HOURS_PER_DAY) {
    return fill(RELATIVE_TIME_COPY.hour, hours);
  }

  const days = Math.floor(hours / HOURS_PER_DAY);

  if (days < RELATIVE_DAY_LIMIT) {
    return fill(days === 1 ? RELATIVE_TIME_COPY.day : RELATIVE_TIME_COPY.days, days);
  }

  return created.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: created.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}
