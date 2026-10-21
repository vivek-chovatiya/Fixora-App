/**
 * The completion rules, on their own.
 *
 * These decide whether a customer may reach the summary and where a returning
 * one is put back, so they are tested directly rather than only through the
 * screens that ask them. The distinction that matters most is between a vendor
 * question not yet asked and one answered with "nobody": the second is a
 * complete request and the first must never be allowed to become one.
 *
 * The service address has no equivalent of "nobody". A request with nowhere to
 * send anyone is not a request, so there is no state here that means "asked and
 * declined" — only present and absent.
 */

import {
  completionOf,
  isDraftWorthKeeping,
  NO_VENDOR_CHOICE,
  type RequestDraft,
} from '@/features/customer/state/requestDraft';

const EMPTY: RequestDraft = {
  categoryId: 'cat_1',
  subCategoryId: 'sub_1',
  values: { priority: '', preferredDate: '', preferredTime: '', notes: '' },
  imageUrls: [],
  address: null,
  vendor: NO_VENDOR_CHOICE,
};

const ADDRESS = { formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095' };

const WITH_DETAILS: RequestDraft = { ...EMPTY, values: { ...EMPTY.values, priority: 'HIGH' } };

/** Details and a place to send somebody: everything but the vendor question. */
const WITH_ADDRESS: RequestDraft = { ...WITH_DETAILS, address: ADDRESS };

describe('completionOf', () => {
  it('sends a customer back to the details when the urgency is unanswered', () => {
    const completion = completionOf(EMPTY);

    expect(completion.isDetailsComplete).toBe(false);
    expect(completion.isReadyForReview).toBe(false);
    expect(completion.step).toBe('details');
  });

  it('sends them to the address once the details are answered', () => {
    const completion = completionOf(WITH_DETAILS);

    expect(completion.isDetailsComplete).toBe(true);
    expect(completion.isAddressComplete).toBe(false);
    expect(completion.isReadyForReview).toBe(false);
    expect(completion.step).toBe('address');
  });

  it('sends them to the vendor step once there is somewhere to send one', () => {
    const completion = completionOf(WITH_ADDRESS);

    expect(completion.isAddressComplete).toBe(true);
    expect(completion.isVendorResolved).toBe(false);
    expect(completion.isReadyForReview).toBe(false);
    expect(completion.step).toBe('vendor');
  });

  it('asks for the address before the vendor, whichever arrived first', () => {
    // Answering the vendor question without an address must not skip the
    // address: `step` is the first thing still missing, not the last thing
    // answered.
    const completion = completionOf({ ...WITH_DETAILS, vendor: { kind: 'open' } });

    expect(completion.isVendorResolved).toBe(true);
    expect(completion.isReadyForReview).toBe(false);
    expect(completion.step).toBe('address');
  });

  it('refuses an address too short for anyone to find', () => {
    const completion = completionOf({
      ...WITH_DETAILS,
      address: { formattedAddress: 'Home' },
      vendor: { kind: 'open' },
    });

    expect(completion.isAddressComplete).toBe(false);
    expect(completion.step).toBe('address');
  });

  it('does not let whitespace stand in for an address', () => {
    const completion = completionOf({
      ...WITH_DETAILS,
      address: { formattedAddress: '                    ' },
      vendor: { kind: 'open' },
    });

    expect(completion.isAddressComplete).toBe(false);
    expect(completion.step).toBe('address');
  });

  it('does not need coordinates, because a typed address has none', () => {
    /*
      The product rule, pinned. A customer who refuses location permission must
      still be able to finish, and on a device with no geocoder a typed line is
      all they can give — so requiring a latitude would make the one mandatory
      field the one the app cannot always obtain.
    */
    expect(ADDRESS).not.toHaveProperty('latitude');
    expect(ADDRESS).not.toHaveProperty('longitude');

    const completion = completionOf({ ...WITH_ADDRESS, vendor: { kind: 'open' } });

    expect(completion.isAddressComplete).toBe(true);
    expect(completion.isReadyForReview).toBe(true);
  });

  it('treats no preference as an answer, not as an unanswered question', () => {
    const completion = completionOf({ ...WITH_ADDRESS, vendor: { kind: 'open' } });

    expect(completion.isVendorResolved).toBe(true);
    expect(completion.isReadyForReview).toBe(true);
    expect(completion.step).toBe('review');
  });

  it('treats a chosen vendor as an answer too', () => {
    const completion = completionOf({
      ...WITH_ADDRESS,
      vendor: { kind: 'vendor', vendorId: 'ven_1' },
    });

    expect(completion.isReadyForReview).toBe(true);
    expect(completion.step).toBe('review');
  });

  it('does not let optional answers stand in for the required one', () => {
    const completion = completionOf({
      ...EMPTY,
      values: { ...EMPTY.values, preferredDate: '2026-09-09', notes: 'Anything' },
      imageUrls: ['https://cdn.example.test/a.jpg'],
      address: ADDRESS,
      vendor: { kind: 'open' },
    });

    expect(completion.isReadyForReview).toBe(false);
    expect(completion.step).toBe('details');
  });

  it('refuses a priority the backend never offered', () => {
    expect(completionOf({ ...EMPTY, values: { ...EMPTY.values, priority: 'URGENT' } }).step).toBe(
      'details',
    );
  });
});

describe('isDraftWorthKeeping', () => {
  it('does not remember a form that was opened and abandoned', () => {
    expect(isDraftWorthKeeping(EMPTY)).toBe(false);
  });

  it('remembers anything the customer actually said', () => {
    expect(isDraftWorthKeeping(WITH_DETAILS)).toBe(true);
    expect(
      isDraftWorthKeeping({ ...EMPTY, values: { ...EMPTY.values, notes: 'The fan rattles.' } }),
    ).toBe(true);
    expect(isDraftWorthKeeping({ ...EMPTY, imageUrls: ['https://cdn.example.test/a.jpg'] })).toBe(
      true,
    );
    expect(isDraftWorthKeeping({ ...EMPTY, vendor: { kind: 'open' } })).toBe(true);
    // An address typed and walked away from is worth coming back to, even when
    // nothing else on the form was answered.
    expect(isDraftWorthKeeping({ ...EMPTY, address: ADDRESS })).toBe(true);
  });

  it('does not mistake whitespace for a note', () => {
    expect(isDraftWorthKeeping({ ...EMPTY, values: { ...EMPTY.values, notes: '   ' } })).toBe(
      false,
    );
  });
});
