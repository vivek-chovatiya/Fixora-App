/**
 * Address rules
 *
 * The one question the app is qualified to answer about an address: is there
 * enough here to send somebody?
 *
 * ⚠️ Shape, never truth. Whether a street exists, whether a postcode belongs to
 * a city, whether anyone lives at number 27 — none of that is decided here, for
 * the same reason the request schemas do not decide whether a vendor is free on
 * Thursday. A client rule that guessed would reject addresses the backend and
 * the courier would both have accepted, and there is no address the app can
 * prove is real anyway.
 *
 * ⚠️ Coordinates are not required, and that is the whole design. The product
 * rule is that a customer must always be able to complete a request by hand, and
 * a person typing on a device with no geocoder and no location permission has no
 * latitude to give. Requiring one would make the mandatory field the one the app
 * cannot always obtain — which is how a required address quietly becomes a
 * required permission.
 *
 * It lives beside the request schemas because it is the customer module's
 * validation (CLAUDE.md section 16), and it is a plain predicate rather than a
 * zod schema because its only caller is `completionOf`, which asks a boolean
 * question about a stored value rather than parsing a form.
 */

import type { RequestAddress } from '@/shared/services/types/RequestService';

/**
 * Shortest thing that could plausibly be somewhere.
 *
 * A floor, not a judgement. It exists to stop a stray keystroke and a lone
 * comma counting as an address; anything long enough to be a real short address
 * — "12 MG Road" is ten — passes, and the backend remains the authority on the
 * rest. Set too high it would reject genuine short rural addresses, which is a
 * worse failure than accepting a bad one the customer can see and correct.
 */
export const ADDRESS_MIN_LENGTH = 8;

/** Ceiling, so a pasted document cannot become an address. */
export const ADDRESS_MAX_LENGTH = 240;

/**
 * Whether a draft's address is enough to proceed on.
 *
 * Takes null as well as an address, because "not answered yet" is a state the
 * draft genuinely has and every caller would otherwise have to guard for
 * separately — which is how one of them ends up forgetting.
 */
export function isUsableAddress(address: RequestAddress | null | undefined): boolean {
  if (!address) {
    return false;
  }

  const written = address.formattedAddress.trim();

  return written.length >= ADDRESS_MIN_LENGTH && written.length <= ADDRESS_MAX_LENGTH;
}
