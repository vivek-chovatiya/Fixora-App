/**
 * RequestService
 *
 * The only route to a customer's service requests.
 *
 * ⚠️ Reading and raising, and one change: cancelling. PROJECT_BIBLE.md moves a
 * request through section 21 from the vendor's side (sections 33 to 36) and
 * section 34 forbids frontend-only status changes. Section 21 names `CANCELLED`
 * and section 23 a Cancelled filter without saying who cancels; the owner decided
 * on 21/10/2026 that a customer may — but only while no professional has accepted
 * the request, because before that nobody has committed any time and after it
 * cancelling means talking to the professional, which Phase 1 has no channel for.
 * The backend decides and the app shows its answer (`cancelRequest`). Nothing
 * else changes a sent request: no rescheduling, no editing. A review (section
 * 24) is its own record on `ReviewService`, never an operation here.
 * What is here is exactly what Customer Home (PROJECT_BIBLE.md
 * section 10), request creation (section 13), a request's own details screen
 * (section 20) and the history (section 23) require, shaped so the remaining
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

import type { Page, PageRequest } from '@/shared/types/pagination';

/**
 * The Phase 1 request statuses PROJECT_BIBLE.md section 21 names — its primary
 * list first, then its alternatives.
 *
 * ⚠️ The roadmap's list, not the backend's promise. No backend exists yet, so
 * this is what section 21 says the backend will send; when a real contract
 * arrives, this union is reconciled against it and nothing downstream moves.
 */
export type KnownRequestStatus =
  | 'CREATED'
  | 'PENDING_VENDOR'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CLOSED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ON_HOLD';

/**
 * A backend status: one section 21 names, or one it does not yet.
 *
 * ⚠️ Open on purpose. Section 21 says the frontend must never invent a status,
 * and a closed union would do the opposite — it would make the app the authority
 * on which statuses exist, so a state the backend added tomorrow would fail to
 * type instead of rendering safely. `string & Record<never, never>` keeps the
 * known values as the ones the editor offers without refusing a new one; the
 * feature module presents an unrecognised value as "status unavailable".
 */
export type RequestStatus = KnownRequestStatus | (string & Record<never, never>);

/**
 * One service request, as a customer sees it.
 *
 * Every field is presentation input. The app renders these, compares none of
 * them, and branches on nothing except the presence of `vendorName`.
 */
export interface CustomerRequest {
  /**
   * Backend identifier: what every call and every route carries. Never shown —
   * the real backend's is a database id, not a number anybody quotes.
   */
  id: string;

  /**
   * The reference a customer quotes (PROJECT_BIBLE.md section 19): the real
   * backend's `requestNumber` (`REQ-…`, Phase 4A, 17/11/2026); the mock's own
   * reference. Shown, copied and quoted — never sent back: routes and calls use
   * `id`. ⚠️ Absent means no reference is shown at all; a screen never falls
   * back to `id`.
   */
  reference?: string;

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
   * Backend status (PROJECT_BIBLE.md section 21), exactly as it was sent.
   *
   * ⚠️ Never a customer-facing stage. "Searching for a professional" and
   * "Awaiting professional response" are one backend status seen through two
   * dispatch modes, and section 21 is explicit that dispatch is routing, not
   * status — so nothing on this contract stores the stage. The feature module
   * derives it (`requestStateOf`) from this value and the customer's choice of
   * professional, which is what lets a real backend replace the mock without the
   * screens noticing.
   */
  status: RequestStatus;

  /**
   * Backend priority constant (PROJECT_BIBLE.md section 15). A string for the
   * same reason as `status` — the values are the backend's, and the app only
   * holds human labels for them.
   */
  priority: string;

  /** ISO 8601. Formatting is the presentation layer's business, never the API's. */
  createdAt: string;

