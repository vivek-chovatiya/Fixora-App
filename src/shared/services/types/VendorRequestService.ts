/**
 * VendorRequestService
 *
 * The vendor's requests (PROJECT_BIBLE.md sections 31 to 36): the list, one
 * request opened (Phase 3E-3), the answer to one that is waiting — accept or
 * reject (Phase 3E-4) — and the work on one that was accepted: start it, then
 * mark it completed (Phase 3E-5), recording what the job came to and whether
 * the customer has paid (sections 36 and 37, the offline payment record) — and,
 * later, that a customer who had not paid yet now has (owner decision,
 * 21/10/2026: `recordPayment`).
 *
 * ⚠️ Those five are the only changes there are. Nothing here cancels, reassigns,
 * schedules or closes a request, and nothing changes a completion record except
 * "Not paid yet" becoming "Paid" — so no screen can do any of the rest, because
 * there is no operation to call.
 *
 * ⚠️ Payment is recorded, never processed (section 37: "Payment Recorded ✅,
 * Payment Processed by Fixora ❌"). Completing a job carries what the vendor
 * says happened — the amount, paid or not, and how — and nothing here takes,
 * moves, requests or confirms money. There is no gateway to call, because
 * Phase 1 has none.
 *
 * ⚠️ The backend's statuses, one path through them (sections 21, 34 to 36):
 * `PENDING_VENDOR` → `ACCEPTED` → `IN_PROGRESS` → `COMPLETED`, or
 * `PENDING_VENDOR` → `REJECTED`. `CLOSED` is the backend's own later state and
 * no vendor call reaches it. The service checks every step against the current
 * status; the app offering a button is never what makes a step valid.
 *
 * ⚠️ One request model, not two. A request in the list is the same
 * `VendorJobSummary` the dashboard previews (section 31's card fields); the
 * dashboard and the list are two views of the same work and must not be able to
 * describe it differently. The details record is that summary with a little
 * more on it.
 *
 * ⚠️ The list arrives already sorted into its groups. Which backend statuses
 * count as waiting, under way or done is the backend's knowledge (sections 21
 * and 34), exactly as on the dashboard — so the answer is lists, and the app's
 * filter merely chooses which of them to draw. There is deliberately no
 * filter parameter: choosing a view is the screen's business, and a parameter
 * would put the app's idea of the groups into the contract.
 *
 * ⚠️ What a vendor declined is kept, as their own history (section 31's
 * Rejected tab; owner decision, 2026-10-21): a fourth group, `rejected`, that
 * the dashboard does not count — it is not work the vendor has, had or can do
 * anything to.
 *
 * Scoped by the session. No vendor id is passed and none can be asked for; a
 * request that is not this vendor's does not exist as far as this service says.
 */

import type { RequestAddress } from '@/shared/services/types/RequestService';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';

/**
 * Everything the vendor has, in the groups the backend put it in.
 *
 * Whole, not previewed — the dashboard takes a few of each; this is the rest.
 * No paging yet: see WORKING_NOTES for why and when that changes.
 */
export interface VendorRequestList {
  /** Waiting for this vendor to take or decline, newest first. */
  pending: VendorJobSummary[];
  /** Taken and not finished, the furthest along first. */
  active: VendorJobSummary[];
  /** Finished, most recently finished first. */
  completed: VendorJobSummary[];
  /**
   * What this vendor declined, most recently declined first, each with its
   * status `REJECTED` and — when the backend says — `rejectedAt`. History, not
   * work: nothing can be done to a request here, and none of it is counted on
   * the dashboard.
   *
   * ⚠️ This vendor's rejections only, and all of them. Another vendor declining
   * a request never puts it here; a request this vendor declined stays here
   * even after somebody else accepted it, because it records what this vendor
   * did, not what became of the request.
   */
  rejected: VendorJobSummary[];
}

/**
 * One request, opened (section 32: "Request ID, Customer Information, Service,
 * Sub Service, Priority, Description, Images, Notes, Address, Preferred
 * Date/Time, Current Status").
 *
 * ⚠️ What the vendor is told depends on whether they hold the work (owner
 * decision, 21/10/2026):
 *
 * - **before** — a request still waiting for their answer, or one they
 *   declined: the service, its category, the priority, what the customer said,
 *   the photographs, the preferred date and time, and the **area only**
 *   (`locality`). No `customerName`, no `customerPhone`, no `address`: the
 *   backend leaves them off the record, so they are never on the device;
 * - **once they hold it** — accepted, in progress, completed: all of the
 *   above, and the customer's name and phone and the full address.
 *
 * A screen must draw those three only for work the vendor holds, even if a
 * record carries them anyway — the record and the screen each keep the rule,
 * so one mistake does not show a stranger's address.
 *
 * ⚠️ Every field added here on 21/10/2026 is this app's guess at the backend:
 * the shapes are the customer's own (`CreateRequestInput` read back), because a
 * request is one request whoever opens it. Each is optional, and absent — not
 * empty — when there is nothing to say.
 *
 * Section 32's "Description" and "Notes" are one field: the customer's
 * request has a single free-text box (`CreateRequestInput.notes`; description
 * is folded into it), so `description` here is that text, read back.
 */
