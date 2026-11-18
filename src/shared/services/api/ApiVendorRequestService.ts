/**
 * ApiVendorRequestService
 *
 * VendorRequestService against the real backend (Phase 4A, 17/11/2026;
 * PROJECT_BIBLE.md sections 31 to 37), built to the shared request contract
 * (`requests-contract.md`, 17/11/2026). Replaces `MockVendorRequestService`
 * with no change to the list, the details or the work screens: the records are
 * read through `vendorWork.ts`, the one reader the dashboard shares.
 *
 * Endpoints, all POST:
 * - list → `/requests/list` (this vendor's records and the open ones they have
 *   not declined) and `/requests/list { declined: true }` (the open ones they
 *   declined), every page of each, grouped on the device;
 * - details → `/requests/detail { id }`;
 * - accept → `/requests/accept { id }`, reject → `/requests/reject { id }`,
 *   start → `/requests/start { id }`, complete → `/requests/complete { id, amount }`.
 *
 * Decisions:
 * - **The session says who is asking.** The signed-in vendor's id (from the
 *   stored session) decides what is theirs, as the backend does from the token.
 *   No session, or a customer's, is `unauthorized` before anything is sent.
 * - **The backend decides; its codes are the answers.** Accept is atomic on the
 *   backend (first accept wins, section 33.1): 409 `REQUEST_ALREADY_TAKEN` is the
 *   lost race (`taken`), 409 `REQUEST_NOT_PENDING` is `notPending`. Reject
 *   answers `REQUEST_NOT_PENDING` the same way. Start and complete answer 409
 *   `INVALID_TRANSITION` from the wrong status (`invalidTransition`). 404
 *   `REQUEST_NOT_FOUND` — a request that does not exist or that this vendor may
 *   not see — is `notFound`, which the screens show calmly. Any other failure
 *   is the failure it is; a 409 with no code the contract names stays a
 *   `conflict` rather than being guessed into a race.
 * - **Reading before a step, as defence in depth.** Reject, start and complete
 *   read the request first: their answer needs its names (the action routes
 *   answer with bare ids, `repopulate`), and having read it, a step the record
 *   already shows to be wrong is refused without being sent. Accept does not:
 *   the record before is the one without the customer (section 32), so the
 *   accepted request is read after instead, whole.
 * - ⚠️ An accept that went through and whose read-after failed rejects with
 *   the read's failure, though the request is accepted. Pressing Accept again
 *   is answered as done (the backend's accept is idempotent for the holder), so
 *   the retry the screen offers is safe.
 * - **Declining an open request** removes it for this vendor only (the backend
 *   records who declined; the app is told only `declinedByMe`); it is listed
 *   under `rejected` from the declined answer, `REJECTED` to this vendor, and
 *   `getRequest` answers for it by
 *   reference as `REJECTED` too. ⚠️ The detail route answers it (§2, amended)
 *   as it stands for everybody else — open and `PENDING` — with the backend's
 *   `declinedByMe` flag; `true` opens it as `REJECTED`. Only when a record
 *   carries no flag is the declined answer read to decide; otherwise a request
 *   the vendor turned down would open as new, with Accept and Reject. A backend
 *   that hides it instead (404) is answered from the declined answer as well.
 *   `rejectedAt` is never set: the backend does not say when.
 * - **Completing sends the amount and nothing else.** `finalAmountMinor` paise
 *   go as `amount` in rupees (`backendAmount`), with no currency — the backend
 *   has no field for one. Whether the customer paid, how, and the vendor's
 *   notes have nowhere to go (its `note` is the timeline's, which the customer
 *   reads). A completion that says paid is refused
 *   (`PAYMENT_RECORD_NOT_SUPPORTED`) rather than recorded as something it is
 *   not; one not paid yet completes the job.
 * - **No payment record**: `recordPayment` and `listPaymentMethods` have no
 *   endpoint and refuse (`PAYMENT_RECORD_NOT_SUPPORTED`, not retryable). The
 *   methods were the mock's answer standing in for backend configuration
 *   (section 37), not a list the app keeps, so none is invented here.
 */

