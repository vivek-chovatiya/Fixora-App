/**
 * MockReviewService
 *
 * In-memory ReviewService for the UI-first phase (PROJECT_BIBLE.md section 24).
 *
 * ⚠️ A stand-in for a backend, and it enforces what a backend would. Section 24
 * has two rules — a review only once the request is completed or closed, and one
 * review per request — and the screens hide the action whenever either says no.
 * That is not protection: a double tap, a stale screen or a second device all
 * reach the service regardless. So this refuses both, the way the real endpoint
 * is expected to, and the screens are written against the refusal rather than
 * against the mock being polite.
 *
 * ⚠️ Nothing else moves. Accepting a review does not change the request's
 * status, does not touch any professional's rating or review count, and sends
 * nobody a notification. Section 41's averages are the backend's to compute from
 * reviews it holds; a mock that nudged a vendor fixture's rating would be
 * inventing that calculation.
 *
 * The request is read through `RequestService`, as a backend would read its own
 * table, so the eligibility check sees exactly the status the customer sees —
 * including a request raised on this device and kept across a restart.
 *
 * ⚠️ Kept on this device, per customer, through `MockReviewStorage`, and
 * restored on first use after a launch — because the requests survive a restart,
 * and a review that did not would offer a second one. Not persistence anybody may
 * rely on: nothing leaves the phone. There is no seed; every customer starts
 * with no reviews.
 *
 * ⚠️ The vendor's side (section 41, Phase 3E-6) reads fixtures, not the
 * customers' reviews above. A customer's review is about a request raised to
 * the customer app's catalogue of vendors, which are not vendor accounts, and
 * is stored under that customer's id; nothing joins either to a signed-in
 * vendor, and inventing that join here would be inventing the backend's
 * matching. So a vendor's reviews come from `mockVendorReviewData`, written
 * against the vendor's own finished jobs, and the two sides share this service
 * and the review model but no data. The average, the count and the breakdown
 * are computed here, from those reviews, as the backend would compute them —
 * never by the screen — so the three always agree with each other.
 *
 * Replacing this with an ApiReviewService requires no change to any screen.
 */

import { createLogger } from '@/core/logger/Logger';
import type { AuthUser } from '@/features/auth/types';
import type { MockReviewStorage } from '@/shared/services/mock/MockReviewStorage';
import {
  buildMockVendorWork,
  mockScenarioFor,
  type MockDashboardScenario,
} from '@/shared/services/mock/mockVendorDashboardData';
import {
  buildMockVendorReviews,
  mockReviewScenarioFor,
  type MockVendorReviewScenario,
} from '@/shared/services/mock/mockVendorReviewData';
import { simulateNetwork, type MockLatency } from '@/shared/services/mock/mockUtils';
import type { RequestService } from '@/shared/services/types/RequestService';
import {
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  type RequestReview,
  type ReviewService,
  type SubmitReviewInput,
  type VendorRatingCount,
  type VendorReviews,
} from '@/shared/services/types/ReviewService';
import { AppError } from '@/shared/types/error';

const log = createLogger('MockReviewService');

/**
 * The statuses a review may be written against, as this mock answers it.
 *
 * ⚠️ The backend's rule, stood in for. Section 24 says "completed/closed", and
 * the owner confirmed on 2026-09-22 that both are reviewable. The app keeps its
 * own copy of the rule for deciding what to show (`requestReview.ts`); this one
 * is the server's, and exists so the app's is never the only one.
 */
const REVIEWABLE_STATUSES: ReadonlySet<string> = new Set(['COMPLETED', 'CLOSED']);

export interface MockReviewServiceOptions {
  /** Where requests are read from, to check one exists and may be reviewed. */
  requests: Pick<RequestService, 'getRequest'>;

  /** Simulated latency. Pass `NO_LATENCY` in tests. */
  latency?: MockLatency;

  /**
   * Where accepted reviews are kept between launches. Without it — or without
   * `currentCustomerId` — reviews are memory only.
   */
  storage?: MockReviewStorage;

  /** The signed-in customer's id, or null. Asked on every call. */
  currentCustomerId?: () => Promise<string | null>;

  /**
   * Whoever is signed in, for the vendor's side — which decides for itself that
   * the role fits. Asked on every call. Without it nobody is a vendor.
   */
  currentUser?: () => Promise<AuthUser | null>;

