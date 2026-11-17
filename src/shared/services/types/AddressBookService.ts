/**
 * AddressBookService
 *
 * The customer's reusable addresses (PROJECT_BIBLE.md section 18: "Phase 1
 * supports: address selection, address display, add address, edit address,
 * delete address, default address", reached from section 25's Manage Addresses
 * and section 26's Addresses route).
 *
 * ⚠️ Its own service, never methods on `AddressService`. That one is a
 * gazetteer: stateless, unaware of who is asking, and its job is turning text
 * or a coordinate into candidates. This one owns a customer's collection —
 * scoped, persisted, ordered, with exactly one default. Putting CRUD on the
 * gazetteer would make one interface answer two unrelated questions and give
 * the search service a customer it has no business knowing about.
 *
 * ⚠️ Every mutation returns the whole list, not an acknowledgement or the one
 * record it touched. Saving an address can change others — setting a default
 * clears the previous one, deleting a default promotes another — so a caller
 * that got back a single record would have to recompute the rest and would
 * become a second authority on ordering and defaults. Handing back the
 * collection keeps that authority where the data is, which is the same reason
 * `ProfileService` returns the whole `AuthUser` (Phase 3D-8).
 *
 * ⚠️ No `getAddress(id)`. The list is a customer's own addresses, it is already
 * in hand wherever one is edited, and a fetch-by-id would exist only to be
 * called by a screen that already had the record.
 *
 * ⚠️ A saved address is not a request's address. `SavedAddress` is deliberately
 * not `RequestAddress & { … }`: they have different lifetimes and different
 * required fields — `isDefault` is meaningless on a sent request — and a shared
 * type would drag the address book into a payload that is already agreed. A
 * request copies the fields it needs and refers to no record, so editing or
 * deleting a saved address can never alter a request already submitted.
 */

/**
 * One address the customer has kept.
 *
 * Deliberately without a label. Section 18's Phase 1 list has none, and section
 * 63 puts Home / Office / Other in Phase 2 along with map selection; adding one
 * here would be building Phase 2 early (owner decision, 2026-09-29).
 *
 * Deliberately without timestamps. Nothing displays or sorts by them —
 * insertion order in the stored collection is what ordering needs — and a field
 * nobody reads is a field that silently rots.
 */
export interface SavedAddress {
  /** This collection's own handle. Never sent with a request. */
  id: string;

  /**
   * The address as a person would write it, and the only part always present.
   *
   * The same guarantee `RequestAddress.formattedAddress` gives, so converting
   * one to the other needs no defaulting.
   */
  formattedAddress: string;

  /** Street and building, when the source separated them out. */
  addressLine?: string;
  /** Town or city, when the source named it. */
  locality?: string;
  postalCode?: string;

  /**
   * Exactly one address in a non-empty collection has this.
   *
   * The service owns it. Nothing above the service flips a flag itself, because
   * "exactly one" is a property of the collection and cannot be maintained one
   * record at a time.
   */
  isDefault: boolean;

  /**
   * Carried from the source, never typed and never shown.
   *
   * ⚠️ Section 63 puts GPS coordinates in Phase 2, and nothing here builds a map
   * or a coordinate picker. These are preserved only so that a request made from
   * a saved address is exactly as precise as one chosen fresh from the same
   * suggestion (owner decision, 2026-09-29) — dropping them would quietly make
   * the address book the worse way to book a visit.
   */
  placeId?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * What a customer supplies to save or change one.
 *
 * `isDefault` is absent on purpose: which address is default is changed through
 * `setDefaultAddress`, so that saving an edit can never quietly move it.
 */
export type SavedAddressInput = Omit<SavedAddress, 'id' | 'isDefault'>;

export interface AddressBookService {
  /**
   * The customer's addresses: the default first, then insertion order.
   *
   * Empty is an ordinary answer, not a failure — every customer starts here.
   */
  listAddresses(): Promise<SavedAddress[]>;

  /** Adds one. The first address saved becomes the default. */
  createAddress(input: SavedAddressInput): Promise<SavedAddress[]>;

  /**
   * Replaces one address's fields, leaving which address is default alone.
   *
   * Rejects with `notFound` when the id is not the customer's.
   */
  updateAddress(id: string, input: SavedAddressInput): Promise<SavedAddress[]>;

  /**
   * Removes one.
   *
   * Deleting the default promotes the most recently added of those that remain;
   * deleting the last leaves an empty collection and no default.
   */
  deleteAddress(id: string): Promise<SavedAddress[]>;

  /** Makes one the default and clears the flag from every other. */
  setDefaultAddress(id: string): Promise<SavedAddress[]>;
}