  /**
   * Who the customer asked for, when they asked for anyone (section 18A).
   *
   * ⚠️ A preference, not an assignment. Absent means open dispatch, exactly as
   * an absent `vendorId` did on the way in. Whether anybody has *taken* the job
   * is `vendorName`'s answer — a directed request that nobody has accepted has
   * this and not that.
   *
   * On the summary as well as the full record, because a card cannot word a
   * request that is waiting without it: "searching for a professional" and
   * "awaiting the professional you chose" are one backend status seen through
   * the two dispatch modes (section 20), and a card that guessed would be wrong
   * for half of them.
   */
  preferredVendor?: RequestedVendor;
}

/**
 * The views of a customer's requests that section 23 names: All, Active,
 * Completed, Cancelled.
 *
 * ⚠️ Sent to the service by name, never applied by the app. Which statuses
 * count as "active" is the backend's to decide — it owns section 21 — and a list
 * filtered here after paging would drop records a page never contained. The mock
 * answers the way the owner confirmed on 2026-09-21; see `MockRequestService`.
 */
export type RequestHistoryFilter = 'all' | 'active' | 'completed' | 'cancelled';

/**
 * Where the work is to be done (PROJECT_BIBLE.md section 18).
 *
 * ⚠️ A frontend contract, and openly one. No backend address schema exists yet —
 * there is no endpoint, no field list and no geocoding provider in this
 * repository — so this is the smallest shape the request flow actually needs,
 * named so that nobody mistakes it for something the server has agreed to. When
 * the backend defines its own, the mapping happens where the payload is built
 * and nothing above it moves.
 *
 * ⚠️ Only `formattedAddress` is required, and that is the honest model rather
 * than a lax one. A customer typing their address on a device with no geocoder
 * has no coordinates to give, and the product rule is that a request must always
 * be completable by hand — so requiring a latitude would make the required field
 * the one the app cannot always obtain. Coordinates arrive when a provider or
 * the device supplies them, and are worth having when they do: section 18A's
 * eligibility and the nearby-professional work both start from a point.
 *
 * The structured fields are optional for the same reason. A search provider
 * returns them; a person typing a line of text does not, and inventing a city by
 * splitting their sentence on commas would be the app asserting something it was
 * never told.
 */
export interface RequestAddress {
  /**
   * The address as a person would write it, and the only part always present.
   *
   * This is what is shown, what is stored, and what a dispatcher reads. It is
   * the customer's own words when they typed it and the provider's line when
   * they chose a suggestion; either way the app never rewrites it.
   */
  formattedAddress: string;

  /**
   * WGS 84, as a device or a geocoder reports it. Both or neither.
   *
   * Never shown to the customer — a confirmation screen printing 12.9716 is a
   * screen showing its working. They exist for the backend's benefit.
   */
  latitude?: number;
  longitude?: number;

  /** Street and building, when a provider separated them out. */
  addressLine?: string;
  /** Town or city, when a provider named it. */
  locality?: string;
  postalCode?: string;

  /**
   * The provider's own handle for this place, when there was a provider.
   *
   * Carried so a later lookup can ask about the same place rather than
   * re-matching on a string. Meaningless without the provider that issued it,
   * which is why nothing in the app compares or parses it.
   */
  placeId?: string;
}

