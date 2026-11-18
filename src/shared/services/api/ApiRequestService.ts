/**
 * ApiRequestService
 *
 * RequestService against the real backend's service requests (PROJECT_BIBLE.md
 * sections 13 to 23). Replaces `MockRequestService` with no change to any
 * customer screen.
 *
 * Endpoints: `POST /requests` (create), `POST /requests/list` (history and the
 * recent list), `POST /requests/detail` (one request), `POST /requests/cancel`
 * (the customer's cancel, owner decision 3D-11) — built to the shared
 * `requests-contract.md` of 17/11/2026.
 *
 * Decisions:
 * - **One vocabulary table**, shared with the vendor's side:
 *   `api/requestTokens.ts`. Backend `PENDING` is section 21's `PENDING_VENDOR`
 *   (dispatch began when it was created, exactly as the mock says); `ASSIGNED` —
 *   a technician named — is still `ACCEPTED` to a customer (section 22 makes
 *   "Vendor Accepted / Assigned" one step); `URGENT` is the app's `EMERGENCY`. A
 *   word the table does not know passes through untouched, so the presentation
 *   tables' safe fallback shows it — never a guess.
 * - **Who the vendor on a record is depends on the status.** The backend keeps
 *   one `vendorId` for both the professional a customer asked for and the one
 *   who took the job. While the request is `PENDING` it can only be the one
 *   asked for (`preferredVendor`, so the customer sees "awaiting the
 *   professional you chose"); once accepted it is the one doing it
 *   (`vendorName`). On a cancelled or rejected request it could be either, so it
 *   is shown as neither. A request that was directed and then accepted reads as
 *   open dispatch on its progress path: the backend does not say it was directed.
 * - **The reference is `requestNumber`.** The database id is what every call
 *   and route carries (`id`); the `REQ-…` number is what a customer quotes
 *   (`reference`). Neither is ever built here.
 * - **Views.** All, Completed and Cancelled are one backend status or none, so
 *   the backend filters and pages them. Active is four backend statuses and the
 *   list takes one, so Active reads the customer's whole list (every page, up
 *   to `AppConfig.api.fullListMaxPages`) and pages it here — a cost of one
 *   request per hundred of the customer's requests, per page shown
 *   (WORKING_NOTES: backend gap — the list cannot filter by several statuses).
 * - **Creating.** The address goes as `serviceAddress`, the formatted text the
 *   customer confirmed, with `serviceAddressDetails` carrying only the parts the
 *   app actually holds (`toAddressDetails`); a blank address is refused here,
 *   before sending. `addressId` is never sent: a request copies its address by
 *   value (3D-10), so editing the address book can never move a request already
 *   raised. `description` is the customer's notes exactly as typed, or absent —
 *   nothing is written in their place. The preference becomes `scheduledAt` in
 *   India time (`scheduledAt.ts`); a time with no date cannot be held and is not
 *   sent. Photos are not sent: there is no upload endpoint, so the image URLs
 *   the app holds point nowhere the backend can reach (WORKING_NOTES: gap).
 * - **Cancelling.** `/requests/cancel { id }`; the backend decides (pending only,
 *   idempotent when already cancelled). `409 REQUEST_NOT_CANCELLABLE` is the
 *   interface's `refused` outcome, not a failure; `404 REQUEST_NOT_FOUND`
 *   rejects as `notFound`, as the interface asks.
 * - **Ownership.** The backend answers 404 `REQUEST_NOT_FOUND` for a request the
 *   caller may not see. A record handed back for another customer is still
 *   treated as not found here, in case that check is ever lost.
 *
 * ⚠️ Every field is read by name below and only names and ids leave this file —
 * never spread a record. Before the privacy fix the backend populated whole
 * vendor and customer documents into these records (phones, emails, and on the
 * dev server a vendor's `authCodeHash`); the tests still feed those in and
 * prove none of it comes out.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { BaseApiService } from '@/shared/services/api/BaseApiService';
import {
  isRecord,
  malformedResponse,
  optionalString,
  populated,
  readRows,
  referenceId,
  requireRecord,
  requireString,
} from '@/shared/services/api/apiResponse';
import {
  toAppPriority,
  toAppRequestStatus,
  toBackendPriority,
} from '@/shared/services/api/requestTokens';
import { fromScheduledAt, toScheduledAt } from '@/shared/services/api/scheduledAt';
import type {
  CancelRequestResult,
  CreateRequestInput,
  CreatedRequest,
  CustomerPaymentRecord,
  CustomerRequest,
  CustomerRequestDetails,
  RequestAddress,
  RequestHistoryFilter,
  RequestService,
  RequestedVendor,
} from '@/shared/services/types/RequestService';
import { AppError } from '@/shared/types/error';
import type { Page, PageRequest } from '@/shared/types/pagination';

const log = createLogger('ApiRequestService');

/**
 * Which of the record's vendor references the app may name, by the app's
 * status. While a request waits (`PENDING_VENDOR`) the vendor on it can only be
 * the one the customer asked for; once accepted, it is the one doing the job. A
 * cancelled or rejected request could hold either, so it names neither.
 */