import { AppConfig } from '@/core/config/AppConfig';
import type { AuthUser } from '@/features/auth/types';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import { requireRecord } from '@/shared/services/api/apiResponse';
import { notSupported } from '@/shared/services/api/notSupported';
import {
  asDeclined,
  backendAmount,
  groupVendorWork,
  isBackendId,
  readRequestRecord,
  repopulate,
  standingOf,
  toRequestDetails,
  type VendorRequestRecord,
} from '@/shared/services/api/vendorWork';
import {
  COMPLETION_NOTES_MAX_LENGTH,
  FINAL_AMOUNT_MAX_MINOR,
  PAYMENT_STATUS_PAID,
  PAYMENT_STATUS_UNPAID,
  type PaymentMethodOption,
  type VendorCompletionInput,
  type VendorPaymentInput,
  type VendorPaymentResult,
  type VendorRequestDecisionResult,
  type VendorRequestDetails,
  type VendorRequestList,
  type VendorRequestRefusal,
  type VendorRequestService,
  type VendorWorkRefusal,
  type VendorWorkStepResult,
} from '@/shared/services/types/VendorRequestService';
import { AppError } from '@/shared/types/error';

/** The contract's 409 codes, as the interface's refusals. */
const ANSWER_REFUSALS: Readonly<Record<string, VendorRequestRefusal>> = Object.freeze({
  REQUEST_ALREADY_TAKEN: 'taken',
  REQUEST_NOT_PENDING: 'notPending',
});
const STEP_REFUSALS: Readonly<Record<string, VendorWorkRefusal>> = Object.freeze({
  INVALID_TRANSITION: 'invalidTransition',
});

/** What asks the list for the open requests this vendor declined. */
const DECLINED = Object.freeze({ declined: true });

export interface ApiVendorRequestServiceOptions {
  /** The signed-in account, or null. Asked on every call. */
  currentUser: () => Promise<AuthUser | null>;
}

/** Where a request stands for an answer: free to answer, or refused and why. */
type AnswerCheck =
  | { kind: 'free'; record: VendorRequestRecord }
  | { kind: 'refused'; reason: VendorRequestRefusal };

function notFound(): AppError {
  return new AppError({ kind: 'notFound', message: 'Vendor requests: no such request' });
}

function invalidCompletion(why: string): AppError {
  return new AppError({ kind: 'validation', message: `Vendor requests: ${why}` });
}

function paymentRecordNotSupported(what: string): AppError {
  return notSupported(what, 'PAYMENT_RECORD_NOT_SUPPORTED');
}

/** The refusal a failure stands for, when it is a 409 with a code the table names. */
function refusalOf<R extends string>(caught: unknown, table: Readonly<Record<string, R>>): R | undefined {
  const error = AppError.from(caught);
  if (error.statusCode !== 409 || error.code === undefined) {
    return undefined;
  }
  return Object.prototype.hasOwnProperty.call(table, error.code) ? table[error.code] : undefined;
}

/**
 * A completion checked as the contract says, before anything is sent — the
 * amount a whole number of paise above 0 and within the ceiling, the one
 * currency, a status it knows, no method on a job not paid, notes within their
 * ceiling. Paid is refused separately: the backend cannot record it.
 */
function checkCompletion(input: VendorCompletionInput): void {
  const value = (typeof input === 'object' && input !== null ? input : {}) as Partial<
    Record<keyof VendorCompletionInput, unknown>
  >;

  const amount = value.finalAmountMinor;
  if (
    typeof amount !== 'number' ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > FINAL_AMOUNT_MAX_MINOR
  ) {
    throw invalidCompletion('the final amount is not a whole number of minor units within range');
  }
  if (value.currency !== AppConfig.money.currency) {
    throw invalidCompletion('the currency is not one this service records');
  }
  if (value.paymentStatus === PAYMENT_STATUS_PAID) {
    throw paymentRecordNotSupported('a completion recorded as paid');
  }
  if (value.paymentStatus !== PAYMENT_STATUS_UNPAID) {
    throw invalidCompletion('the payment status is not one this service knows');
  }
  if (value.paymentMethodId !== undefined) {
    throw invalidCompletion('a job that is not paid yet has no payment method');
  }
  const notes = value.notes;
  if (notes !== undefined && (typeof notes !== 'string' || notes.length > COMPLETION_NOTES_MAX_LENGTH)) {
    throw invalidCompletion('the notes are not text within the ceiling');
  }
}

