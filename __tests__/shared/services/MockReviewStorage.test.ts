/**
 * The mock's saved reviews are what keep section 24's "one request, one review"
 * true across a restart, so these tests pin:
 *
 * - a review saved is a review read back whole, and nothing derived is written
 * - each customer has their own reviews, under a key that is neither the
 *   request history's nor the draft's
 * - a review saved twice against one request is one review
 * - nothing it reads can take the app down, and a device that refuses to read or
 *   write is survived without losing what was already there
 *
 * Run against the in-memory AsyncStorage from jest.setup.js.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import { AsyncStorageMockReviewStorage } from '@/shared/services/mock/MockReviewStorage';
import type { RequestReview } from '@/shared/services/types/ReviewService';

const CUSTOMER = 'usr_customer_1';
const KEY = `${AppConfig.storage.mockRequestReviewKey}/${CUSTOMER}`;

const REVIEW: RequestReview = {
  requestId: 'REQ-24048',
  rating: 4,
  comment: 'Quick, tidy, and the switch works.',
  submittedAt: '2026-09-22T10:00:00.000Z',
};

const STARS_ONLY: RequestReview = {
  requestId: 'REQ-24090',
  rating: 1,
  submittedAt: '2026-09-22T11:00:00.000Z',
};

let storage: AsyncStorageMockReviewStorage;

beforeEach(async () => {
  await AsyncStorage.clear();
  storage = new AsyncStorageMockReviewStorage();
});

describe('MockReviewStorage — keeping reviews', () => {
  it('reads back a saved review whole', async () => {
    await storage.save(CUSTOMER, REVIEW);

    expect(await storage.read(CUSTOMER)).toEqual([REVIEW]);
  });

  it('keeps a review with no comment without one, not with an empty string', async () => {
    await storage.save(CUSTOMER, STARS_ONLY);

    const [read] = await storage.read(CUSTOMER);
    expect(read).toEqual(STARS_ONLY);
    expect(Object.keys(read)).not.toContain('comment');
  });

  it('reads nothing for a customer who has reviewed nothing', async () => {
    expect(await storage.read(CUSTOMER)).toEqual([]);
  });

  it('keeps each customer’s reviews apart', async () => {
    await storage.save(CUSTOMER, REVIEW);
    await storage.save('usr_customer_2', STARS_ONLY);

    expect(await storage.read(CUSTOMER)).toEqual([REVIEW]);
    expect(await storage.read('usr_customer_2')).toEqual([STARS_ONLY]);
  });

  it('writes under its own key — never the request history’s or the draft’s', async () => {
    await storage.save(CUSTOMER, REVIEW);

    expect(await AsyncStorage.getItem(KEY)).not.toBeNull();
    expect(
      await AsyncStorage.getItem(`${AppConfig.storage.mockRequestHistoryKey}/${CUSTOMER}`),
    ).toBeNull();
    expect(await AsyncStorage.getItem(AppConfig.storage.requestDraftKey)).toBeNull();
    expect(KEY.startsWith(AppConfig.storage.mockRequestHistoryKey)).toBe(false);
    expect(KEY.startsWith(AppConfig.storage.requestDraftKey)).toBe(false);
  });

  it('writes the review and a schema version, and nothing else', async () => {
    await storage.save(CUSTOMER, REVIEW);

    expect(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '')).toEqual({
      version: 1,
      reviews: [REVIEW],
    });
  });
});

describe('MockReviewStorage — one request, one review', () => {
  it('replaces a review saved again against the same request', async () => {
    await storage.save(CUSTOMER, REVIEW);
    await storage.save(CUSTOMER, { ...REVIEW, rating: 5 });

    expect(await storage.read(CUSTOMER)).toEqual([{ ...REVIEW, rating: 5 }]);
  });

  it('reads a request stored twice once, the last one written winning', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, reviews: [REVIEW, { ...REVIEW, rating: 2 }] }),
    );

    expect(await storage.read(CUSTOMER)).toEqual([{ ...REVIEW, rating: 2 }]);
  });
});

describe('MockReviewStorage — what cannot be trusted', () => {
  it('reads corrupt reviews as none, without throwing', async () => {
    await AsyncStorage.setItem(KEY, '{not json');

    await expect(storage.read(CUSTOMER)).resolves.toEqual([]);
  });

  it('ignores reviews written for another schema', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ version: 99, reviews: [REVIEW] }));

    expect(await storage.read(CUSTOMER)).toEqual([]);
  });

  it('drops the entries that do not decode and keeps the ones that do', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        reviews: [
          REVIEW,
          { ...STARS_ONLY, rating: 0 },
          { ...STARS_ONLY, rating: 6 },
          { ...STARS_ONLY, rating: 3.5 },
          { ...STARS_ONLY, rating: '4' },
          { ...STARS_ONLY, requestId: '  ' },
          { ...STARS_ONLY, submittedAt: 'yesterday' },
          { ...STARS_ONLY, comment: '   ' },
          { ...STARS_ONLY, comment: 42 },
          'a review',
          null,
        ],
      }),
    );

    expect(await storage.read(CUSTOMER)).toEqual([REVIEW]);
  });
});

describe('MockReviewStorage — a device that refuses', () => {
  it('reads as none when the device cannot be read', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(storage.read(CUSTOMER)).resolves.toEqual([]);
  });

  it('says so when a review cannot be written, without throwing', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));

    await expect(storage.save(CUSTOMER, REVIEW)).resolves.toBe(false);
    expect(await storage.read(CUSTOMER)).toEqual([]);
  });

  it('never overwrites reviews it only failed to read', async () => {
    await storage.save(CUSTOMER, REVIEW);

    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(storage.save(CUSTOMER, STARS_ONLY)).resolves.toBe(false);
    expect(await storage.read(CUSTOMER)).toEqual([REVIEW]);
  });
});
