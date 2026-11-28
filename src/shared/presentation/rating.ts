/**
 * Rating words
 *
 * How a rating on section 24's one-to-five scale is said — to whoever is
 * looking. Written for the customer's review (Phase 3D-6) and shared in Phase
 * 3E-6, when the vendor's reviews (PROJECT_BIBLE.md section 41) had to show the
 * same stars: a rating must not be "4 out of 5 stars" to the customer who gave
 * it and something else to the professional who received it.
 *
 * `CUSTOMER_COPY.review` still carries these under its own names, pointing
 * here, so the review screens and their tests read exactly as before.
 *
 * Also the arithmetic of section 41's breakdown (`ratingShares`): the backend
 * sends counts per star, and turning them into percentages that add up to 100
 * is a rule about ratings, not about one screen — so it sits beside the words,
 * pure and tested on its own. The words for each row are the vendor's copy.
 *
 * The words are in English, Hindi and Gujarati since Phase 5 (28/11/2026):
 * `RATING_COPY_EN` is the source, `rating.hi.ts` / `rating.gu.ts` translate it,
 * and `RATING_COPY` answers in the current language.
 */

import { localized } from '@/core/i18n';
import { RATING_COPY_GU } from '@/shared/presentation/rating.gu';
import { RATING_COPY_HI } from '@/shared/presentation/rating.hi';
import {
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  type VendorRatingCount,
} from '@/shared/services/types/ReviewService';

export const RATING_COPY_EN = Object.freeze({
  /** Names the group of stars for assistive technology. */
  label: 'Rating',
  /**
   * Said for every star, and shown under them once one is chosen. `{count}`
   * and `{max}` are filled by `describeRating`.
   */
  value: '{count} out of {max} stars',
  /** Under a rating input nobody has touched yet. */
  none: 'No rating chosen yet',
  /** On each star of a rating input. */
  hint: 'Sets your rating',
});

export const RATING_COPY = localized({ en: RATING_COPY_EN, hi: RATING_COPY_HI, gu: RATING_COPY_GU });

/**
 * A rating as it is said: "4 out of 5 stars".
 *
 * One wording for the visible line and the screen reader, so the two cannot say
 * different things about the same stars.
 */
export function describeRating(rating: number): string {
  return RATING_COPY.value
    .replace('{count}', String(rating))
    .replace('{max}', String(REVIEW_RATING_MAX));
}

/** Section 24's scale, highest first — the order a breakdown is drawn in. */
const STARS_HIGHEST_FIRST: readonly number[] = Array.from(
  { length: REVIEW_RATING_MAX - REVIEW_RATING_MIN + 1 },
  (_, index) => REVIEW_RATING_MAX - index,
);

/** One row of section 41's breakdown: a number of stars and its share. */
export interface RatingShare {
  /** Whole stars, on section 24's scale. */
  stars: number;
  /** How many reviews gave that many, as the backend counted them. */
  count: number;
  /** Its share of all the counts, as a whole percentage. A breakdown's add up to exactly 100. */
  percent: number;
}

/** A count the app can draw: a whole number, zero or more. */
function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** A number of stars on section 24's scale. */
function isStars(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= REVIEW_RATING_MIN &&
    value <= REVIEW_RATING_MAX
  );
}

/**
 * Section 41's breakdown as whole percentages: one row per number of stars,
 * five first down to one, whose percentages add up to exactly 100.
 *
 * ⚠️ The largest-remainder method, not rounding. Rounding each share on its
 * own can show 99 or 101 — three equal thirds round to 33 + 33 + 33, and 3, 3
 * and 2 reviews of 8 round to 38 + 38 + 25. Instead each share is rounded down,
 * and the points still missing from 100 go one each to the shares that lost
 * the most by it. Where two lost exactly the same, the one with more stars
 * comes first — the order they are drawn in — so the same counts always give
 * the same figures. A star nobody gave is always 0% and never takes a point;
 * a star somebody gave can still show 0% when it is under half a percent of
 * many reviews (its row still says how many).
 *
 * ⚠️ Shares of the counts' own sum, never of `totalReviews`. The breakdown
 * trusts its counts: if they ever add up to something other than the vendor's
 * total, the rows still agree with each other and with their bars.
 *
 * Null — draw no breakdown — when there is nothing to share (no reviews, or
 * every count zero), and when the backend's breakdown cannot be read: not a
 * list, a star off the scale or given twice, or a count that is not a whole
 * number of zero or more. A breakdown with one figure wrong is not shown at
 * all, as the summary refuses an average it cannot trust; four rows beside one
 * guessed would be an invented figure. A star the breakdown leaves out is taken
 * as nobody having given it.
 */
export function ratingShares(
  breakdown: readonly VendorRatingCount[] | null | undefined,
): RatingShare[] | null {
  if (!Array.isArray(breakdown)) {
    return null;
  }

  const counts = new Map<number, number>();
  for (const entry of breakdown as readonly unknown[]) {
    const { stars, count } = (typeof entry === 'object' && entry !== null
      ? entry
      : {}) as Partial<Record<keyof VendorRatingCount, unknown>>;

    if (!isStars(stars) || counts.has(stars) || !isCount(count)) {
      return null;
    }
    counts.set(stars, count);
  }

  const rows = STARS_HIGHEST_FIRST.map(stars => ({ stars, count: counts.get(stars) ?? 0 }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  if (total === 0) {
    return null;
  }

  // Whole numbers throughout: the remainder is exact, so two shares that lost
  // the same really are a tie, not a difference in the fifteenth decimal place.
  const shares = rows.map(row => ({
    ...row,
    percent: Math.floor((row.count * 100) / total),
    remainder: (row.count * 100) % total,
  }));

  let missing = 100 - shares.reduce((sum, share) => sum + share.percent, 0);

  // `sort` is stable, so a tie keeps the drawing order: more stars first.
  const byLoss = shares
    .filter(share => share.remainder > 0)
    .sort((a, b) => b.remainder - a.remainder);
  for (const share of byLoss) {
    if (missing === 0) {
      break;
    }
    share.percent += 1;
    missing -= 1;
  }

  return shares.map(({ stars, count, percent }) => ({ stars, count, percent }));
}
