/**
 * CategoryService
 *
 * The only route to service categories.
 *
 * Categories are business data owned by the backend (PROJECT_BIBLE.md section
 * 11). The application must render a category it has never heard of, and adding
 * a new service must never require a release — so nothing here, and nothing
 * consuming it, may contain a category name, a fixed list, or a mapping keyed by
 * one.
 *
 * `iconGlyph` is deliberately an opaque string rather than a theme icon token:
 * the backend chooses it and `DynamicIcon` falls back safely when it is missing
 * or unrecognised.
 *
 * Sub-categories are absent. Nothing in the current stage needs them, and
 * speculating a shape the backend has not defined would be inventing a contract.
 */

export interface ServiceCategory {
  /** Backend identifier. The only value the app ever sends back. */
  id: string;
  /** Display name. Rendered, never compared against or branched on. */
  name: string;
  description?: string;
  /** Backend-supplied glyph name for DynamicIcon. */
  iconGlyph?: string;
}

export interface CategoryService {
  /**
   * Lists the categories a vendor may register under, and a customer may browse.
   *
   * Visibility is decided by the backend, so the app shows exactly what it is
   * given, in the order it is given.
   */
  listServiceCategories(): Promise<ServiceCategory[]>;
}