export class ApiVendorRequestService extends BaseApiService implements VendorRequestService {
  private readonly currentUser: () => Promise<AuthUser | null>;

  constructor(options: ApiVendorRequestServiceOptions) {
    super('/requests');
    this.currentUser = options.currentUser;
  }

  async listRequests(): Promise<VendorRequestList> {
    const vendor = await this.requireVendor();
    const [rows, declined] = await Promise.all([
      this.postAllPages('/list', {}).then(list => list.items),
      this.postAllPages('/list', DECLINED).then(list => list.items),
    ]);
    return groupVendorWork(rows, vendor.id, declined);
  }

  async getRequest(requestId: string): Promise<VendorRequestDetails> {
    const vendor = await this.requireVendor();
    const { record, declined } = await this.readOrDeclined(requestId);
    if (declined) {
      return toRequestDetails(record, vendor.id);
    }
    const standing = standingOf(record, vendor.id);
    // A record of another vendor's that a backend hands over anyway is not this vendor's.
    if (standing === 'elsewhere') {
      throw notFound();
    }
    // Open and waiting for everybody — but perhaps not for this vendor (see the header).
    if (standing === 'waiting' && record.vendorId === undefined) {
      if (await this.declinedByMe(record)) {
        return toRequestDetails(asDeclined(record), vendor.id);
      }
    }
    return toRequestDetails(record, vendor.id);
  }

  async acceptRequest(requestId: string): Promise<VendorRequestDecisionResult<'accepted'>> {
    const vendor = await this.requireVendor();
    const id = this.backendId(requestId);

    try {
      await this.post<unknown>('/accept', { id });
    } catch (caught) {
      const reason = refusalOf(caught, ANSWER_REFUSALS);
      if (reason) {
        return { outcome: 'refused', reason };
      }
      throw caught;
    }

    // Theirs now: read whole, the customer and where (see the header).
    const record = readRequestRecord(await this.post<unknown>('/detail', { id }));
    return { outcome: 'accepted', request: toRequestDetails(record, vendor.id) };
  }

  async rejectRequest(requestId: string): Promise<VendorRequestDecisionResult<'rejected'>> {
    const vendor = await this.requireVendor();
    const check = await this.checkAnswer(requestId, vendor.id);
    if (check.kind === 'refused') {
      return { outcome: 'refused', reason: check.reason };
    }

    let fresh: unknown;
    try {
      fresh = await this.post<unknown>('/reject', { id: check.record.id });
    } catch (caught) {
      const reason = refusalOf(caught, ANSWER_REFUSALS);
      if (reason) {
        return { outcome: 'refused', reason };
      }
      throw caught;
    }

    // Declined by this vendor: `REJECTED` to them, whatever it stays for others.
    const record = asDeclined(
      readRequestRecord(repopulate(requireRecord(fresh, 'request'), check.record.raw)),
    );
    return { outcome: 'rejected', request: toRequestDetails(record, vendor.id) };
  }

  async startRequest(requestId: string): Promise<VendorWorkStepResult<'started'>> {
    const vendor = await this.requireVendor();
    const record = await this.readOwnStep(requestId, vendor.id);
    if (record.vendorId !== vendor.id || record.status !== 'ACCEPTED') {
      return { outcome: 'refused', reason: 'invalidTransition' };
    }

    return this.step(record, vendor.id, '/start', { id: record.id }, 'started');
  }

  async completeRequest(
    requestId: string,
    completion: VendorCompletionInput,
  ): Promise<VendorWorkStepResult<'completed'>> {
    const vendor = await this.requireVendor();
    // The body first, as an endpoint validates it before it touches the record.
    checkCompletion(completion);
    const record = await this.readOwnStep(requestId, vendor.id);
    if (record.vendorId !== vendor.id || record.status !== 'IN_PROGRESS') {
      return { outcome: 'refused', reason: 'invalidTransition' };
    }

    return this.step(
      record,
      vendor.id,
      '/complete',
      { id: record.id, amount: backendAmount(completion.finalAmountMinor) },
      'completed',
    );
  }

  async recordPayment(_requestId: string, _payment: VendorPaymentInput): Promise<VendorPaymentResult> {
    await this.requireVendor();
    throw paymentRecordNotSupported('recording a payment after the job');
  }

