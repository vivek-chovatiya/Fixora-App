/**
 * The arithmetic of section 41's breakdown (PROJECT_BIBLE.md section 41):
 * counts per star in, whole percentages out. Pinned here:
 *
 * - the five percentages always add up to exactly 100 — the largest-remainder
 *   method, where rounding each share on its own shows 99 or 101
 * - a point left over goes to the share that lost the most by rounding down,
 *   and a tie goes to the row with more stars, so the same counts always give
 *   the same figures
 * - a star nobody gave is 0% and never takes a point
 * - always five rows, five stars first, whatever order the counts came in, and
 *   a star left out is a count of zero
 * - shares are of the counts' own sum (the breakdown trusts its counts)
 * - nothing to share, or a breakdown that cannot be read, gives null — the
 *   breakdown is hidden, never drawn with a guessed figure
 */

import { ratingShares } from '@/shared/presentation/rating';
import type { VendorRatingCount } from '@/shared/services/types/ReviewService';

/** A breakdown from counts for 5, 4, 3, 2 and 1 stars, in that order. */
function counts(five: number, four: number, three: number, two: number, one: number): VendorRatingCount[] {
  return [
    { stars: 5, count: five },
    { stars: 4, count: four },
    { stars: 3, count: three },
    { stars: 2, count: two },
    { stars: 1, count: one },
  ];
}

