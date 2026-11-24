/**
 * Shared user-facing copy.
 *
 * Phase 1 ships English only, but shared copy lives here so that multi-language
 * support (Phase 2) means translating this map rather than hunting through screens.
 */

export const strings = Object.freeze({
  common: {
    retry: 'Retry',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    continue: 'Continue',
    done: 'Done',
    edit: 'Edit',
    delete: 'Delete',
    loading: 'Loading…',
    somethingWrong: 'Something went wrong',
  },
  empty: {
    customerRequests: "You don't have any service requests yet.",
    reviews: 'No reviews yet.',
    team: "You haven't added any team members yet.",
    vendors: "No vendors available to show right now. You can still submit — we'll find one for you.",
    vendorNew: 'No new requests right now.',
    vendorNewHint: 'Pull down to refresh.',
    notifications: "You're all caught up.",
    addresses: 'Add an address so vendors know where to come.',
  },
  dispatch: {
    anyVendor: 'Any available vendor',
    anyVendorHint: "We'll send your request to available vendors. The first to accept gets the job.",
    findingVendor: 'Finding a vendor for you',
    waitingFor: (name: string) => `Waiting for ${name}`,
    acceptLost: 'This request has already been assigned to another vendor.',
  },
  vendorApproval: {
    pending: 'Your account is under verification.',
    rejected: 'Your vendor application was not approved.',
  },
  payment: {
    offlineNote: 'Payment is made directly to the vendor. Fixora only records it.',
  },
});
