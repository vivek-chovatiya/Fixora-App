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
 *
 * In English, Hindi and Gujarati since Phase 5 (28/11/2026): the `_EN` tables
 * are the source, `requestTokens.hi.ts` / `.gu.ts` translate them. A priority's
 * label is read when it is presented, never stored in the table, and dates are
 * formatted in the interface's language (`intlLocaleTag`). A priority the app
 * does not know is shown as the backend's own value, tidied — in English, as
 * the backend wrote it.
 */

import { intlLocaleTag, localized } from '@/core/i18n';
import type { StatusTone } from '@/shared/components/StatusBadge';
import {
  PRIORITY_COPY_GU,
  RELATIVE_TIME_COPY_GU,
} from '@/shared/presentation/requestTokens.gu';
import {
  PRIORITY_COPY_HI,
  RELATIVE_TIME_COPY_HI,
} from '@/shared/presentation/requestTokens.hi';
import type { IconName } from '@/shared/theme';

/**
 * Words for "how long ago". Numbers and units rather than sentences, so a
 * translator is never handed a fragment to treat as one.
 */
export const RELATIVE_TIME_COPY_EN = Object.freeze({
  justNow: 'Just now',
  minute: '{count} min ago',
  hour: '{count} hr ago',
  day: '{count} day ago',
  days: '{count} days ago',
});

export const RELATIVE_TIME_COPY = localized({
  en: RELATIVE_TIME_COPY_EN,
  hi: RELATIVE_TIME_COPY_HI,
  gu: RELATIVE_TIME_COPY_GU,
});

export interface TokenPresentation {
  label: string;
  tone: StatusTone;
  icon: IconName;
}

/** Priorities as PROJECT_BIBLE.md section 15 lists them, with its own labels. */
export const PRIORITY_COPY_EN = Object.freeze({
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  EMERGENCY: 'Emergency',
});

const PRIORITY_COPY = localized({ en: PRIORITY_COPY_EN, hi: PRIORITY_COPY_HI, gu: PRIORITY_COPY_GU });

type KnownPriority = keyof typeof PRIORITY_COPY_EN;

/** How each priority looks. The words are `PRIORITY_COPY`'s, read when one is presented. */
const PRIORITY: Readonly<Record<KnownPriority, Omit<TokenPresentation, 'label'>>> = Object.freeze({
  LOW: { tone: 'neutral', icon: 'priority' },
  MEDIUM: { tone: 'info', icon: 'priority' },
  HIGH: { tone: 'warning', icon: 'priority' },
  EMERGENCY: { tone: 'danger', icon: 'warning' },
});

function isKnownPriority(value: string): value is KnownPriority {
  return Object.prototype.hasOwnProperty.call(PRIORITY, value);
}

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
  const key = priority.trim().toUpperCase();
  if (isKnownPriority(key)) {
    return { label: PRIORITY_COPY[key], ...PRIORITY[key] };
  }
  return { label: humaniseToken(priority), tone: 'neutral', icon: 'priority' };
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

  return created.toLocaleDateString(intlLocaleTag(), {
    day: 'numeric',
    month: 'short',
    year: created.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}