/** The percentages alone, five stars first. */
function percents(breakdown: readonly VendorRatingCount[]): number[] | undefined {
  return ratingShares(breakdown)?.map(share => share.percent);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe('ratingShares — the shares', () => {
  it('shares Ravi’s four reviews: two fives, a four and a three', () => {
    expect(ratingShares(counts(2, 1, 1, 0, 0))).toEqual([
      { stars: 5, count: 2, percent: 50 },
      { stars: 4, count: 1, percent: 25 },
      { stars: 3, count: 1, percent: 25 },
      { stars: 2, count: 0, percent: 0 },
      { stars: 1, count: 0, percent: 0 },
    ]);
  });

  it('gives every review in one bucket all of it', () => {
    expect(percents(counts(7, 0, 0, 0, 0))).toEqual([100, 0, 0, 0, 0]);
    expect(percents(counts(0, 0, 0, 0, 1))).toEqual([0, 0, 0, 0, 100]);
  });

  it('splits an even spread evenly', () => {
    expect(percents(counts(1, 1, 1, 1, 1))).toEqual([20, 20, 20, 20, 20]);
    expect(percents(counts(3, 3, 3, 3, 3))).toEqual([20, 20, 20, 20, 20]);
  });

  it('keeps the counts it was given beside each share', () => {
    expect(ratingShares(counts(8, 2, 1, 1, 0))?.map(share => share.count)).toEqual([8, 2, 1, 1, 0]);
  });
});

describe('ratingShares — always exactly 100', () => {
  it('shows 34 + 33 + 33 for three equal thirds, where rounding shows 99', () => {
    // Each is 33.33…; rounded alone, 33 + 33 + 33.
    expect(percents(counts(1, 1, 1, 0, 0))).toEqual([34, 33, 33, 0, 0]);
  });

  it('shows 38 + 37 + 25 for 3, 3 and 2 of 8, where rounding shows 101', () => {
    // 37.5, 37.5 and 25; rounded alone, 38 + 38 + 25.
    expect(percents(counts(3, 3, 2, 0, 0))).toEqual([38, 37, 25, 0, 0]);
  });

  it('gives a leftover point to the share that lost the most, not the first row', () => {
    // 33.33… and 66.66…: the four-star share lost two thirds of a point.
    expect(percents(counts(1, 2, 0, 0, 0))).toEqual([33, 67, 0, 0, 0]);
    // 14.28…, 28.57… and 57.14…: one point short; the 28.57 lost most.
    expect(percents(counts(1, 2, 4, 0, 0))).toEqual([14, 29, 57, 0, 0]);
  });

  it('breaks a tie towards more stars, the order the rows are drawn in', () => {
    expect(percents(counts(0, 1, 0, 1, 1))).toEqual([0, 34, 0, 33, 33]);
    expect(percents(counts(0, 0, 1, 1, 1))).toEqual([0, 0, 34, 33, 33]);
    // Four sixths (16.66…) and a third (33.33…): three points short. The four
    // sixths lost the same and more than the third, so the three highest take them.
    expect(percents(counts(1, 1, 1, 1, 2))).toEqual([17, 17, 17, 16, 33]);
  });

  it('adds up to 100 for every breakdown of up to three reviews per star', () => {
    for (let five = 0; five <= 3; five += 1) {
      for (let four = 0; four <= 3; four += 1) {
        for (let three = 0; three <= 3; three += 1) {
          for (let two = 0; two <= 3; two += 1) {
            for (let one = 0; one <= 3; one += 1) {
              const given = [five, four, three, two, one];
              const total = sum(given);
              const shares = ratingShares(counts(five, four, three, two, one));

              if (total === 0) {
                expect(shares).toBeNull();
                continue;
              }

              const shown = (shares ?? []).map(share => share.percent);
              expect(sum(shown)).toBe(100);
              given.forEach((count, index) => {
                const exact = (count * 100) / total;
                // Never further than a point from the true share, and never above zero for none.
                expect(shown[index]).toBeGreaterThanOrEqual(Math.floor(exact));
                expect(shown[index]).toBeLessThanOrEqual(Math.ceil(exact));
                if (count === 0) {
                  expect(shown[index]).toBe(0);
                }
              });
            }
          }
        }
      }
    }
  });

  it('can show 0% for a star somebody gave among very many, and its count still says so', () => {
    const shares = ratingShares(counts(999, 0, 0, 0, 1));

    expect(shares?.map(share => share.percent)).toEqual([100, 0, 0, 0, 0]);
    expect(shares?.[4]).toEqual({ stars: 1, count: 1, percent: 0 });
  });
});

describe('ratingShares — five rows, highest first', () => {
  it('draws five stars first whatever order the counts arrive in', () => {
    const ascending = [...counts(2, 1, 1, 0, 0)].reverse();

    expect(ratingShares(ascending)?.map(share => share.stars)).toEqual([5, 4, 3, 2, 1]);
    expect(percents(ascending)).toEqual([50, 25, 25, 0, 0]);
  });

  it('takes a star the breakdown leaves out as nobody having given it', () => {
    expect(ratingShares([{ stars: 4, count: 3 }])).toEqual([
      { stars: 5, count: 0, percent: 0 },
      { stars: 4, count: 3, percent: 100 },
      { stars: 3, count: 0, percent: 0 },
      { stars: 2, count: 0, percent: 0 },
      { stars: 1, count: 0, percent: 0 },
    ]);
  });
});

describe('ratingShares — nothing to draw', () => {
  it('is null for a vendor with no reviews: five zeros, or nothing at all', () => {
    expect(ratingShares(counts(0, 0, 0, 0, 0))).toBeNull();
    expect(ratingShares([])).toBeNull();
  });

  it('is null when there is no breakdown', () => {
    expect(ratingShares(undefined)).toBeNull();
    expect(ratingShares(null)).toBeNull();
    expect(ratingShares({ stars: 5, count: 1 } as unknown as VendorRatingCount[])).toBeNull();
  });

  it('is null when a star is off the scale, not whole, or given twice', () => {
    for (const stars of [0, 6, -1, 4.5, Number.NaN]) {
      expect(ratingShares([...counts(1, 1, 1, 1, 1), { stars, count: 1 }])).toBeNull();
    }
    expect(ratingShares([{ stars: 5, count: 1 }, { stars: 5, count: 2 }])).toBeNull();
    expect(ratingShares([{ stars: '5', count: 1 } as unknown as VendorRatingCount])).toBeNull();
  });

  it('is null when a count is negative, not whole, or not a number', () => {
    for (const count of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(ratingShares(counts(3, count, 1, 0, 0))).toBeNull();
    }
    expect(ratingShares([{ stars: 5, count: '3' } as unknown as VendorRatingCount])).toBeNull();
  });

  it('is null when an entry is not a count at all', () => {
    expect(
      ratingShares([...counts(1, 0, 0, 0, 0).slice(0, 4), null] as unknown as VendorRatingCount[]),
    ).toBeNull();
  });
});