export interface VendorRequestDetails extends VendorJobSummary {
  /** The category the service belongs to. Rendered, never matched (section 11). */
  categoryName?: string;
  /**
   * What the customer wrote about the job — their request's notes
   * (`CreateRequestInput.notes`), exactly as sent. Absent when they wrote
   * nothing.
   */
  description?: string;
  /**
   * The photographs the customer attached (section 16), as remote URLs, in the
   * order they were attached. Absent when there are none — never `[]`.
   * Shown before the vendor holds the work: they describe the job, not the
   * customer.
   */
  imageUrls?: string[];
  /** `YYYY-MM-DD`, exactly as the customer sent it. Absent: no preference. */
  preferredDate?: string;
  /** `HH:mm`, 24-hour, exactly as the customer sent it. Absent: no preference. */
  preferredTime?: string;
  /**
   * The customer's phone number as stored — digits, never formatted (the
   * screen writes it with `formatPhone`).
   *
   * ⚠️ Only on work this vendor holds. Never on a request waiting for their
   * answer or one they declined.
   */
  customerPhone?: string;
  /**
   * Where the work is, exactly as the customer gave it (section 18) — the
   * customer's own `RequestAddress`, so the two sides cannot describe one
   * place two ways.
   *
   * ⚠️ Only on work this vendor holds. Before that, the area (`locality`) is
   * all the vendor is told.
   */
  address?: RequestAddress;
  /**
   * What the vendor recorded when they completed it (sections 36 and 37).
   *
   * Only ever on completed work, and not always there: work completed before
   * the record existed — or closed by the backend some other way — has none,
   * and a screen says nothing about payment rather than guessing.
   */
  completion?: VendorCompletionRecord;
}

/**
 * The payment statuses this app sends (section 36's "Payment Status"): the
 * customer has paid, or has not yet.
 *
 * ⚠️ The app's guess at the backend's values — no endpoint exists yet — and
 * written once, here, so the form, the mock and the presentation table cannot
 * spell them three ways. Read back, a status is still a plain string: the
 * backend may add one, and it is shown through a table that falls back safely
 * (`presentPaymentStatus`), never matched as though this pair were the whole
 * truth.
 */
export const PAYMENT_STATUS_PAID = 'PAID';
export const PAYMENT_STATUS_UNPAID = 'UNPAID';

/**
 * The largest final amount the app accepts, in minor units: ₹10,00,000.00.
 *
 * The app's ceiling, not the backend's — none has been agreed. It stops a slip
 * of the thumb (an extra zero or three) being recorded against a household
 * repair; it is not a statement about what a job may cost.
 */
export const FINAL_AMOUNT_MAX_MINOR = 100_000_000;

/**
 * The longest completion note the app accepts. The same figure as a
 * customer's request notes, so a vendor can write as much about the job as the
 * customer could; its own constant, because it bounds a different field on a
 * different contract.
 */
export const COMPLETION_NOTES_MAX_LENGTH = 500;

/**
 * One way a customer can have paid, as the backend lists them (section 37:
 * "The exact supported methods must follow backend configuration").
 *
 * ⚠️ Read from the service, never written into the app. The `id` is what is
 * sent; the `label` is what is shown, already in words. Section 37's own list
 * — Cash, UPI, Bank Transfer, Card, Other — is what the mock answers, not what
 * the app assumes.
 */
export interface PaymentMethodOption {
  id: string;
  label: string;
}

/**
 * What a vendor records when they complete a job (sections 36 and 37).
 *
 * ⚠️ Exact keys. `paymentMethodId` and `notes` are **absent** — not null, not
 * an empty string — when they do not apply: no method when the customer has
 * not paid yet, no notes when the vendor wrote none. A backend should never
 * have to decide what `""` meant.
 */