  async listPaymentMethods(): Promise<PaymentMethodOption[]> {
    await this.requireVendor();
    throw paymentRecordNotSupported('the payment methods');
  }

  /** A work step sent, and its answer: the record as it now stands, or the backend's refusal. */
  private async step<Outcome extends 'started' | 'completed'>(
    before: VendorRequestRecord,
    vendorId: string,
    resource: string,
    body: Record<string, unknown>,
    outcome: Outcome,
  ): Promise<VendorWorkStepResult<Outcome>> {
    let fresh: unknown;
    try {
      fresh = await this.post<unknown>(resource, body);
    } catch (caught) {
      const reason = refusalOf(caught, STEP_REFUSALS);
      if (reason) {
        return { outcome: 'refused', reason };
      }
      throw caught;
    }

    const record = readRequestRecord(repopulate(requireRecord(fresh, 'request'), before.raw));
    return { outcome, request: toRequestDetails(record, vendorId) };
  }

  /** A reference the backend could hold, or `notFound` without asking. */
  private backendId(requestId: string): string {
    const reference = requestId.trim();
    if (!isBackendId(reference)) {
      throw notFound();
    }
    return reference;
  }

  /** One request by reference, as the detail route answers it. */
  private async read(requestId: string): Promise<VendorRequestRecord> {
    return readRequestRecord(await this.post<unknown>('/detail', { id: this.backendId(requestId) }));
  }

  /**
   * One request by reference: by the detail route, or — when that answers not
   * found — among the open requests this vendor declined, which the detail
   * route hides from them and the contract still lets them open, `REJECTED`.
   */
  private async readOrDeclined(
    requestId: string,
  ): Promise<{ record: VendorRequestRecord; declined: boolean }> {
    const id = this.backendId(requestId);
    try {
      return { record: readRequestRecord(await this.post<unknown>('/detail', { id })), declined: false };
    } catch (caught) {
      if (AppError.from(caught).kind !== 'notFound') {
        throw caught;
      }
      const rows = (await this.postAllPages('/list', DECLINED)).items;
      const match = rows.map(readRequestRecord).find(record => record.id === id);
      if (!match) {
        throw caught;
      }
      return { record: asDeclined(match), declined: true };
    }
  }

  /**
   * Whether this vendor declined an open request: the backend's `declinedByMe`
   * flag when the record carries one, else the declined answer (one read).
   */
  private async declinedByMe(record: VendorRequestRecord): Promise<boolean> {
    const flag = record.raw.declinedByMe;
    if (typeof flag === 'boolean') {
      return flag;
    }
    const rows = (await this.postAllPages('/list', DECLINED)).items;
    return rows.map(readRequestRecord).some(row => row.id === record.id);
  }

  /** A request a work step is asked for: visible to this vendor, or `notFound`. */
  private async readOwnStep(requestId: string, vendorId: string): Promise<VendorRequestRecord> {
    const record = await this.read(requestId);
    if (standingOf(record, vendorId) === 'elsewhere') {
      throw notFound();
    }
    return record;
  }

  /**
   * Whether a request is this vendor's to answer, from the record just read:
   * another vendor's directed request does not exist for them, one another
   * vendor holds is `taken`, anything no longer waiting — an open request they
   * already declined included — is `notPending`.
   */
  private async checkAnswer(requestId: string, vendorId: string): Promise<AnswerCheck> {
    const { record, declined } = await this.readOrDeclined(requestId);
    if (declined) {
      return { kind: 'refused', reason: 'notPending' };
    }
    const standing = standingOf(record, vendorId);

    if (standing === 'elsewhere') {
      if (record.status === 'PENDING_VENDOR') {
        throw notFound();
      }
      return { kind: 'refused', reason: 'taken' };
    }
    return standing === 'waiting'
      ? { kind: 'free', record }
      : { kind: 'refused', reason: 'notPending' };
  }

  /** What an authenticated vendor endpoint does to anybody else. */
  private async requireVendor(): Promise<AuthUser> {
    const user = await this.currentUser();
    if (!user || user.role !== 'vendor') {
      throw new AppError({ kind: 'unauthorized', message: 'Vendor requests: no vendor session' });
    }
    return user;
  }
}
