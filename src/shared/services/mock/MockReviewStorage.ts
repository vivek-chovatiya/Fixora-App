/**
 * MockReviewStorage
 *
 * Keeps the reviews a customer has submitted on this device, so the mock review
 * table still has them after the app is closed and opened again.
 *
 * ⚠️ Local, and a mock's — the same terms as `MockRequestHistoryStorage`. There
 * is no server and no sync; this exists because the requests a review is about
 * already survive a restart, and a review that did not would leave a reviewed
 * request offering to be reviewed again (PROJECT_BIBLE.md section 24: one
 * request, one review). It belongs to `MockReviewService` and nothing else, and
 * goes with it when a real `ReviewService` arrives.
 *
 * ⚠️ Its own key, never the request history's. A review is not part of the
 * request record and never changes it, so the two are stored apart, read apart
 * and can be cleared apart.
 *
 * Per customer, keyed by the session's customer id, so a second customer on the
 * same device never sees the first one's reviews.
 *
 * What is kept is the review as the mock accepted it — the reference, the stars,
 * the comment and when — and nothing a screen derives from it. Versioned and
 * strict: another schema is ignored, an entry that does not decode is dropped,
 * and nothing here throws.
 *
 * The device is reached through `core/storage`'s `KeyValueStorage`, never
 * AsyncStorage directly (CLAUDE.md section 4) — the same keys and JSON as
 * before. The class keeps its name: AsyncStorage is still what lies underneath.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { getKeyValueStorage } from '@/core/storage/KeyValueStorage';
import {
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  type RequestReview,
} from '@/shared/services/types/ReviewService';

const log = createLogger('MockReviewStorage');

/** Bumped whenever `RequestReview` changes in a way an old record cannot satisfy. */
const SCHEMA_VERSION = 1;

export interface MockReviewStorage {
  /** The customer's saved reviews. Empty when there are none or they cannot be read. Never throws. */
  read(customerId: string): Promise<RequestReview[]>;

  /**
   * Saves one review, replacing any saved against the same request. Resolves
   * `false` when it could not be written. Never throws.
   */
  save(customerId: string, review: RequestReview): Promise<boolean>;
}

function keyFor(customerId: string): string {
  return `${AppConfig.storage.mockRequestReviewKey}/${encodeURIComponent(customerId)}`;
}

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFilled(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** One saved review, or null when it is not one. All or nothing. */
function decodeReview(value: unknown): RequestReview | null {
  if (!isFields(value)) {
    return null;
  }

  const { requestId, rating, comment, submittedAt } = value;

  if (
    !isFilled(requestId) ||
    typeof rating !== 'number' ||
    !Number.isInteger(rating) ||
    rating < REVIEW_RATING_MIN ||
    rating > REVIEW_RATING_MAX ||
    !(comment === undefined || isFilled(comment)) ||
    !isFilled(submittedAt) ||
    Number.isNaN(Date.parse(submittedAt))
  ) {
    return null;
  }

  return comment === undefined
    ? { requestId, rating, submittedAt }
    : { requestId, rating, comment, submittedAt };
}

/** Everything that decodes, one review per request. Never throws. */
function decodeReviews(raw: string | null): RequestReview[] {
  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Not logged with the parser's message: it can quote a comment.
    log.warn('Saved reviews are not valid JSON; ignoring them');
    return [];
  }

  if (!isFields(parsed) || parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.reviews)) {
    log.info('Ignoring reviews written for another schema', {
      version: isFields(parsed) && typeof parsed.version === 'number' ? parsed.version : 'unknown',
    });
    return [];
  }

  // By request, the last one written winning: one request, one review.
  const byRequest = new Map<string, RequestReview>();
  let dropped = 0;

  for (const entry of parsed.reviews) {
    const review = decodeReview(entry);

    if (review) {
      byRequest.delete(review.requestId);
      byRequest.set(review.requestId, review);
    } else {
      dropped += 1;
    }
  }

  if (dropped > 0) {
    log.warn('Dropped saved reviews that did not decode', { dropped });
  }

  return [...byRequest.values()];
}

export class AsyncStorageMockReviewStorage implements MockReviewStorage {
  async read(customerId: string): Promise<RequestReview[]> {
    try {
      return decodeReviews(await getKeyValueStorage().getItem(keyFor(customerId)));
    } catch (error) {
      // A warning, not an error: the logger turns an error into a red screen in
      // a debug build, and unreadable reviews read as none.
      log.warn('Failed to read saved reviews', { error: String(error) });
      return [];
    }
  }

  async save(customerId: string, review: RequestReview): Promise<boolean> {
    try {
      const key = keyFor(customerId);

      // Read, replace, write — so a review saved twice is still one review, and
      // a read that fails throws to the catch rather than overwriting history
      // that was only unreachable for a moment.
      const saved = decodeReviews(await getKeyValueStorage().getItem(key));
      const reviews = [...saved.filter(entry => entry.requestId !== review.requestId), review];

      await getKeyValueStorage().setItem(
        key,
        JSON.stringify({ version: SCHEMA_VERSION, reviews }),
      );
      return true;
    } catch (error) {
      log.warn('Failed to save review', { error: String(error) });
      return false;
    }
  }
}