type VendorReading = 'preferred' | 'assigned' | 'neither';

const VENDOR_READING: Readonly<Record<string, VendorReading>> = Object.freeze({
  PENDING_VENDOR: 'preferred',
  ACCEPTED: 'assigned',
  IN_PROGRESS: 'assigned',
  COMPLETED: 'assigned',
});

/**
 * Section 23's views in backend statuses, as the owner placed them on
 * 2026-09-21 (`MockRequestService`): waiting, accepted and under way are
 * active; rejected is under All only. The backend has no on-hold status.
 */
const VIEW_STATUSES: Readonly<Record<Exclude<RequestHistoryFilter, 'all'>, readonly string[]>> =
  Object.freeze({
    active: ['PENDING', 'ACCEPTED', 'ASSIGNED', 'IN_PROGRESS'],
    completed: ['COMPLETED'],
    cancelled: ['CANCELLED'],
  });

/** Paise per rupee: the backend's `amount` is in rupees, the app holds paise. */
const MINOR_PER_MAJOR = 100;

function readingOf(appStatus: string): VendorReading {
  return Object.prototype.hasOwnProperty.call(VENDOR_READING, appStatus)
    ? VENDOR_READING[appStatus]
    : 'neither';
}

/** The vendor a record names, read from the populated reference: id and business name only. */
function vendorOf(record: Record<string, unknown>): RequestedVendor | undefined {
  const vendor = populated(record.vendorId);
  const id = referenceId(record.vendorId);
  const name = vendor ? optionalString(vendor, 'businessName') : undefined;

  // Both or neither (`RequestedVendor`): an id with no name could only be shown as the id.
  return id && name ? { id, name } : undefined;
}

function nameOf(reference: unknown): string | undefined {
  const document = populated(reference);
  return document ? optionalString(document, 'name') : undefined;
}

/** One list row as a card, or a refusal that `readRows` leaves out of the list. */
function rowToSummary(row: unknown): CustomerRequest {
  return toSummary(requireRecord(row, 'request'));
}

/** One record as a card shows it (section 23). */
function toSummary(record: Record<string, unknown>): CustomerRequest {
  const status = toAppRequestStatus(requireString(record, 'status', 'request'));
  const reading = readingOf(status);
  const reference = optionalString(record, 'requestNumber');
  const serviceName = nameOf(record.subCategoryId) ?? nameOf(record.categoryId);
  if (!serviceName) {
    throw malformedResponse('request.subCategoryId.name');
  }
  const vendor = vendorOf(record);

  return {
    id: requireString(record, 'id', 'request'),
    ...(reference ? { reference } : {}),
    serviceName,
    ...(reading === 'assigned' && vendor ? { vendorName: vendor.name } : {}),
    status,
    priority: toAppPriority(requireString(record, 'priority', 'request')),
    createdAt: requireString(record, 'createdAt', 'request'),
    ...(reading === 'preferred' && vendor ? { preferredVendor: vendor } : {}),
  };
}

