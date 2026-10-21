/**
 * What crosses from the address book into a request, and what must not.
 *
 * A saved address joins a request by value. These tests pin the copy itself —
 * the exact keys it carries, and that a field the record did not have stays
 * absent rather than arriving as `undefined` or an empty string — and then the
 * one thing this feature promised not to change: the create-request payload.
 * Built from a chosen saved address it has exactly the keys of one built from
 * an address typed by hand, and the book's own `id` and `isDefault` are nowhere
 * in it.
 */

import { buildCreateRequestInput } from '@/features/customer/hooks/useCreateRequest';
import {
  holdsSavedAddress,
  requestAddressFromSaved,
} from '@/features/customer/hooks/useSavedAddresses';
import type { CreateRequestForm } from '@/features/customer/validation/requestSchemas';
import type { SavedAddress } from '@/shared/services/types/AddressBookService';
import type { RequestAddress } from '@/shared/services/types/RequestService';

/** Saved from a suggestion: everything a provider knew. */
const FROM_SUGGESTION: SavedAddress = {
  id: 'adr_book_7f3a',
  formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
  addressLine: '412, 5th Block',
  locality: 'Koramangala',
  postalCode: '560095',
  isDefault: true,
  placeId: 'place_koramangala_5th',
  latitude: 12.9352,
  longitude: 77.6245,
};

/** Saved by hand: a line of text and nothing else. */
const TYPED_BY_HAND: SavedAddress = {
  id: 'adr_book_91c2',
  formattedAddress: '17 Cross Lane, Devanahalli, Bengaluru 562110',
  isDefault: false,
};

const VALUES: CreateRequestForm = {
  priority: 'HIGH',
  preferredDate: '',
  preferredTime: '',
  notes: 'The fan rattles.',
};

function payloadFor(address: RequestAddress, vendorId?: string) {
  return buildCreateRequestInput(
    'cat_electrician',
    'sub_fan_repair',
    VALUES,
    [],
    address,
    vendorId,
  );
}

describe('requestAddressFromSaved — the copy', () => {
  it('carries every field a request address has, and nothing of the book’s', () => {
    const address = requestAddressFromSaved(FROM_SUGGESTION);

    expect(Object.keys(address).sort()).toEqual([
      'addressLine',
      'formattedAddress',
      'latitude',
      'locality',
      'longitude',
      'placeId',
      'postalCode',
    ]);
    expect(address).toEqual({
      formattedAddress: FROM_SUGGESTION.formattedAddress,
      addressLine: '412, 5th Block',
      locality: 'Koramangala',
      postalCode: '560095',
      placeId: 'place_koramangala_5th',
      latitude: 12.9352,
      longitude: 77.6245,
    });
  });

  it('never carries the record’s id or its default flag', () => {
    const address = requestAddressFromSaved(FROM_SUGGESTION);

    expect('id' in address).toBe(false);
    expect('isDefault' in address).toBe(false);
    expect(JSON.stringify(address)).not.toContain(FROM_SUGGESTION.id);
  });

  it('leaves absent what the record never had — a hand-typed one is the line alone', () => {
    const address = requestAddressFromSaved(TYPED_BY_HAND);

    // Exactly what the address screen makes of a line typed by hand.
    expect(address).toEqual({ formattedAddress: TYPED_BY_HAND.formattedAddress });
    expect(Object.keys(address)).toEqual(['formattedAddress']);
  });

  it('drops blank details rather than sending them empty', () => {
    const address = requestAddressFromSaved({
      ...TYPED_BY_HAND,
      addressLine: '',
      locality: '',
      postalCode: '',
      placeId: '',
    });

    expect(Object.keys(address)).toEqual(['formattedAddress']);
  });

  it('carries coordinates only as a pair', () => {
    const half = requestAddressFromSaved({ ...TYPED_BY_HAND, latitude: 12.9352 });
    const whole = requestAddressFromSaved({ ...TYPED_BY_HAND, latitude: 12.9352, longitude: 0 });

    expect('latitude' in half).toBe(false);
    expect('longitude' in half).toBe(false);
    // Zero is a real longitude (the prime meridian), not a missing one.
    expect(whole).toEqual({
      formattedAddress: TYPED_BY_HAND.formattedAddress,
      latitude: 12.9352,
      longitude: 0,
    });
  });

  it('copies the line exactly as stored, never rewritten', () => {
    const odd = { ...TYPED_BY_HAND, formattedAddress: 'Flat 3B,  near the  blue gate' };

    expect(requestAddressFromSaved(odd).formattedAddress).toBe('Flat 3B,  near the  blue gate');
  });
});

describe('the create-request payload, from a saved address', () => {
  it('has exactly the keys of a payload whose address was typed by hand', () => {
    const typed = payloadFor({ formattedAddress: '27, 11th Main, Jayanagar 4th Block' });
    const saved = payloadFor(requestAddressFromSaved(FROM_SUGGESTION));
    const savedByHand = payloadFor(requestAddressFromSaved(TYPED_BY_HAND));

    expect(Object.keys(saved).sort()).toEqual(Object.keys(typed).sort());
    expect(Object.keys(savedByHand).sort()).toEqual(Object.keys(typed).sort());
  });

  it('and a hand-typed saved address makes the same address a typed one does', () => {
    const typed = payloadFor({ formattedAddress: TYPED_BY_HAND.formattedAddress });
    const saved = payloadFor(requestAddressFromSaved(TYPED_BY_HAND));

    expect(saved).toEqual(typed);
  });

  it('keeps the book out of the wire entirely', () => {
    const sent = JSON.stringify(payloadFor(requestAddressFromSaved(FROM_SUGGESTION), 'ven_1'));

    expect(sent).not.toContain(FROM_SUGGESTION.id);
    expect(sent).not.toContain('isDefault');
  });

  it('leaves open dispatch as it was: no vendor chosen is still no vendorId', () => {
    const payload = payloadFor(requestAddressFromSaved(FROM_SUGGESTION));

    expect(payload.vendorId).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('vendorId');
  });
});

describe('holdsSavedAddress — is this the one the request has now', () => {
  it('is true for the saved address copied unchanged', () => {
    expect(holdsSavedAddress(requestAddressFromSaved(FROM_SUGGESTION), FROM_SUGGESTION)).toBe(true);
    expect(holdsSavedAddress(requestAddressFromSaved(TYPED_BY_HAND), TYPED_BY_HAND)).toBe(true);
  });

  it('is false once the line has been edited, or for another address', () => {
    const edited = {
      ...requestAddressFromSaved(FROM_SUGGESTION),
      formattedAddress: `${FROM_SUGGESTION.formattedAddress} — the blue gate`,
    };

    expect(holdsSavedAddress(edited, FROM_SUGGESTION)).toBe(false);
    expect(holdsSavedAddress(requestAddressFromSaved(TYPED_BY_HAND), FROM_SUGGESTION)).toBe(false);
  });

  it('is false for a typed line that merely reads the same as a richer record', () => {
    // Same words, but the record also knows a point the request does not.
    const typed = { formattedAddress: FROM_SUGGESTION.formattedAddress };

    expect(holdsSavedAddress(typed, FROM_SUGGESTION)).toBe(false);
  });

  it('is false when the request has no address yet', () => {
    expect(holdsSavedAddress(null, FROM_SUGGESTION)).toBe(false);
    expect(holdsSavedAddress(undefined, FROM_SUGGESTION)).toBe(false);
  });
});
