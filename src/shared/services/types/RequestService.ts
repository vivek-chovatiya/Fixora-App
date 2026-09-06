/**
 * RequestService
 *
 * The only route to a customer's service requests.
 *
 * ⚠️ Reading and raising, and nothing else. Updating, cancelling and reviewing a
 * request all belong to the lifecycle work that has not started; adding those
 * methods now would mean inventing their contracts before the screens that need
 * them exist. What is here is exactly what Customer Home (PROJECT_BIBLE.md
 * section 10) and request creation (section 13) require, shaped so the remaining
 * operations can be added beside them rather than instead of them.
 *
 * The fields are the ones the roadmap already fixes — section 23 defines what a
 * request card shows, section 20 what its detail screen shows, section 14 what a
 * customer supplies. Nothing is invented here: a field the backend has not been
 * asked for is a field the app would have to guess the meaning of.
 *
 * Scope comes from the session, not from a parameter. The backend knows who is
 * asking, so passing a customer id would be the app asserting an identity it
 * does not own (PROJECT_BIBLE.md section 52).
 */

/**
 * One service request, as a customer sees it.
 *
 * Every field is presentation input. The app renders these, compares none of
 * them, and branches on nothing except the presence of `vendorName`.
 */
export interface CustomerRequest {
  /** Backend identifier, shown as the reference a customer can quote. */
  id: string;

  /** The service asked for. Rendered, never matched against a known list. */
  serviceName: string;

  /**
   * The assigned vendor, once there is one.
   *
   * Absent before assignment, which is a normal state rather than missing data:
   * a request in open dispatch has no vendor yet, and one waiting on a chosen
   * vendor has not been accepted (PROJECT_BIBLE.md section 20).
   */
  vendorName?: string;

  /**
   * Backend status. A plain string on purpose.
   *
   * Section 21 lists the Phase 1 states and says the frontend must never invent
   * one. A union here would do the opposite of what that asks: it would make the
   * app the authority on which statuses exist, and a status added by the backend
   * would fail to type rather than simply render. The feature module keeps copy
   * for the states it knows and falls back safely for the rest.
   */
  status: string;

  /**
   * Backend priority constant (PROJECT_BIBLE.md section 15). A string for the
   * same reason as `status` — the values are the backend's, and the app only
   * holds human labels for them.
   */
  priority: string;

  /** ISO 8601. Formatting is the presentation layer's business, never the API's. */
  createdAt: string;
}

/**
 * What a customer supplies to raise a request (PROJECT_BIBLE.md section 14).
 *
 * ⚠️ Identifiers, a backend constant, and the customer's own words. Nothing
 * here is display data: the service is named by two ids the backend already
 * owns, so a renamed category changes nothing about a request already raised,
 * and the app never asserts what a category is called.
 *
 * One field section 14 lists is deliberately absent, and its absence is a known
 * gap rather than an oversight: section 18's **address** is a capability of its
 * own — select, add, edit, delete, default — with no service, no type and no
 * screen yet. It arrives as `addressId` beside these fields, which is why they
 * are a named input type rather than positional arguments.
 *
 * Description is folded into `notes`. Section 14 lists both, but section 17's
 * own example of a note — "the fan is making noise and stops after 10 minutes" —
 * is a description of the problem, and two free-text boxes on one form is one
 * box more than anyone fills in.
 */
export interface CreateRequestInput {
  /** The category the service was chosen from. */
  categoryId: string;
  /** The service itself (PROJECT_BIBLE.md section 12). */
  subCategoryId: string;

  /**
   * One of the backend's priority constants (PROJECT_BIBLE.md section 15).
   *
   * A string for the same reason `CustomerRequest.priority` is one: the values
   * are the backend's, and a union here would make the app the authority on
   * which ones exist. Which values a customer may choose from is a separate
   * question, answered by the feature module against section 15's list.
   */
  priority: string;