/**
 * What the professional recorded about payment, on a completed request only
 * (sections 36 and 37) — and only when the backend says it was paid.
 *
 * The same rule as the vendor's side (`vendorWork.ts`, `completionOf`), so one
 * job reads the same to both. The backend's `paymentStatus: 'PENDING'` is the
 * default every request is born with, not something anybody recorded — and the
 * vendor's completion cannot set it (`/requests/complete` keeps only the
 * amount) — so it is no record at all: the screen says nothing about payment
 * rather than telling a customer they have not paid.
 *
 * ⚠️ `amount` is whole rupees (the seed's 499 and 299; the vendor side sends
 * rupees too), held here as paise. Both sides change together or not at all.
 * The backend's `paymentMode` is not shown — it defaults to `CASH` whether or
 * not anybody said so.
 */
function toPayment(record: Record<string, unknown>): CustomerPaymentRecord | undefined {
  const amount = record.amount;
  if (record.paymentStatus !== 'PAID' || typeof amount !== 'number' || !(amount > 0)) {
    return undefined;
  }

  return {
    finalAmountMinor: Math.round(amount * MINOR_PER_MAJOR),
    currency: AppConfig.money.currency,
    paymentStatus: 'PAID',
  };
}

/**
 * One record in full (section 20).
 *
 * The sub-category is optional, as it is in the backend: a request raised
 * against a category alone still opens, named by its category.
 */
function toDetails(record: Record<string, unknown>): CustomerRequestDetails {
  const summary = toSummary(record);
  const categoryId = referenceId(record.categoryId);
  const subCategoryId = referenceId(record.subCategoryId);
  const categoryName = nameOf(record.categoryId);
  if (!categoryId || !categoryName) {
    throw malformedResponse('request.category');
  }

  // The text the customer confirmed — never the populated `addressId`, which
  // the backend fills with whichever saved address it found first.
  const formattedAddress = requireString(record, 'serviceAddress', 'request');
  const { preferredDate, preferredTime } = fromScheduledAt(record.scheduledAt);

  // The customer's own words, or nothing: a description is optional and never filled in.
  const notes = optionalString(record, 'description');

  const imageUrls = Array.isArray(record.images)
    ? record.images.filter(
        (url): url is string => typeof url === 'string' && url.trim() !== '',
      )
    : [];

  const payment = summary.status === 'COMPLETED' ? toPayment(record) : undefined;

  return {
    ...summary,
    categoryId,
    ...(subCategoryId ? { subCategoryId } : {}),
    categoryName,
    ...(preferredDate ? { preferredDate } : {}),
    ...(preferredTime ? { preferredTime } : {}),
    ...(notes ? { notes } : {}),
    ...(imageUrls.length > 0 ? { imageUrls } : {}),
    address: { formattedAddress },
    ...(payment ? { payment } : {}),
  };
}

/**
 * The parts of the address the app actually holds, in the backend's
 * `serviceAddressDetails` words — nothing more. The app has no second line or
 * landmark; `addressLine` is the street, `locality` the town or city
 * (`RequestAddress`), and a point travels only as a pair. Undefined when there is
 * nothing beyond the text.
 */
function toAddressDetails(address: RequestAddress): Record<string, unknown> | undefined {
  const { addressLine, locality, postalCode, latitude, longitude } = address;
  const hasPoint =
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude);
  const details: Record<string, unknown> = {
    ...(addressLine?.trim() ? { line1: addressLine } : {}),
    ...(locality?.trim() ? { city: locality } : {}),
    ...(postalCode?.trim() ? { pincode: postalCode } : {}),
    ...(hasPoint ? { latitude, longitude } : {}),
  };
  return Object.keys(details).length > 0 ? details : undefined;
}

