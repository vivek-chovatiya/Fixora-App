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
 * Sub-categories live here rather than in a service of their own. They are the
 * same catalogue owned by the same backend concern — a category and the services
 * inside it are one table's worth of thinking — and a second service would mean
 * a second registration, a second mock and a second place for the catalogue to
 * drift.
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

/**
 * One service inside a category (PROJECT_BIBLE.md section 12).
 *
 * Deliberately the same shape as the category above it. Section 12 gives the
 * relationship and the rule — the backend decides what is in a category, and the
 * app renders whatever comes back — but names no fields of its own, so mirroring
 * the parent entity is the smallest honest reading of it. A field invented here
 * is a field the app would have to guess the meaning of.
 */
export interface SubCategory {
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

  /**
   * The services inside one category, in the order the backend returns them.
   *
   * Keyed by id, which is the whole point: PROJECT_BIBLE.md section 12 forbids
   * service-specific screens and, by extension, any client-side map from a
   * category to what is inside it. The app asks; it never works it out.
   *
   * A category with nothing in it is a normal answer, not an error.
   */
  listSubCategories(categoryId: string): Promise<SubCategory[]>;
}
