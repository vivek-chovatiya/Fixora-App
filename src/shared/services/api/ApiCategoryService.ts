/**
 * ApiCategoryService
 *
 * CategoryService against the real backend's catalogue (PROJECT_BIBLE.md
 * sections 11 and 12). Replaces `MockCategoryService` with no change to any
 * screen: both answer with the same two shapes, in the order they were given.
 *
 * Decisions:
 * - `POST /categories/list` and `POST /subcategories/list`, not the `GET`
 *   routes beside them. The backend's `GET` handlers read their filter from the
 *   request body, which a GET does not carry, so `GET /subcategories?categoryId=`
 *   answers with every category's services and `GET /categories` with the
 *   first twenty of every status (checked against the running dev server,
 *   17/11/2026). The list routes take the filter in the body.
 * - Active ones only: `status: 'ACTIVE'` is asked for, and anything that still
 *   comes back inactive, or with `isVisible: false`, is left out. The backend
 *   already drops deleted ones.
 * - The whole list, every page (`postAllPages`): a catalogue a vendor registers
 *   against cannot stop at the first page. `AppConfig.api.fullListPageSize` is
 *   the backend's own ceiling, so it is normally one request.
 * - The backend's `icon` becomes `iconGlyph` untouched. It is a
 *   MaterialCommunityIcons name, the opaque string `DynamicIcon` was built for,
 *   and a missing one (`null`, as every seeded sub-category has) reads as
 *   absent so `DynamicIcon` draws the fallback glyph.
 *
 * ⚠️ Nothing here may name a category, list one or map one to anything — the
 * app must render a category it has never heard of (section 11). The ids are
 * the backend's Mongo ids as strings, sent back exactly as received.
 */

import { BaseApiService } from '@/shared/services/api/BaseApiService';
import { optionalString, requireRecord, requireString } from '@/shared/services/api/apiResponse';
import type {
  CategoryService,
  ServiceCategory,
  SubCategory,
} from '@/shared/services/types/CategoryService';

/** What both list endpoints are asked for. */
const ACTIVE_ONLY = Object.freeze({ status: 'ACTIVE' });

/**
 * Whether the backend means this entry to be shown. A missing `status` or
 * `isVisible` is not a refusal: the filter already asked for active ones.
 */
function isShown(record: Record<string, unknown>): boolean {
  return record.isVisible !== false && (record.status === undefined || record.status === 'ACTIVE');
}

/** Categories and sub-categories share a shape; `what` names which in a refusal. */
function toEntry(record: Record<string, unknown>, what: string): ServiceCategory & SubCategory {
  const description = optionalString(record, 'description');
  const iconGlyph = optionalString(record, 'icon');

  return {
    id: requireString(record, 'id', what),
    name: requireString(record, 'name', what),
    // Absent rather than undefined or "", as the mock's entries are.
    ...(description ? { description } : {}),
    ...(iconGlyph ? { iconGlyph } : {}),
  };
}

export class ApiCategoryService extends BaseApiService implements CategoryService {
  constructor() {
    // Two resources, so the paths are whole: `/categories/list`, `/subcategories/list`.
    super('');
  }

  async listServiceCategories(): Promise<ServiceCategory[]> {
    // A catalogue past the page ceiling is shown as far as it was read (logged there).
    const rows = (await this.postAllPages('/categories/list', ACTIVE_ONLY)).items;

    return rows
      .map(row => requireRecord(row, 'category'))
      .filter(isShown)
      .map(record => toEntry(record, 'category'));
  }

  async listSubCategories(categoryId: string): Promise<SubCategory[]> {
    const rows = (await this.postAllPages('/subcategories/list', { ...ACTIVE_ONLY, categoryId }))
      .items;

    return (
      rows
        .map(row => requireRecord(row, 'subCategory'))
        // The filter already asked for this category. An entry from another one
        // is a filter the server ignored, and showing it would put one
        // category's services inside another.
        .filter(record => record.categoryId === undefined || record.categoryId === categoryId)
        .filter(isShown)
        .map(record => toEntry(record, 'subCategory'))
    );
  }
}