/**
 * What a customer supplies to raise a request (PROJECT_BIBLE.md section 14).
 *
 * ⚠️ Identifiers, a backend constant, and the customer's own words. Nothing
 * here is display data: the service is named by two ids the backend already
 * owns, so a renamed category changes nothing about a request already raised,
 * and the app never asserts what a category is called.
 *
 * Section 18's **address** is here now, and it is the one field on this input
 * that no backend has agreed to. It is carried as a `RequestAddress` value
 * rather than as an `addressId`, even though the customer now has a saved
 * address book (`AddressBookService`, Phase 3D-9) and can choose from it while
 * raising a request (3D-10). Choosing one copies the address by value
 * (`requestAddressFromSaved`) — never its `id` or `isDefault` — so a request
 * states where the work is, a later edit or delete in the book cannot move a
 * request already raised, and a saved address sends exactly what the same
 * address typed by hand would.
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
   * Where the work is to be done (PROJECT_BIBLE.md section 18).
   *
   * ⚠️ Required, unlike every other field added since. A request nobody can be
   * sent to is not a request, so the product rule is that every one carries a
   * location — and the way to hold the app to that is to make a payload without
   * one fail to type rather than fail in front of a customer.
   *
   * Its shape is this application's, not the backend's; see `RequestAddress`.
   */
  address: RequestAddress;

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
  /** The request's identifier, which request details is opened with. Never shown. */
  id: string;
  /**
   * The reference a customer quotes (PROJECT_BIBLE.md section 19) — see
   * `CustomerRequest.reference`. Absent means none is shown.
   */
  reference?: string;
  /**
   * The state the backend put it in. Read, never assumed: section 21 lists
   * `CREATED` first, but which state a new request lands in is the backend's
   * answer and the app's job is only to reflect it.
   */
  status: RequestStatus;
  /** ISO 8601, as set by the backend rather than by the device's clock. */
  createdAt: string;
}

/**
 * The professional a customer asked for, as a request record names them.
 *
 * Both fields or none: the identifier is what was sent, and the name is how the
 * backend reads it back. A preference with no name would be a request the app
 * could only describe by an identifier it must never show.
 */
export interface RequestedVendor {
  id: string;
  /** Rendered, never compared against or used as an identity. */
  name: string;
}

/**
 * One request in full, as its details screen shows it (PROJECT_BIBLE.md
 * section 20).
 *
 * ⚠️ An extension of `CustomerRequest`, not a second request model. Every field
 * a card shows means exactly what it means on the card, and what is added is
 * what the customer sent — `CreateRequestInput`, read back — plus the names the
 * backend resolved for it. A screen holding one of these can draw a card; a
 * screen holding a card cannot draw this.
 *
 * ⚠️ A frontend contract, like `RequestAddress`. No backend detail endpoint
 * exists yet, so nothing here is something a server has agreed to. What keeps it
 * honest is that nothing is new in kind: the identifiers and answers are the
 * ones this app already sends, and the two names below follow the precedent
 * `serviceName` and `vendorName` already set — a request read back from the
 * backend arrives named, rather than leaving the app to join it against a
 * catalogue that may have changed since it was raised.
 *
 * `serviceName` is the service itself (section 12), and `categoryName` is where
 * it was found. Status is the backend's word and nothing more; dispatch mode is
 * not a status (section 21), which is why the customer's preference is its own
 * field rather than something to be read out of `status`.
 */
export interface CustomerRequestDetails extends CustomerRequest {
  /** The category the service was chosen from. Never shown. */
  categoryId: string;
  /**
   * The service itself. Never shown. Absent when the backend's record names no
   * service inside the category — its `subCategoryId` is optional — and such a
   * request must still open (code review, 17/11/2026).
   */
  subCategoryId?: string;

  /** The category, named by the backend. */
  categoryName: string;

  /** `YYYY-MM-DD`, exactly as sent. Formatting is the screen's business. */
  preferredDate?: string;
  /** `HH:mm`, 24-hour, exactly as sent. */
  preferredTime?: string;

  /** The customer's own words, exactly as sent. */
  notes?: string;

  /** Remote URLs, as they were attached (section 16). */
  imageUrls?: string[];

  /**
   * Where the work is (section 18). Required here because it was required to
   * send: a request record without one would describe a request that could
   * never have been raised.
   */
  address: RequestAddress;

  /**
   * What the professional recorded about payment when they completed the job
   * (sections 36 and 37). Absent until then, and absent on work completed
   * without one — the screen says nothing about payment rather than guessing.
   */
  payment?: CustomerPaymentRecord;
}

/**
 * The payment on a completed request, as the professional recorded it.
 *
 * ⚠️ Recorded, never processed (section 37). Fixora took no money and
 * confirmed none: this is what the professional said happened, and the
 * customer is shown it as theirs. A frontend contract, like the rest of the
 * details record — no backend has agreed to it.
 *
 * Less than the professional's own record: no method id, and none of their
 * completion notes, which are the professional's working notes rather than a
 * message to the customer.
 */
