/**
 * useSavedAddresses
 *
 * The customer's saved addresses, offered while a request is being raised
 * (PROJECT_BIBLE.md section 18: "address selection" — the step Phase 3D-9 built
 * the address book for and deliberately left unwired).
 *
 *   ServiceAddressScreen / ChooseSavedAddressScreen → hook → AddressBookService
 *
 * ⚠️ Read-only. Nothing here adds, edits, deletes or changes the default — the
 * book is managed from Profile (`useAddressBook`), and a request flow that could
 * rewrite somebody's saved addresses would be a second, unasked-for way in.
 *
 * ⚠️ A saved address enters a request by value, never by reference. `choose`
 * copies the fields a `RequestAddress` has into the draft and nothing else: no
 * `id` (the book's own handle, meaningless to the request contract) and no
 * `isDefault`. So the payload a chosen address produces is shaped exactly like
 * one chosen from a suggestion, and editing or deleting the saved record later
 * can never alter a request already sent. Nothing in `CreateRequestInput`
 * changed for this.
 *
 * ⚠️ Optional, always. Typing an address is the screen's primary path and must
 * never wait on, or be blocked by, the book: `hasAny` is false while the first
 * read is in flight, when no read has succeeded yet and when the book is empty,
 * and in every one of those cases the Service Address screen simply offers
 * nothing extra. A failed
 * read is logged by the query (`useServiceQuery`) and otherwise kept out of the
 * way; only the picker, which the customer opened on purpose, shows it.
 *
 * ⚠️ Read again whenever the screen comes back into focus. Found in review:
 * Service Address stays mounted under the vendor and summary screens, so a
 * first read that failed used to hide the offer for the rest of the visit with
 * no way back. Now every return reads again — as a refresh, so an offer already
 * on screen stays put while it does, and a re-read that fails keeps the list it
 * had rather than withdrawing a button the customer may be reaching for. Focus
 * comes from the navigation context (`useNavigationEvent`) rather than
 * `useFocusEffect`, which throws without a navigator: screen tests render
 * without one, and there the book is read once.
 */

import { useCallback, useMemo } from 'react';

import { useRequestDraft } from '@/features/customer/state/RequestDraftContext';
import { useNavigationEvent } from '@/shared/hooks/useNavigationEvent';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { SavedAddress } from '@/shared/services/types/AddressBookService';
import type { RequestAddress } from '@/shared/services/types/RequestService';
import type { AppError } from '@/shared/types/error';

/**
 * A saved address as a request's address: the fields the two share, copied.
 *
 * The same shape a chosen suggestion gives (`AddressSuggestion.address`) and
 * the same rules as the address book's own form: a detail field is carried only
 * when it holds something, and coordinates only as a pair. An absent field stays
 * absent — never `undefined` written in, never an empty string — so the address
 * that reaches the payload says exactly what was known and nothing more.
 *
 * Exported for its test: what crosses from the book into a request is the part
 * of this worth pinning down.
 */
export function requestAddressFromSaved(saved: SavedAddress): RequestAddress {
  const { formattedAddress, addressLine, locality, postalCode, placeId, latitude, longitude } =
    saved;

  return {
    formattedAddress,
    ...(addressLine ? { addressLine } : {}),
    ...(locality ? { locality } : {}),
    ...(postalCode ? { postalCode } : {}),
    ...(placeId ? { placeId } : {}),
    ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
  };
}

/**
 * Every field a `RequestAddress` can carry.
 *
 * A record rather than a list so the compiler holds it to the type: a field
 * added to `RequestAddress` and not here fails type-check instead of being
 * silently left out of the comparison below.
 */
const REQUEST_ADDRESS_FIELDS: Readonly<Record<keyof RequestAddress, true>> = {
  formattedAddress: true,
  addressLine: true,
  locality: true,
  postalCode: true,
  placeId: true,
  latitude: true,
  longitude: true,
};

/**
 * Whether the draft holds this saved address, unchanged.
 *
 * Compared by value, field by field, because the request keeps no reference to
 * the record it came from — that is the point of copying it. Retyping the line
 * afterwards makes it a different address, and it stops matching.
 */
export function holdsSavedAddress(
  address: RequestAddress | null | undefined,
  saved: SavedAddress,
): boolean {
  if (!address) {
    return false;
  }

  const copy = requestAddressFromSaved(saved);
  return (Object.keys(REQUEST_ADDRESS_FIELDS) as Array<keyof RequestAddress>).every(
    field => copy[field] === address[field],
  );
}

export interface SavedAddresses {
  /** The book, default first, in the service's order. Undefined until the first read answers. */
  addresses: SavedAddress[] | undefined;
  isLoading: boolean;
  /** The read failed. Shown only by the picker; the address screen just offers nothing. */
  error: AppError | null;
  retry: () => void;
  /**
   * At least one to offer. False during the first read, when no read has yet
   * succeeded, and when there are none; a later re-read that fails keeps it.
   */
  hasAny: boolean;
  /** The saved address the draft holds, unchanged, if it holds one. */
  chosenId: string | null;
  /** Copies one into the draft as its service address, exactly as if it had been picked by hand. */
  choose: (address: SavedAddress) => void;
}

export function useSavedAddresses(): SavedAddresses {
  const query = useServiceQuery<SavedAddress[]>(
    useCallback(() => getService('addressBook').listAddresses(), []),
    [],
  );
  const { refresh } = query;

  // Again on every return, but not on arrival: the query has just read it.
  useNavigationEvent('focus', refresh, { onlyOnReturn: true });

  const { draft, updateDraft } = useRequestDraft();

  const choose = useCallback(
    (address: SavedAddress) => {
      updateDraft({ address: requestAddressFromSaved(address) });
    },
    [updateDraft],
  );

  const current = draft?.address;
  const chosenId = useMemo(
    () => query.data?.find(saved => holdsSavedAddress(current, saved))?.id ?? null,
    [query.data, current],
  );

  return {
    addresses: query.data,
    isLoading: query.isLoading,
    error: query.error,
    retry: query.retry,
    // Read off the list, not the last call: `data` is only ever a successful
    // answer, and a failed refresh leaves it as it was.
    hasAny: !query.isLoading && (query.data?.length ?? 0) > 0,
    chosenId,
    choose,
  };
}
