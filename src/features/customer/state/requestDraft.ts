/**
 * Request draft
 *
 * What a half-finished request is, and how the application decides whether it is
 * finished.
 *
 * ⚠️ One place answers "is this ready?", and every screen asks it here. The
 * alternative — each screen checking the parts it happens to know about — is how
 * two screens end up disagreeing about whether a request may be submitted, and
 * how the one that is wrong lets an incomplete request through.
 *
 * The draft carries its own progress. PROJECT_BIBLE.md section 13 runs details →
 * vendor → confirmation, and where a returning customer belongs is worked out
 * from what they have answered, never from navigation history. Navigation state
 * is a record of where someone has been; the draft is a record of what they have
 * said, and only the second can be trusted after the app has been closed.
 *
 * This is the frontend's own completeness check and nothing more. It decides
 * whether the app may move a customer forward; whether the backend will accept
 * the request remains the backend's answer.
 */

import { SELECTABLE_PRIORITIES } from '@/features/customer/constants/requestPresentation';
import { isUsableAddress } from '@/features/customer/validation/addressRules';
import type { CreateRequestForm } from '@/features/customer/validation/requestSchemas';
import type { RequestAddress } from '@/shared/services/types/RequestService';

/**
 * The customer's answer to the vendor question (PROJECT_BIBLE.md section 18A).
 *
 * Three states rather than a nullable id, because "not asked yet" and "asked and
 * chose nobody" are different answers with different consequences: the first
 * must not reach the confirmation screen, and the second is open dispatch and is
 * perfectly complete. Collapsing them is exactly how an unanswered screen would
 * submit as though open dispatch had been requested.
 */
export type VendorChoice =
  | { kind: 'none' }
  | { kind: 'open' }
  | { kind: 'vendor'; vendorId: string };

/** What a request starts as: everything still to be asked. */
export const NO_VENDOR_CHOICE: VendorChoice = Object.freeze({ kind: 'none' });

/**
 * Where the draft's professional stands against the eligible list for its
 * service (PROJECT_BIBLE.md section 18A; Phase 3D-12).
 *
 * - `unnamed` — no professional is named (open dispatch, or not answered
 *   yet): nothing for a list to confirm or contradict.
 * - `unknown` — one is named and the list has not settled: still being read,
 *   or its last read failed. Nothing can be said either way, so nothing may be
 *   cleared — and nothing may be sent.
 * - `available` — the latest list has them.
 * - `unavailable` — the latest list has loaded and does not. They stopped
 *   being eligible after the draft named them, and the request must never go
 *   to them.
 *
 * ⚠️ `list` is the list only once it has settled; the caller passes undefined
 * while a read is in the air or after one failed. A list kept from an earlier
 * read is not the latest one.
 */
export type VendorChoiceStanding = 'unnamed' | 'unknown' | 'available' | 'unavailable';

export function vendorChoiceStanding(
  choice: VendorChoice,
  list: readonly { id: string }[] | undefined,
): VendorChoiceStanding {
  if (choice.kind !== 'vendor') {
    return 'unnamed';
  }
  if (!list) {
    return 'unknown';
  }
  return list.some(vendor => vendor.id === choice.vendorId) ? 'available' : 'unavailable';
}

/**
 * A request as far as the customer has got it.
 *
 * Exactly what is needed to resume and to submit — no navigation state, no
 * vendor names, no credentials, nothing about the device.
 */
export interface RequestDraft {
  categoryId: string;
  /** The service itself (PROJECT_BIBLE.md section 12). */
  subCategoryId: string;
  /** The details form's values, untranslated. The payload is built at submit. */
  values: CreateRequestForm;
  /** Remote URLs of photographs that finished uploading (section 16). */
  imageUrls: string[];

  /**
   * Where the work is to be done (PROJECT_BIBLE.md section 18).
   *
   * ⚠️ Null is "not answered yet", and it is the only way to say that. An empty
   * `RequestAddress` would be an address the customer never gave that still
   * looked like one, which is exactly the confusion `VendorChoice` has three
   * states to avoid — the difference being that an address has no equivalent of
   * "no preference", because a request nobody can be sent to is not a request.
   */
  address: RequestAddress | null;