export interface CustomerPaymentRecord {
  /** The total the job came to, in whole minor units (paise). */
  finalAmountMinor: number;
  /** ISO 4217 code. How it is written is `shared/presentation/money`'s. */
  currency: string;
  /** The backend's word — `PAID` or `UNPAID` today — shown through `describePayment`. */
  paymentStatus: string;
  /** How it was paid, in words, when it was. */
  paymentMethodLabel?: string;
}

/**
 * Why a cancellation was not made: the request is no longer in a status the
 * customer may cancel from — most often because a professional accepted it
 * between the customer seeing it and pressing Cancel.
 *
 * A business answer, not a fault (PROJECT_BIBLE.md section 49.1): the right
 * response is to say so calmly and read the request again.
 */
export type CancelRequestRefusal = 'notCancellable';

/**
 * What a cancellation came to.
 *
 * ⚠️ A result, not a guess. On success the record comes back as the service now
 * holds it — `CANCELLED` and all — and that is what the app shows; the app never
 * marks a request cancelled on its own (section 34). A refusal carries no
 * record: the app reads the request again to learn where it went.
 *
 * Faults are not results. A missing session rejects with `unauthorized`, a
 * reference that is not this customer's with `notFound` (exactly as
 * `getRequest` answers `null` for one — somebody else's request cannot be
 * cancelled, and its existence is not confirmed either), and anything that
 * stopped the cancellation being recorded with the failure's own kind. None of
 * them changed anything.
 */
export type CancelRequestResult =
  | { outcome: 'cancelled'; request: CustomerRequestDetails }
  | { outcome: 'refused'; reason: CancelRequestRefusal };

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
   * The customer's requests, a page at a time, newest first (PROJECT_BIBLE.md
   * section 23: "Pagination must be supported").
   *
   * The shared `Page` contract rather than one of its own, so the history
   * screen pages exactly the way every other list will. `filter` is one of the
   * section 23 views, by name; the implementation decides what it matches.
   *
   * A page past the last one resolves empty rather than rejecting — asking one
   * page too far is what a list does when the last request was just the
   * boundary. Summaries only: the full record is `getRequest`'s.
   */
  listRequests(filter: RequestHistoryFilter, request: PageRequest): Promise<Page<CustomerRequest>>;

  /**
   * One of the customer's requests, in full (PROJECT_BIBLE.md section 20).
   *
   * ⚠️ Resolves `null` when there is no such request for this customer, and
   * rejects only when the question could not be answered. They are different
   * outcomes with different screens: an unknown reference is an answer — the
   * customer followed a stale link — and offering to retry it would be offering
   * to fail again, while a dropped connection is not an answer at all. A 404
   * becomes `null` in the implementation that sees one, so no caller has to pick
   * it back out of an error.
   *
   * By identifier only. Scope is the session's, as it is for every call here,
   * so a reference belonging to somebody else is simply not found.
   */
  getRequest(requestId: string): Promise<CustomerRequestDetails | null>;

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

  /**
   * Cancels one of the customer's requests, while nobody has accepted it (owner
   * decision, 21/10/2026; section 21's `CANCELLED`).
   *
   * Only a request still waiting for a professional — `CREATED` or
   * `PENDING_VENDOR` — can be cancelled; anything later is refused with
   * `notCancellable`, which is how the race with a professional accepting it is
   * answered. No reason is asked for or sent (Phase 1 keeps it simple).
   *
   * ⚠️ One already cancelled answers `cancelled`, unchanged, rather than being
   * refused. The case is a cancellation whose answer was lost and is sent again:
   * the customer got what they asked for, and refusing would tell them a
   * professional had accepted a request that is in fact cancelled. A frontend
   * assumption, like the rest of this contract, for the backend to confirm.
   *
   * By identifier only, scoped by the session like every call here.
   */
  cancelRequest(requestId: string): Promise<CancelRequestResult>;
}