function toCreated(raw: unknown): CreatedRequest {
  const record = requireRecord(raw, 'createdRequest');
  const reference = optionalString(record, 'requestNumber');

  return {
    id: requireString(record, 'id', 'createdRequest'),
    ...(reference ? { reference } : {}),
    status: toAppRequestStatus(requireString(record, 'status', 'createdRequest')),
    createdAt: requireString(record, 'createdAt', 'createdRequest'),
  };
}

/**
 * Whether a detail failure means "no such request": not found, or an id the
 * backend's validation refused (a stale link from before the switch, `REQ-…`).
 */
function meansNoSuchRequest(error: unknown): boolean {
  return (
    error instanceof AppError &&
    (error.kind === 'notFound' ||
      (error.kind === 'validation' && error.fieldErrors?.id !== undefined))
  );
}

function isPageRequest(request: PageRequest): boolean {
  return (
    Number.isInteger(request.page) &&
    request.page >= AppConfig.pagination.initialPage &&
    Number.isInteger(request.pageSize) &&
    request.pageSize >= 1
  );
}

export interface ApiRequestServiceOptions {
  /** The signed-in customer's id, or null — checked against each record read back. */
  currentCustomerId: () => Promise<string | null>;
}

export class ApiRequestService extends BaseApiService implements RequestService {
  private readonly currentCustomerId: () => Promise<string | null>;

  constructor(options: ApiRequestServiceOptions) {
    super('/requests');
    this.currentCustomerId = options.currentCustomerId;
  }

  async listRecentRequests(limit: number): Promise<CustomerRequest[]> {
    // Clamped to what one page can hold; nothing is asked for none.
    const count = Number.isFinite(limit)
      ? Math.max(0, Math.min(Math.trunc(limit), AppConfig.api.fullListPageSize))
      : 0;
    if (count === 0) {
      return [];
    }

    const page = await this.postPage('/list', {}, {
      page: AppConfig.pagination.initialPage,
      pageSize: count,
    });

    return readRows(page.items.slice(0, count), rowToSummary, 'request');
  }

  async listRequests(
    filter: RequestHistoryFilter,
    request: PageRequest,
  ): Promise<Page<CustomerRequest>> {
    if (filter !== 'all' && !Object.prototype.hasOwnProperty.call(VIEW_STATUSES, filter)) {
      throw new AppError({ kind: 'validation', message: 'Request filter is not one section 23 names' });
    }

    const statuses = filter === 'all' ? [] : VIEW_STATUSES[filter];

    if (statuses.length <= 1) {
      const page = await this.postPage(
        '/list',
        statuses.length === 1 ? { status: statuses[0] } : {},
        request,
      );
      return { ...page, items: readRows(page.items, rowToSummary, 'request') };
    }

    return this.pageLocally(statuses, request);
  }

  async getRequest(requestId: string): Promise<CustomerRequestDetails | null> {
    const customerId = await this.currentCustomerId();
    if (!customerId) {
      throw new AppError({ kind: 'unauthorized', message: 'Request read with no customer session' });
    }

    let data: unknown;
    try {
      data = await this.post<unknown>('/detail', { id: requestId });
    } catch (error) {
      if (meansNoSuchRequest(error)) {
        // Whether, never which: a reference leads back to an address.
        log.info('Request read', { found: false });
        return null;
      }
      throw error;
    }

    const record = requireRecord(data, 'request');
    if (referenceId(record.customerId) !== customerId) {
      log.warn('A request read back for another customer was treated as not found');
      return null;
    }

    log.info('Request read', { found: true });
    return toDetails(record);
  }

