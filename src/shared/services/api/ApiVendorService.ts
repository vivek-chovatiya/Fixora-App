/**
 * ApiVendorService
 *
 * VendorService against the real backend: the professionals a customer may ask
 * for by name (PROJECT_BIBLE.md section 18A). Replaces `MockVendorService` with
 * no change to the preferred-vendor screen.
 *
 * Decisions:
 * - `POST /vendors/list` with `approvalStatus: 'APPROVED'`, `status: 'ACTIVE'`
 *   and the `categoryId`, every page of it (`postAllPages`). The backend lists
 *   vendors by the categories they offer; it has no sub-category or
 *   availability filter, and its validation refuses a key it does not know, so
 *   the sub-category is never sent (the interface passes it so the backend may
 *   one day use it — section 18A.1 puts eligibility there).
 * - Checked again on the way back. The public list's contract
 *   (`requests-contract.md` §3, 17/11/2026) carries `availability` and
 *   `categoryIds` but no status flags, so a vendor is left out when it is not
 *   `availability: true` or does not offer this category (both must be stated),
 *   and — should an older backend still send them — when its `approvalStatus`
 *   or `status` says it is not APPROVED and ACTIVE; the filter asked for those.
 *   One the list repeats is dropped (a vendor added between two page reads
 *   shifts the next page by one). Otherwise the backend's order is kept
 *   untouched — the order is the recommendation (section 18A.2).
 * - A rating only when there are reviews behind it. The backend stores
 *   `averageRating: 0` for a vendor nobody has reviewed; drawing that as nought
 *   stars would publish a rating that does not exist.
 *
 * ⚠️ The mapping reads the id, the business name, the photo and the rating —
 * fields the public contract keeps — and nothing else can leave this file.
 * Email, phone and documents are never read (the backend sent them before the
 * privacy fix; the tests still feed them in). The owner's name and the address
 * are left behind on purpose too: the card names the business, and `areaLabel`
 * is meant to be an area the backend chose to show, not a street.
 */

import { BaseApiService } from '@/shared/services/api/BaseApiService';
import { optionalString, requireRecord, requireString } from '@/shared/services/api/apiResponse';
import type { EligibleVendor, VendorService } from '@/shared/services/types/VendorService';

/** What the list is asked for, beside the category. */
const ELIGIBLE = Object.freeze({ approvalStatus: 'APPROVED', status: 'ACTIVE' });

/** A flag the list no longer sends is not a refusal; one it sends must agree. */
function agrees(value: unknown, expected: string): boolean {
  return value === undefined || value === expected;
}

/**
 * Whether the backend says this vendor can take this category's work now.
 * Availability and the category must be stated: a missing one leaves the
 * vendor out.
 */
function isEligible(record: Record<string, unknown>, categoryId: string): boolean {
  return (
    agrees(record.approvalStatus, ELIGIBLE.approvalStatus) &&
    agrees(record.status, ELIGIBLE.status) &&
    record.availability === true &&
    Array.isArray(record.categoryIds) &&
    record.categoryIds.some(id => id === categoryId)
  );
}

function isWholeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** One vendor row as the app's `EligibleVendor`: four fields, read one by one. */
function toEligibleVendor(record: Record<string, unknown>): EligibleVendor {
  const imageUrl = optionalString(record, 'profileImage');
  const reviewCount = isWholeCount(record.totalReviews) ? record.totalReviews : undefined;
  const average = record.averageRating;
  const rating =
    reviewCount !== undefined && typeof average === 'number' && Number.isFinite(average)
      ? average
      : undefined;

  return {
    id: requireString(record, 'id', 'vendor'),
    name: requireString(record, 'businessName', 'vendor'),
    // Absent rather than undefined, as the mock's vendors are.
    ...(imageUrl ? { imageUrl } : {}),
    ...(rating !== undefined && reviewCount !== undefined ? { rating, reviewCount } : {}),
  };
}

export class ApiVendorService extends BaseApiService implements VendorService {
  constructor() {
    super('/vendors');
  }

  async listEligibleVendors(categoryId: string, _subCategoryId: string): Promise<EligibleVendor[]> {
    const rows = (await this.postAllPages('/list', { ...ELIGIBLE, categoryId })).items;

    const seen = new Set<string>();
    const vendors: EligibleVendor[] = [];

    for (const row of rows) {
      const record = requireRecord(row, 'vendor');
      if (!isEligible(record, categoryId)) {
        continue;
      }

      const vendor = toEligibleVendor(record);
      if (!seen.has(vendor.id)) {
        seen.add(vendor.id);
        vendors.push(vendor);
      }
    }

    return vendors;
  }
}
