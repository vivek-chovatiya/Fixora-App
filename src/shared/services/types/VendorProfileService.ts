/**
 * VendorProfileService
 *
 * The vendor's business profile (PROJECT_BIBLE.md section 38; Phase 3E-1's
 * "Vendor Profile Setup").
 *
 * ⚠️ Separate from `AuthService` and `ProfileService`. Authentication proves who
 * the vendor is; `ProfileService` edits the account holder's own name. This is
 * the business — what customers will be shown and what requests are matched
 * against — and it will be its own endpoint.
 *
 * ⚠️ Contact details are read, never written, here. The owner's name, phone and
 * email belong to the account, and the session is the one place this app keeps
 * the account (constitution section 12: never two answers). The profile carries
 * them so a screen can show them beside the business, but `VendorProfileUpdate`
 * has no field for them — changing the phone is changing which account this is
 * (section 7A), and that is not this phase.
 *
 * ⚠️ Whether setup is finished is the service's answer, not the app's guess.
 * A real backend may already hold the business name and categories captured at
 * registration and still consider setup incomplete, or the reverse; the app
 * asks, and routes on what it is told.
 *
 * ⚠️ Shop images (section 38's "Shop Images" and "Upload Shop Images") have
 * their own call, `updateShopImages`, and are never part of
 * `VendorProfileUpdate`. The profile form saves the business as a whole — an
 * absent field there means "cleared" — so a list carried by it would be wiped
 * by every form that did not know about it. Each change to the photographs is
 * saved as it is made, from its own screen; the form never touches them.
 *
 * ⚠️ Availability and working hours (section 38's "Availability", "Working
 * Hours" and "Manage Availability") follow the same rule for the same reason:
 * `setAcceptingRequests` and `updateWorkingHours` are their only ways in, and
 * neither is part of `VendorProfileUpdate`, so saving the form leaves both as
 * they were. Both are the backend's to act on (section 18A.1 puts availability
 * with the backend): the app records them and shows them, and decides nothing
 * from them — it never filters, hides or refuses a request because of either.
 */

/**
 * Ceilings, in characters. They stop absurd input, nothing more — section 38
 * sets none, and the backend's own limits are the authority once they exist.
 * The business name matches registration's, so a name accepted there is never
 * refused here.
 */
export const VENDOR_BUSINESS_NAME_MAX_LENGTH = 80;
export const VENDOR_DESCRIPTION_MAX_LENGTH = 500;
export const VENDOR_SERVICE_AREA_MAX_LENGTH = 200;

/**
 * Where the vendor takes work — section 38's "Working Areas", as a foundation.
 *
 * ⚠️ A sentence the vendor writes ("Koramangala, HSR Layout and Indiranagar"),
 * held in an object rather than as a bare string so the day matching needs
 * structure — localities, a centre and a radius, a polygon — those fields are
 * added beside `description` without changing what is already stored. No GPS,
 * no map and no radius now: matching is the backend's (section 18A.1), and
 * nothing in Phase 1 reads more than this.
 */
export interface VendorServiceArea {
  description: string;
}

/**
 * The days of a working week the app knows, in the order a week is always
 * sent, stored and shown: Monday first (section 38's "Working Hours").
 *
 * ⚠️ Not the type of `VendorWorkingDay.day`, which is a plain string, for the
 * reason `TEAM_MEMBER_STATUS` gives: the backend owns the vocabulary, and a
 * value the app has never seen must be shown plainly by the presentation table
 * (`workingHoursPresentation.ts`), not crash it. These are what the app sends
 * and what the mock checks against.
 */
export const VENDOR_WORKING_DAYS = Object.freeze([
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
  'SUN',
] as const);

/**
 * A time of day on the working-hours contract: `HH:mm`, 24-hour, zero-padded
 * ("09:00", "19:30"). Zero-padded is what lets two of them be compared as
 * text — "09:00" is before "19:00" both as a time and as a string.
 */
export const VENDOR_WORKING_TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * One day of the vendor's usual week.
 *
 * ⚠️ The times are present exactly when the day is open, and closing comes
 * after opening on the same day: Phase 1 has no overnight shift (a day that
 * runs past midnight cannot be written down), and no breaks within a day. Both
 * are the business's own local time, as the vendor would say them.
 */
export interface VendorWorkingDay {
  /** One of `VENDOR_WORKING_DAYS` — a plain string, see there. */
  day: string;
  isOpen: boolean;
  /** `HH:mm`, 24-hour. Only when open. */
  opensAt?: string;
  /** `HH:mm`, 24-hour, after `opensAt`. Only when open. */
  closesAt?: string;
}