  /**
   * Preferred calendar date, `YYYY-MM-DD`. Optional.
   *
   * Section 14 marks preferred date and time as supported "if supported by
   * backend", so both are optional here — a customer with no preference is
   * expressing one, not omitting an answer.
   *
   * A date, not a timestamp: "the 9th" is a calendar day wherever the customer
   * and the vendor happen to be, and attaching a time zone to it would invent a
   * precision nobody asked for. The value is never a formatted display string.
   */
  preferredDate?: string;

  /**
   * Preferred start time, 24-hour `HH:mm`. Optional.
   *
   * A single time rather than a window. A window would mean inventing what its
   * bounds mean and how a vendor is expected to honour them, which is the
   * backend's to define if it ever does.
   */
  preferredTime?: string;

  /**
   * Remote URLs of images already uploaded through `ImageService`
   * (PROJECT_BIBLE.md section 16).
   *
   * URLs rather than files: uploading is the image service's job and finishes
   * before this call is made. That ordering is what section 16 requires — a
   * request must never appear to have been submitted with images that failed to
   * upload, and a payload that carried the files themselves would make the two
   * failures indistinguishable.
   */
  imageUrls?: string[];

  /** The customer's own description of the problem. Optional per section 17. */
  notes?: string;

  /**
   * The vendor the customer asked for, when they asked for one at all
   * (PROJECT_BIBLE.md section 18A).
   *
   * ⚠️ Its absence is the message. Section 18A describes exactly two outcomes,
   * and "no preference" is not one of the values — it is open dispatch, where
   * the backend finds eligible vendors and broadcasts to them itself. So a
   * customer who chose nobody produces a payload with no `vendorId` at all: not
   * null, not an empty string, and certainly not a sentinel like "any", each of
   * which would be this app inventing a vendor identity the backend would then
   * have to be taught to recognise.
   *
   * This answers section 18A.6's open question in favour of the single-call form
   * that section calls the assumed one — the choice rides on creation rather
   * than being a second call against a created request. If the backend turns out
   * to want the other form, 18A.6 says the UI flow is unaffected, and only this
   * field and the call behind it move.
   *
   * An identifier and nothing else. The vendor's name, rating, image and
   * availability are all things this application was shown; none of them is
   * something it may assert.
   */
  vendorId?: string;
}

/**
 * The backend's acknowledgement that a request now exists.
 *
 * Deliberately not the whole request. Section 19 needs a reference the customer
 * can quote and section 20's tracking screen fetches the rest for itself, so
 * returning a full record here would mean this call promising fields — the
 * assigned vendor, the resolved service name — that it is in no position to
 * know at the moment of creation.
 */
export interface CreatedRequest {
  /** The reference a customer can quote (PROJECT_BIBLE.md section 19). */
  id: string;
  /**
   * The state the backend put it in. Read, never assumed: section 21 lists
   * `CREATED` first, but which state a new request lands in is the backend's
   * answer and the app's job is only to reflect it.
   */
  status: string;
  /** ISO 8601, as set by the backend rather than by the device's clock. */
  createdAt: string;
}

export interface RequestService {
  /**
   * The customer's most recent requests, newest first.
   *
   * `limit` rather than a page: Home shows a short summary and then hands off to
   * the full history, so asking for a page would mean requesting — and paying
   * for — records this screen has no room to show. The paginated listing arrives
   * with the history screen that needs it, using the shared `Page` contract.
   */
  listRecentRequests(limit: number): Promise<CustomerRequest[]>;

  /**
   * Raises a request (PROJECT_BIBLE.md section 13).
   *
   * Not idempotent, and deliberately not made to look as though it were. A
   * client-generated key would be the app taking on de-duplication the backend
   * owns; the guarantee callers actually get is that the button locks itself
   * while the call is in flight (section 33.1), which is where a double submit
   * is prevented.
   */
  createRequest(input: CreateRequestInput): Promise<CreatedRequest>;
}
