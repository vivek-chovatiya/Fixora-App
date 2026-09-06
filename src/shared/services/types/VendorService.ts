/**
 * VendorService
 *
 * The only route to the vendors a customer may choose from.
 *
 * ⚠️ Read-only, and narrower than it looks. PROJECT_BIBLE.md section 18A.1 puts
 * eligibility, service-area calculation, ranking, availability, assignment and
 * first-accept-wins entirely with the backend, and section 18A.2 leaves the
 * frontend three jobs: present the list exactly as it arrives, capture the
 * customer's selection or the absence of one, and render the result. So there is
 * one method, it takes no filter, and it promises an order this application must
 * not change.
 *
 * Nothing here can be computed. Every field below is something the backend
 * states — a distance it worked out, an availability it knows, a rating it
 * holds — because section 18A.3 says display only what the backend provides and
 * infer none of it.
 *
 * Choosing a vendor is not a call. Section 18A.6 leaves it open whether the
 * choice rides on the create-request payload or is a second call against a
 * created request; this contract stays out of that question by only ever
 * listing. The chosen identifier travels on `CreateRequestInput.vendorId`.
 */

/**
 * One vendor, as offered to a customer.
 *
 * The fields are section 18A.3's list and nothing else. Every one but the
 * identity is optional, because that section describes what a list item
 * *typically* shows — a backend that returns a name and no rating is returning
 * a valid vendor, not an incomplete one.
 */
export interface EligibleVendor {
  /** Backend identifier. The only value that ever travels back. */
  id: string;

  /** Display name. Rendered, never compared against or used as an identity. */
  name: string;

  /** Backend-supplied image. Absent is normal; the avatar falls back to initials. */
  imageUrl?: string;

  /**
   * The backend's rating, on the backend's scale.
   *
   * Not averaged, weighted or rounded here beyond what it takes to draw it. A
   * frontend that computed a rating would be publishing a different number from
   * the one the vendor is judged by.
   */
  rating?: number;

  /** How many reviews the rating rests on. Renders beside it or not at all. */
  reviewCount?: number;

  /**
   * Where the vendor is, in the backend's words — an area name, a distance, a
   * travel time. A label rather than coordinates: section 18A.1 forbids
   * computing distance client-side, and a label cannot be recomputed by accident.
   */
  areaLabel?: string;

  /**
   * Whether the vendor can take work, in the backend's words.
   *
   * A string for the same reason as the area: "available today" and "busy until
   * Thursday" are the backend's judgements, and a boolean here would invite the
   * app to write its own sentence for a state it does not understand.
   */
  availabilityLabel?: string;
}

export interface VendorService {
  /**
   * The vendors the backend considers eligible for this service, in its order.
   *
   * ⚠️ The order *is* the recommendation (section 18A.2). Never sort, rank,
   * filter or re-order the result.
   *
   * Both identifiers are sent because the service and the category it sits in
   * can each bear on who is eligible — which is the backend's business, not
   * this app's, so it is given everything it was given.
   *
   * An empty list is a normal answer, not an error. Section 18A.4 is explicit
   * that neither an empty list nor a failed one may block submission: the
   * customer proceeds on open dispatch.
   */
  listEligibleVendors(categoryId: string, subCategoryId: string): Promise<EligibleVendor[]>;
}