export interface VendorCompletionInput {
  /** The total the job came to, in whole minor units (paise). Greater than 0. */
  finalAmountMinor: number;
  /** ISO 4217 code — `AppConfig.money.currency` — never a symbol. */
  currency: string;
  /** `PAYMENT_STATUS_PAID` or `PAYMENT_STATUS_UNPAID`. */
  paymentStatus: string;
  /** One of `listPaymentMethods`' ids. Present only when the customer has paid. */
  paymentMethodId?: string;
  /** The vendor's own words about the job, exactly as typed. Absent when there are none. */
  notes?: string;
}

/**
 * A completion as the service recorded it: what was sent, plus the method's
 * label, named by the service so a record reads the same however the list of
 * methods changes afterwards.
 */
export interface VendorCompletionRecord {
  finalAmountMinor: number;
  currency: string;
  paymentStatus: string;
  paymentMethodId?: string;
  /** In words, as the service named the method when it was recorded. */
  paymentMethodLabel?: string;
  notes?: string;
}

/**
 * What a vendor sends to record, after completing a job, that the customer has
 * now paid (owner decision, 21/10/2026: "Not paid yet" may become "Paid"
 * later; only that way, and once paid it is final).
 *
 * ⚠️ Exact keys, both required: the status the record becomes and how the
 * customer paid — what the completion form requires of a paid job, and nothing
 * else. The amount is not here: it was fixed when the job was completed, and
 * nothing in the record but the payment changes. The app's guess at the
 * backend's body, like the rest of the payment record.
 */
export interface VendorPaymentInput {
  /** `PAYMENT_STATUS_PAID` — the one status a record can be moved to. */
  paymentStatus: string;
  /** One of `listPaymentMethods`' ids. */
  paymentMethodId: string;
}

/** The two answers a waiting request can be given (section 33). */
export type VendorRequestDecision = 'accept' | 'reject';

/**
 * Why an answer was not applied. Each is a business answer, not a fault
 * (section 49.1): the request moved on between the vendor seeing it and
 * answering, and the right response is to say so calmly and show what is true
 * now.
 *
 * - `taken` — another professional accepted it first. Only an open (broadcast)
 *   request can be taken; it is no longer this vendor's to answer (section
 *   33.1).
 * - `notPending` — it is still this vendor's, but no longer waiting for an
 *   answer: they have already accepted or rejected it (from another screen, or
 *   another device), or it has moved on since.
 */
export type VendorRequestRefusal = 'taken' | 'notPending';

/**
 * What an answer came to.
 *
 * ⚠️ A result, not a guess. On success the record comes back as the service now
 * holds it — status and all — and that is what the app shows; the app never
 * marks a request accepted on its own (section 33.1: "only the backend's
 * confirmed response assigns a request"). A refusal carries no record: the app
 * reads the request again to learn where it went.
 *
 * Faults are not results. A missing session rejects with `unauthorized`, a
 * reference that is not this vendor's with `notFound` (exactly as `getRequest`
 * — so somebody else's directed request cannot be answered, and its existence
 * is not confirmed either), and anything that stopped the answer being recorded
 * with the failure's own kind. None of them changed anything.
 */
export type VendorRequestDecisionResult<Outcome extends 'accepted' | 'rejected'> =
  | { outcome: Outcome; request: VendorRequestDetails }
  | { outcome: 'refused'; reason: VendorRequestRefusal };

/** The two steps of accepted work (sections 35 and 36). */
export type VendorWorkStep = 'start' | 'complete';

/** Recording, after completion, that a customer who had not paid now has (21/10/2026). */
export type VendorPaymentStep = 'recordPayment';

/**
 * Everything a vendor can do to a request: answer it, move its work along, or
 * record a payment that came after the job.
 */
export type VendorRequestAction = VendorRequestDecision | VendorWorkStep | VendorPaymentStep;

/**
 * Why a work step was not applied: the request is not in the status the step
 * starts from — `ACCEPTED` to start, `IN_PROGRESS` to complete. Waiting,
 * rejected, already started, already completed: all the same answer.
 *
 * Like a refusal to an answer, a business answer and not a fault. Between the
 * vendor seeing the request and pressing the button it may have moved on —
 * started from another device, say — and the right response is to say so calmly
 * and read it again.
 */
export type VendorWorkRefusal = 'invalidTransition';

/**
 * What a work step came to: the record as the service now holds it, or a
 * refusal with no record. Faults reject exactly as for an answer —
 * `unauthorized`, `notFound` for a request that is not this vendor's, the
 * failure's own kind when the step could not be recorded — and change nothing.
 */
export type VendorWorkStepResult<Outcome extends 'started' | 'completed'> =
  | { outcome: Outcome; request: VendorRequestDetails }
  | { outcome: 'refused'; reason: VendorWorkRefusal };