  vendor: VendorChoice;
}

/**
 * What a draft became, once it had been sent.
 *
 * ⚠️ It exists because the success screen has to say what was submitted, and the
 * draft that knew is deliberately destroyed at the same moment. Something has to
 * carry the answer across that one step.
 *
 * ⚠️ Not persisted, and that is the difference between this and the draft. A
 * draft survives being killed because there is something left to finish; a sent
 * request has nothing left to do, so an app reopened on the success screen
 * should open on the home screen instead. It lives as long as the navigator and
 * no longer.
 *
 * It holds identifiers and the address, and no display text. The names of the
 * service and the professional are resolved from the catalogue by the screen
 * that shows them, exactly as every other screen in this flow resolves them —
 * this application renders names, it does not assert them.
 */
export interface SubmittedRequest {
  /**
   * The backend's own reference, as returned by `createRequest`.
   *
   * Never generated here and never generated at all. A screen inventing a
   * reference would be printing a number a customer might quote to somebody who
   * has never heard of it.
   */
  reference: string;
  categoryId: string;
  subCategoryId: string;
  /** Where it is going. Shown so the customer can see it went to the right place. */
  address: RequestAddress;
  /**
   * Which dispatch it went out on.
   *
   * The same three-state value the draft carried, and by the time a request has
   * been sent only two of them are reachable — an unresolved vendor question
   * cannot reach submission. It is kept as `VendorChoice` rather than narrowed
   * so that the success screen and the summary screen read the same field the
   * same way, instead of one of them re-deriving it.
   */
  vendor: VendorChoice;
}

/** Where a returning customer is put back. */
export type RequestDraftStep = 'details' | 'address' | 'vendor' | 'review';

export interface RequestDraftCompletion {
  /** Whether the details form has been answered. */
  isDetailsComplete: boolean;
  /** Whether there is somewhere to send a professional. */
  isAddressComplete: boolean;
  /** Whether the vendor question has an answer — either answer. */
  isVendorResolved: boolean;
  /** Whether the request may be reviewed and sent. */
  isReadyForReview: boolean;
  /** The first step that still needs the customer. */
  step: RequestDraftStep;
}

/**
 * Priority is the only answer the details form insists on.
 *
 * Date, time, photographs and notes are optional by contract — section 14 marks
 * the schedule conditional and section 17 marks notes optional — so requiring
 * any of them here would invent an obligation the product does not have.
 */
function isDetailsComplete(draft: RequestDraft): boolean {
  return SELECTABLE_PRIORITIES.includes(draft.values.priority);
}

/**
 * The order the steps are asked in, and therefore the order they are checked in.
 *
 * PROJECT_BIBLE.md section 13 runs details → address → vendor → review. `step`
 * is the first unanswered one, so a customer who somehow has a vendor but no
 * address is sent back for the address rather than forward to the summary.
 */
export function completionOf(draft: RequestDraft): RequestDraftCompletion {
  const detailsComplete = isDetailsComplete(draft);
  const addressComplete = isUsableAddress(draft.address);
  const vendorResolved = draft.vendor.kind !== 'none';

  return {
    isDetailsComplete: detailsComplete,
    isAddressComplete: addressComplete,
    isVendorResolved: vendorResolved,
    isReadyForReview: detailsComplete && addressComplete && vendorResolved,
    step: !detailsComplete
      ? 'details'
      : !addressComplete
        ? 'address'
        : !vendorResolved
          ? 'vendor'
          : 'review',
  };
}

/**
 * Whether a draft is worth keeping if the customer walks away from it.
 *
 * Opening the form and immediately leaving is not an unfinished request, and
 * offering to resume one would be the app inventing an intention. Anything the
 * customer actually said — a priority, a preference, a photograph, a sentence,
 * a vendor — makes it real.
 */
export function isDraftWorthKeeping(draft: RequestDraft): boolean {
  const { priority, preferredDate, preferredTime, notes } = draft.values;

  return (
    priority.length > 0 ||
    preferredDate.length > 0 ||
    preferredTime.length > 0 ||
    notes.trim().length > 0 ||
    draft.imageUrls.length > 0 ||
    draft.address !== null ||
    draft.vendor.kind !== 'none'
  );
}