export interface VendorProfile {
  vendorId: string;

  /** Empty until setup has been saved at least once. */
  businessName: string;
  description?: string;
  /** Backend category identifiers. Never names (section 11). */
  serviceCategoryIds: string[];
  serviceArea?: VendorServiceArea;
  /**
   * The business's picture, once one is uploaded. A remote URL, never a local
   * file — the same rule as `AuthUser.avatarUrl`, for the same reason.
   */
  imageUrl?: string;
  /**
   * Photographs of the shop, the van or the work (section 38), in the order
   * the vendor sees them. Remote URLs only, as `imageUrl`. Always a list —
   * empty, never absent, for a vendor who has added none — at most
   * `AppConfig.image.maxShopImagesPerVendor` long, no URL twice. Changed only
   * through `updateShopImages`.
   */
  shopImageUrls: string[];

  /**
   * Whether the vendor is taking new requests (section 38's "Availability").
   *
   * ⚠️ The backend's to act on, never the app's: false means the backend stops
   * offering this vendor new requests — not recommended to a customer, not
   * sent open requests, not chosen directly. Work already accepted is not
   * affected and can still be started and completed. A new vendor starts
   * accepting. Changed only through `setAcceptingRequests`.
   */
  acceptingRequests: boolean;
  /**
   * The vendor's usual week (section 38's "Working Hours"): always seven days,
   * `VENDOR_WORKING_DAYS` in that order. Information the backend may use for
   * matching and a customer may later see — the app never enforces it, so a
   * vendor who is accepting is offered work at any hour. Changed only through
   * `updateWorkingHours`.
   */
  workingHours: VendorWorkingDay[];

  /** From the account. Read-only here; see the header. */
  ownerName: string;
  phone: string;
  email?: string;

  /** The service's answer to "has this vendor finished setting up". */
  isSetupComplete: boolean;
}

/**
 * Everything the setup form submits, as a whole.
 *
 * An absent optional field means the vendor cleared it, not "leave it alone" —
 * the form always sends the full set, as Edit Profile does.
 *
 * ⚠️ No shop images, deliberately (see the header): saving the form leaves them
 * exactly as they are.
 */
export interface VendorProfileUpdate {
  businessName: string;
  description?: string;
  serviceCategoryIds: string[];
  serviceArea?: VendorServiceArea;
  imageUrl?: string;
}

export interface VendorProfileService {
  /**
   * The signed-in vendor's profile.
   *
   * A vendor who has never saved one still gets a profile — their contact
   * details, empty business fields and `isSetupComplete: false` — so "not set
   * up yet" is an answer rather than an error.
   */
  getProfile(): Promise<VendorProfile>;

  /**
   * Replaces the business fields and returns the whole stored profile.
   *
   * Rejects with `validation` when the values are refused, and `unauthorized`
   * without a signed-in vendor.
   */
  saveProfile(input: VendorProfileUpdate): Promise<VendorProfile>;

  /**
   * Replaces the shop images with exactly this list, in this order, and
   * returns the whole stored profile. Adding one is the current list plus its
   * URL; removing one is the current list without it. No vendor id: whose
   * images they are is the session's.
   *
   * Every URL must already be uploaded (`ImageService`) — never a local file.
   * Rejects with `validation` for more than the ceiling, an entry that is not
   * an uploaded URL, or the same URL twice; `notFound` when the vendor has no
   * business profile to keep them on yet; `unauthorized` without a signed-in
   * vendor. A refusal changes nothing.
   */
  updateShopImages(imageUrls: string[]): Promise<VendorProfile>;

  /**
   * Turns new requests on or off and returns the whole stored profile. No
   * vendor id: whose availability it is is the session's. Asking for the value
   * already stored succeeds and changes nothing.
   *
   * Rejects with `validation` for anything but `true` or `false`; `notFound`
   * when the vendor has no business profile yet; `unauthorized` without a
   * signed-in vendor. A refusal changes nothing.
   */
  setAcceptingRequests(accepting: boolean): Promise<VendorProfile>;

  /**
   * Replaces the usual week with exactly these days and returns the whole
   * stored profile. Session-scoped, as above.
   *
   * Rejects with `validation` unless it is the seven `VENDOR_WORKING_DAYS` in
   * that order, each open day with an `opensAt` and a later `closesAt` in
   * `VENDOR_WORKING_TIME_FORMAT`, and each closed day with neither; `notFound`
   * when the vendor has no business profile yet; `unauthorized` without a
   * signed-in vendor. A refusal changes nothing.
   */
  updateWorkingHours(days: VendorWorkingDay[]): Promise<VendorProfile>;
}
