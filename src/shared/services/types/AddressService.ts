/**
 * AddressService
 *
 * Turning what somebody types, or where their phone is, into an address the
 * request can carry.
 *
 * ⚠️ This is the seam a real provider plugs into. There is no maps SDK and no
 * geocoding key in this repository, and one is not introduced to finish this
 * phase — so the shipped implementation is a mock, and the point of the
 * interface is that replacing it changes this one file's neighbour and nothing
 * above it. The screen, the hook, the draft and the payload are all written
 * against these two methods.
 *
 * ⚠️ It never decides that an address is good enough. Whether a request may
 * proceed is `completionOf`'s answer, from the draft; this only supplies
 * candidates. A service that also validated would be a second authority on
 * completeness, which is the thing the draft exists to prevent.
 *
 *   Screen → hook → AddressService interface → implementation
 *
 * `LocationService` is the other half and stays separate: that one reads the
 * device, this one reads a gazetteer.
 */

import type { Coordinates } from '@/shared/services/types/LocationService';
import type { RequestAddress } from '@/shared/services/types/RequestService';

/**
 * One candidate the customer may choose.
 *
 * Split into what a row shows and what a request would carry, because they are
 * genuinely different: a list needs a short line and a quieter second line, and
 * the request needs every field the provider knew. Rendering `formattedAddress`
 * in a row works until the row is a full postal address on two lines with a
 * postcode, at which point a list of five is unreadable.
 */
export interface AddressSuggestion {
  /**
   * The provider's own handle, used as the list key.
   *
   * Opaque. Nothing in the app parses, compares or stores it as an identity —
   * it travels into `RequestAddress.placeId` and is meaningless without the
   * provider that issued it.
   */
  id: string;

  /** The line that names the place: a building, a street, a landmark. */
  label: string;

  /** Where it is, in fewer words. Absent when the label already says it. */
  detail?: string;

  /** What goes into the draft, and eventually the payload, if this is chosen. */
  address: RequestAddress;
}

export interface AddressService {
  /**
   * Candidates for what the customer has typed so far.
   *
   * Returns an empty list for a query with no matches, which is an ordinary
   * answer and not a failure — the screen says so and leaves the typed text
   * usable, because a customer whose village the gazetteer has never heard of
   * must still be able to book a plumber.
   *
   * Ordering is the provider's. The app does not re-rank: relevance is what a
   * geocoder is for, and a client-side sort would be this application asserting
   * it knows the area better.
   */
  searchAddresses(query: string): Promise<AddressSuggestion[]>;

  /**
   * The address at a point — reverse geocoding.
   *
   * Rejects when the point cannot be described, which a caller treats the same
   * way as having no point at all: fall back to typing. Resolving something
   * vague would be worse than resolving nothing, because the customer would
   * then have to notice it was wrong.
   */
  describeCoordinates(coordinates: Coordinates): Promise<AddressSuggestion>;
}