  /** Which reviews a vendor has. Defaults to the table beside the fixtures. */
  vendorReviewScenarioFor?: (vendorId: string) => MockVendorReviewScenario;

  /**
   * Which work a vendor has, to say which job each review was for. Defaults to
   * the dashboard's own table, so a review names the job the Requests tab lists.
   */
  vendorWorkScenarioFor?: (vendorId: string) => MockDashboardScenario;

  /** Injectable clock for the vendor's review dates. */
  now?: () => number;
}

/** One decimal place, as an average is published. */
function toTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Section 24's scale, highest first — the order the breakdown is sent in. */
const STARS_HIGHEST_FIRST: readonly number[] = Array.from(
  { length: REVIEW_RATING_MAX - REVIEW_RATING_MIN + 1 },
  (_, index) => REVIEW_RATING_MAX - index,
);

/**
 * How many of `reviews` gave each number of stars: five entries, every one
 * sent, zero included. Counted from exactly the reviews the average and the
 * total come from, so the three figures cannot disagree.
 */
function countByStars(reviews: readonly RequestReview[]): VendorRatingCount[] {
  return STARS_HIGHEST_FIRST.map(stars => ({
    stars,
    count: reviews.filter(review => review.rating === stars).length,
  }));
}

export class MockReviewService implements ReviewService {
  /** Reviews by the reference of the request they are about. */
  private readonly reviews = new Map<string, RequestReview>();

  private readonly requests: Pick<RequestService, 'getRequest'>;

  private readonly latency: MockLatency | undefined;

  private readonly storage: MockReviewStorage | undefined;

  private readonly currentCustomerId: (() => Promise<string | null>) | undefined;

  private readonly currentUser: (() => Promise<AuthUser | null>) | undefined;

  private readonly vendorReviewScenarioFor: (vendorId: string) => MockVendorReviewScenario;

  private readonly vendorWorkScenarioFor: (vendorId: string) => MockDashboardScenario;

  private readonly now: () => number;

  /** Whose reviews the table holds, and the load that put them there. */
  private loaded: { customerId: string | null; ready: Promise<void> } | null = null;

  constructor(options: MockReviewServiceOptions) {
    this.requests = options.requests;
    this.latency = options.latency;
    this.storage = options.storage;
    this.currentCustomerId = options.currentCustomerId;
    this.currentUser = options.currentUser;
    this.vendorReviewScenarioFor = options.vendorReviewScenarioFor ?? mockReviewScenarioFor;
    this.vendorWorkScenarioFor = options.vendorWorkScenarioFor ?? mockScenarioFor;
    this.now = options.now ?? (() => Date.now());
  }

  private simulate<T>(produce: () => T | Promise<T>): Promise<T> {
    return this.latency ? simulateNetwork(produce, this.latency) : simulateNetwork(produce);
  }

  /**
   * Makes the table the asking customer's, and says who that is. Null means
   * memory only. Calls that arrive together share one load.
   */
  private async prepare(): Promise<string | null> {
    const { storage, currentCustomerId } = this;

    if (!storage || !currentCustomerId) {
      return null;
    }

    let customerId: string | null = null;
    try {
      customerId = await currentCustomerId();
    } catch (error) {
      log.warn('Could not tell which customer is asking; reviews stay in memory only', {
        error: String(error),
      });
    }

    if (!this.loaded || this.loaded.customerId !== customerId) {
      this.loaded = { customerId, ready: this.load(storage, customerId) };
    }

    await this.loaded.ready;
    return customerId;
  }

  private async load(storage: MockReviewStorage, customerId: string | null): Promise<void> {
    this.reviews.clear();

    if (customerId === null) {
      return;
    }

    let saved: RequestReview[] = [];
    try {
      saved = await storage.read(customerId);
    } catch (error) {
      log.warn('Could not read saved reviews; starting with none', { error: String(error) });
    }

    for (const review of saved) {
      this.reviews.set(review.requestId, { ...review });
    }

    // How many, never which or what.
    log.info('Mock reviews restored', { restored: saved.length });
  }

