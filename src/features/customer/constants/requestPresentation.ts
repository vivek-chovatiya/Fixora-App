/**
 * Request presentation
 *
 * Turns the backend's request vocabulary into something a screen can draw: a
 * label, a tone and a glyph for a status or a priority, and a readable date.
 *
 * ⚠️ It maps, it never decides. PROJECT_BIBLE.md section 21 says the frontend
 * must never invent a status, so the tables below hold copy for the states the
 * roadmap lists and nothing else — and a value that is not in them still
 * renders, humanised and in the neutral tone. That fallback is the whole reason
 * this is a lookup rather than a union: the backend can add a state tomorrow and
 * the worst that happens is a plainer badge, not a blank one or a crash.
 *
 * It lives in the customer module because the customer's reading of a status is
 * not the vendor's. "Awaiting vendor" describes a wait to the person who is
 * waiting; to a vendor the same record is work available to accept.
 */

import type { StatusTone } from '@/shared/components';
import { RELATIVE_TIME_COPY } from '@/features/customer/constants/customerCopy';
import type { IconName } from '@/shared/theme';

export interface TokenPresentation {
  label: string;
  tone: StatusTone;
  icon: IconName;
}

/**
 * Statuses as PROJECT_BIBLE.md section 21 lists them.
 *
 * Tone carries urgency, not identity — the label is what says which state this
 * is, so the pair stays legible in greyscale and to a colour-blind reader
 * (section 46). Every entry also carries a glyph for the same reason: a badge
 * that differs only in hue differs in nothing that survives a photocopier.
 */
const STATUS: Readonly<Record<string, TokenPresentation>> = Object.freeze({
  CREATED: { label: 'Created', tone: 'neutral', icon: 'pending' },
  /*
    Neutral about why nobody has taken it yet. Section 20 words this differently
    for a directed request and an open one, and the summary contract says which
    is which for neither.
  */
  PENDING_VENDOR: { label: 'Awaiting vendor', tone: 'info', icon: 'pending' },
  ACCEPTED: { label: 'Accepted', tone: 'info', icon: 'success' },
  IN_PROGRESS: { label: 'In progress', tone: 'warning', icon: 'pending' },
  COMPLETED: { label: 'Completed', tone: 'success', icon: 'success' },
  CLOSED: { label: 'Closed', tone: 'neutral', icon: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger', icon: 'error' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral', icon: 'close' },
  ON_HOLD: { label: 'On hold', tone: 'warning', icon: 'warning' },
});

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
 * meaning — it is the raw value, tidied, so an unrecognised state is still
 * something a support conversation can refer to.
 */
export function humaniseToken(token: string): string {
  const words = token.trim().toLowerCase().replace(/[_-]+/g, ' ');

  return words.length === 0 ? '' : words.charAt(0).toUpperCase() + words.slice(1);
}

function present(
  table: Readonly<Record<string, TokenPresentation>>,
  value: string,
  fallbackIcon: IconName,
): TokenPresentation {
  return (
    table[value.trim().toUpperCase()] ?? {
      label: humaniseToken(value),
      tone: 'neutral',
      icon: fallbackIcon,
    }
  );
}

export function presentStatus(status: string): TokenPresentation {
  return present(STATUS, status, 'info');
}

export function presentPriority(priority: string): TokenPresentation {
  return present(PRIORITY, priority, 'priority');
}

/**
 * The priorities a customer may choose from, least urgent first.
 *
 * PROJECT_BIBLE.md section 15 fixes these four for Phase 1 and says two things
 * that pull in opposite directions: the values come from backend-supported
 * constants, and arbitrary values are not allowed. With no endpoint offering
 * them, the roadmap's own list is the closest thing to the backend's answer —
 * so it is written out once, here, beside the labels it is rendered with.
 *
 * ⚠️ A list, not a truth. `PRIORITY` above still resolves anything the backend
 * sends, including a value that is not in here, because reading a request is a
 * different job from raising one: the app may only offer what it has been told
 * about, and must display whatever it is given.
 *
 * Ordered by urgency because the control is read as a scale. Object key order
 * would have produced the same sequence today and silently stopped meaning
 * anything the moment someone tidied the table above.
 */
export const SELECTABLE_PRIORITIES: readonly string[] = Object.freeze([
  'LOW',
  'MEDIUM',
  'HIGH',
  'EMERGENCY',
]);

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