  async createRequest(input: CreateRequestInput): Promise<CreatedRequest> {
    const serviceAddress = input.address.formattedAddress;
    if (serviceAddress.trim() === '') {
      // Refused before sending: a request with no address would be given the
      // backend's own invented one.
      throw new AppError({ kind: 'validation', message: 'Request refused before sending: no address' });
    }

    const scheduledAt = toScheduledAt(input.preferredDate, input.preferredTime);
    const hasNotes = typeof input.notes === 'string' && input.notes.trim() !== '';
    const serviceAddressDetails = toAddressDetails(input.address);

    const body: Record<string, unknown> = {
      categoryId: input.categoryId,
      subCategoryId: input.subCategoryId,
      serviceAddress,
      ...(serviceAddressDetails ? { serviceAddressDetails } : {}),
      // Exactly as typed — or no key at all.
      ...(hasNotes ? { description: input.notes } : {}),
      priority: toBackendPriority(input.priority),
      ...(input.vendorId !== undefined ? { vendorId: input.vendorId } : {}),
      ...(scheduledAt !== undefined ? { scheduledAt } : {}),
    };

    const created = toCreated(await this.post<unknown>('', body));

    // The shape, never the contents: notes, the address and the reference all
    // lead back to somebody's home.
    log.info('Request created', {
      categoryId: input.categoryId,
      subCategoryId: input.subCategoryId,
      priority: input.priority,
      dispatch: input.vendorId === undefined ? 'open' : 'directed',
      hasNotes,
      hasSchedule: scheduledAt !== undefined,
      // Kept by the app and not sent: see the file header.
      photosNotSent: input.imageUrls?.length ?? 0,
      timeWithoutDateNotSent: input.preferredDate === undefined && input.preferredTime !== undefined,
    });

    return created;
  }

  /**
   * Cancels while nobody has accepted (owner decision 3D-11). The backend is the
   * authority: it answers the record as it now stands — `CANCELLED`, also when
   * it already was (a retry whose first answer was lost) — or refuses with
   * `409 REQUEST_NOT_CANCELLABLE` because a professional accepted it meanwhile,
   * which is the interface's `refused` outcome. Not the customer's, or gone:
   * `404` rejects as `notFound`. No reason is sent (Phase 1 asks none).
   */
  async cancelRequest(requestId: string): Promise<CancelRequestResult> {
    const customerId = await this.currentCustomerId();
    if (!customerId) {
      throw new AppError({ kind: 'unauthorized', message: 'Cancel with no customer session' });
    }

    let data: unknown;
    try {
      data = await this.post<unknown>('/cancel', { id: requestId });
    } catch (error) {
      if (error instanceof AppError && error.kind === 'conflict' && error.code === 'REQUEST_NOT_CANCELLABLE') {
        log.info('Request cancel refused', { reason: 'notCancellable' });
        return { outcome: 'refused', reason: 'notCancellable' };
      }
      throw error;
    }

    const record = requireRecord(data, 'request');
    if (referenceId(record.customerId) !== customerId) {
      throw malformedResponse('request.customerId');
    }
    const request = toDetails(record);
    // A success that did not cancel would be a record the app must not show as cancelled.
    if (request.status !== 'CANCELLED') {
      throw malformedResponse('request.status');
    }

    log.info('Request cancelled');
    return { outcome: 'cancelled', request };
  }

  /**
   * A view the backend cannot filter: the customer's whole list, kept to the
   * view's statuses and paged here, newest first as the backend sorts it.
   */
  private async pageLocally(
    statuses: readonly string[],
    request: PageRequest,
  ): Promise<Page<CustomerRequest>> {
    if (!isPageRequest(request)) {
      throw new AppError({ kind: 'validation', message: 'Request page is out of range' });
    }

    const wanted = new Set(statuses);
    const seen = new Set<string>();
    const matching: CustomerRequest[] = [];

    // Only this view's statuses are read into cards, so a broken row in another
    // view never counts against this one.
    const rows = (await this.postAllPages('/list', {})).items.filter(
      row => isRecord(row) && typeof row.status === 'string' && wanted.has(row.status),
    );
    for (const summary of readRows(rows, rowToSummary, 'request')) {
      // A request raised between two page reads shifts the next page by one.
      if (!seen.has(summary.id)) {
        seen.add(summary.id);
        matching.push(summary);
      }
    }

    const start = (request.page - AppConfig.pagination.initialPage) * request.pageSize;

    return {
      items: matching.slice(start, start + request.pageSize),
      page: request.page,
      pageSize: request.pageSize,
      total: matching.length,
      hasMore: start + request.pageSize < matching.length,
    };
  }
}
