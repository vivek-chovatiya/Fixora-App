/**
 * Request presentation
 *
 * Turns the backend's request vocabulary into something a screen can draw: a
 * label, a tone and a glyph for a priority, and a readable date.
 *
 * ⚠️ It maps, it never decides. PROJECT_BIBLE.md section 15 fixes the priorities
 * and the backend owns their values, so the table below holds copy for the ones
 * the roadmap lists — and a value that is not in it still renders, humanised and
 * in the neutral tone. That fallback is the whole reason this is a lookup rather
 * than a union.
 *
 * Statuses used to live here too, and moved to `requestStatus.ts` when the
 * customer-facing stage stopped being a straight lookup: what a status means to
 * a customer depends on whether they chose a professional, which is more than a
 * table keyed by one string can say.
 */

import {
  RELATIVE_TIME_COPY,
  formatRequestDate,
  humaniseToken,
  presentPriority,
  type TokenPresentation,
} from '@/shared/presentation/requestTokens';

/*
  Shared since Phase 3E-2 — the vendor dashboard shows the same priorities and
  ages. Re-exported so every customer import of them is untouched.
*/
export { RELATIVE_TIME_COPY, formatRequestDate, humaniseToken, presentPriority };
export type { TokenPresentation };

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