  /**
   * Keeps an accepted review for after a restart. A write that fails leaves the
   * review accepted for this session and says so in the log.
   */
  private async remember(customerId: string | null, review: RequestReview): Promise<void> {
    if (!this.storage || !this.currentCustomerId || customerId === null) {
      return;
    }

    let saved = false;
    try {
      saved = await this.storage.save(customerId, { ...review });
    } catch (error) {
      log.warn('Saving a review threw', { error: String(error) });
    }

    if (!saved) {
      log.warn('Mock review accepted but not saved on this device; it will not survive a restart');
    }
  }

  async getReview(requestId: string): Promise<RequestReview | null> {
    await this.prepare();

    return this.simulate(() => {
      const review = this.reviews.get(requestId);

      // Whether, never which: a reference leads back to an address.
      log.info('Mock review read', { found: review !== undefined });

      return review ? { ...review } : null;
    });
  }

  async submitReview(input: SubmitReviewInput): Promise<RequestReview> {
    const customerId = await this.prepare();

    return this.simulate(async () => {
      const { requestId, rating } = input;

      if (!Number.isInteger(rating) || rating < REVIEW_RATING_MIN || rating > REVIEW_RATING_MAX) {
        throw new AppError({
          kind: 'validation',
          message: 'Mock review refused: the rating is outside section 24 scale',
        });
      }

      // Blank is no comment at all, so a record never holds an empty string.
      const comment =
        typeof input.comment === 'string' && input.comment.trim().length > 0
          ? input.comment
          : undefined;

      const request = await this.requests.getRequest(requestId);

      if (!request) {
        throw new AppError({ kind: 'notFound', message: 'Mock review refused: no such request' });
      }

      if (!REVIEWABLE_STATUSES.has(request.status.trim().toUpperCase())) {
        throw new AppError({
          kind: 'conflict',
          message: 'Mock review refused: the request is not completed or closed',
        });
      }

      /*
        ⚠️ Checked and claimed with nothing awaited in between.

        Two submissions for one request — a double tap that beat the button's
        lock, or a retry racing the original — both reach this line. JavaScript
        runs one of them to the `set` below before the other resumes, so the
        second always finds the first here and is refused. An `await` between
        the check and the claim would let both through.
      */
      if (this.reviews.has(requestId)) {
        throw new AppError({
          kind: 'conflict',
          message: 'Mock review refused: this request already has a review',
        });
      }

      const review: RequestReview = {
        requestId,
        rating,
        ...(comment !== undefined ? { comment } : {}),
        submittedAt: new Date().toISOString(),
      };

      // Into the table only while it is still this customer's; saved under the
      // customer who wrote it either way.
      if (this.loaded === null || this.loaded.customerId === customerId) {
        this.reviews.set(requestId, review);
      }

      // Awaited, so a review the app then forgets is never reported as sent.
      await this.remember(customerId, review);

      // The shape, never the words: a comment is the customer's own.
      log.info('Mock review submitted', { rating, hasComment: comment !== undefined });

      return { ...review };
    });
  }

  async getVendorReviews(): Promise<VendorReviews> {
    return this.simulate(async () => {
      const vendor = await this.requireVendor();
      const nowMs = this.now();

      // The vendor's finished jobs, so each review can say which one it was for.
      const finished = buildMockVendorWork(this.vendorWorkScenarioFor(vendor.id), nowMs).completed;
      const reviews = buildMockVendorReviews(this.vendorReviewScenarioFor(vendor.id), nowMs, finished)
        // Newest first, decided here as a backend decides its own order.
        .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));

      // The backend's figures, from the reviews it holds. Here that is all of them.
      const totalReviews = reviews.length;
      const averageRating =
        totalReviews === 0
          ? null
          : toTenth(reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews);
      const ratingBreakdown = countByStars(reviews);

      // How many, never whose or what they said.
      log.info('Mock vendor reviews read', { count: totalReviews });

      return { averageRating, totalReviews, ratingBreakdown, reviews };
    });
  }

  /** What an authenticated vendor endpoint does to anybody else, a customer included. */
  private async requireVendor(): Promise<AuthUser> {
    const user = (await this.currentUser?.()) ?? null;
    if (!user || user.role !== 'vendor') {
      throw new AppError({
        kind: 'unauthorized',
        message: 'Mock vendor reviews: no vendor session',
      });
    }

    return user;
  }
}