/**
 * What recording a later payment came to: the request as the service now holds
 * it — its completion record paid — or a refusal with no record, in the work
 * steps' own words: `invalidTransition` when there is no "Not paid yet" record
 * to change (the job is not finished, or finished without a record, or its
 * record says something other than paid or not paid). Faults reject as for a
 * work step.
 *
 * ⚠️ A record that is already paid is not a refusal: it comes back as it is,
 * `recorded`, so a call retried after it had in fact gone through is not
 * reported as a failure. Whatever method the retry named, the first one stands
 * — a paid record is final.
 */
export type VendorPaymentResult =
  | { outcome: 'recorded'; request: VendorRequestDetails }
  | { outcome: 'refused'; reason: VendorWorkRefusal };

export interface VendorRequestService {
  /**
   * The signed-in vendor's requests. A vendor with none gets four empty
   * lists, not an error. Rejects with `unauthorized` without a vendor session.
   */
  listRequests(): Promise<VendorRequestList>;

  /**
   * One of the signed-in vendor's requests, by reference.
   *
   * Rejects with `notFound` for a reference that is not theirs — including one
   * that exists and belongs to somebody else, which must be indistinguishable
   * from one that does not exist.
   */
  getRequest(requestId: string): Promise<VendorRequestDetails>;

  /**
   * Takes a waiting request (section 33). Only a request that is waiting for
   * this vendor can be accepted; on an open request the first vendor to accept
   * wins and everybody after is refused with `taken` (section 33.1).
   *
   * Accepted work is listed under `active` from then on.
   */
  acceptRequest(requestId: string): Promise<VendorRequestDecisionResult<'accepted'>>;

  /**
   * Declines a waiting request (section 33). Only a request that is waiting for
   * this vendor can be rejected.
   *
   * ⚠️ A rejected request leaves waiting and is listed under `rejected` from
   * then on, first, with `rejectedAt` set — the vendor keeps a history of what
   * they declined (owner decision, 2026-10-21). It is in none of the other
   * three groups and counted nowhere. `getRequest` answers for it by reference,
   * with its status `REJECTED`. One vendor's rejection is theirs alone — an
   * open request another vendor can see stays open to them.
   */
  rejectRequest(requestId: string): Promise<VendorRequestDecisionResult<'rejected'>>;

  /**
   * Starts accepted work (section 35): `ACCEPTED` → `IN_PROGRESS`. Anything
   * else is refused with `invalidTransition`. Started work stays under `active`.
   */
  startRequest(requestId: string): Promise<VendorWorkStepResult<'started'>>;

  /**
   * Finishes work under way (section 36): `IN_PROGRESS` → `COMPLETED`, with
   * `completedAt` set and the vendor's completion recorded on the request
   * (`VendorRequestDetails.completion`). Anything else — including accepted
   * work that was never started — is refused with `invalidTransition`.
   * Completed work is listed under `completed` from then on, and the only thing
   * left that can be done to it is `recordPayment`.
   *
   * Rejects with `validation`, and records nothing, when the completion does
   * not hold: an amount that is not a whole number of minor units above 0 and
   * within `FINAL_AMOUNT_MAX_MINOR`, a currency or payment status the service
   * does not know, a paid job without a known method, an unpaid job with one,
   * or notes over `COMPLETION_NOTES_MAX_LENGTH`.
   */
  completeRequest(
    requestId: string,
    completion: VendorCompletionInput,
  ): Promise<VendorWorkStepResult<'completed'>>;

  /**
   * Records that the customer of a finished job, recorded "Not paid yet", has
   * now paid (owner decision, 21/10/2026). The record's status becomes
   * `PAYMENT_STATUS_PAID` with the method and its label; the amount, the
   * currency and the notes are left exactly as they were. The request stays
   * where it is in the list.
   *
   * Rejects with `validation`, and records nothing, when the body does not
   * hold: a status other than `PAYMENT_STATUS_PAID`, or a method that is not
   * one of `listPaymentMethods`'. Refused with `invalidTransition` when there is
   * no "Not paid yet" record to change; answered with the record as it is when
   * it is already paid (see `VendorPaymentResult`). Recorded, never processed:
   * no money moves.
   */
  recordPayment(requestId: string, payment: VendorPaymentInput): Promise<VendorPaymentResult>;

  /**
   * The ways a customer can have paid, in the order to offer them (section
   * 37). Rejects with `unauthorized` without a vendor session.
   */
  listPaymentMethods(): Promise<PaymentMethodOption[]>;
}
