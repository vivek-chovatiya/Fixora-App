/**
 * The vendor's work, read from the backend's service-request records
 *
 * The one place a backend request becomes what the vendor's screens are built
 * on — a card (`VendorJobSummary`), a request opened (`VendorRequestDetails`),
 * and the four groups of the list (`VendorRequestList`). The request service
 * and the dashboard both read through here (Phase 4A, 17/11/2026), so the
 * dashboard cannot count "4 waiting" over a list of three — the rule the mocks
 * kept by sharing one fixture table.
 *
 * Decisions, against the shared request contract (`requests-contract.md`,
 * 17/11/2026) and `Fixora-Backend/src/services/servicerequest.js`:
 * - **Whose it is** is the record's `vendorId`: this vendor's id, another
 *   vendor's, or null for open dispatch. `POST /requests/list` answers a vendor
 *   with their own records and the open ones they have not declined; the same
 *   route with `declined: true` answers with the open requests they declined.
 *   The groups are built from those two answers, and nothing else, here.
 * - **Waiting** is `PENDING` that is open (`broadcast`) or directed at this
 *   vendor (`directed`, section 31.1). **Held** is this vendor's and accepted,
 *   in progress or finished. **Rejected** is a directed request this vendor
 *   turned down (theirs, `REJECTED`) and every open request in the declined
 *   answer — which stays `REJECTED` to this vendor whatever became of it for
 *   everybody else. Another vendor's record, a cancelled one, and open dispatch
 *   that is no longer open belong to no group.
 * - A record the backend marks `declinedByMe: true` is in the rejected group
 *   whichever answer listed it (the flag is the contract's; the `declinedBy`
 *   array of other vendors' ids is never sent and never read).
 * - ⚠️ **The first answer wins** a record both answers list. The two are
 *   disjoint by contract; a backend that ignored `declined` would answer it with
 *   the whole list again, and nothing in it may then be called declined.
 * - **Statuses and priorities** go through `requestTokens.ts`, the one table.
 *   This vendor's record in a status the app does not know is listed as
 *   active work, not hidden — it is theirs and unfinished as far as anybody
 *   has said — and shown, as every unknown status is, without an action.
 * - **Names** come from the populated references: the sub-category's name is
 *   the service, the category's is the category (the category stands in as the
 *   service when there is no sub-category). The customer's name is first and
 *   last name joined.
 * - **The reference** people quote is `requestNumber` (`REQ-…`), carried as
 *   `reference`; the database id stays `id`, which every call uses.
 * - **The area** (`locality`) is the request's own `serviceAddressDetails`
 *   area and city, else the populated address-book entry's `city` — never a
 *   street line, and never the `serviceAddress` text, which is the full
 *   address on a record from a backend that does not reduce it.
 * - **The preferred date and time** are the backend's one `scheduledAt`,
 *   read in India time through `scheduledAt.ts` — the customer's side's own
 *   reader — never in the phone's zone.
 * - **A completion record** exists on the vendor's finished work only when the
 *   backend says `paymentStatus: 'PAID'` with an amount: the backend does not
 *   keep the vendor's own record (status, method, notes — see
 *   `ApiVendorRequestService`), and its `PENDING` is the default every request
 *   is born with, not something anybody recorded, so it is no record at all.
 *   Its `amount` is whole rupees (the seed's 499 and 299), read as paise.
 *
 * ⚠️ PROJECT_BIBLE.md section 32 (amended 21/10/2026), enforced here as well as
 * on screen and on the backend: a record the vendor does not hold never
 * carries the customer's name, phone or address, however much was sent. The
 * contract has the backend send `{ id, firstName, lastName, phone }` and the
 * full address only for held work, and the area alone otherwise; an older
 * backend sent the whole customer on every row. The mappers read those fields
 * only when the work is held, the backend's own record (`raw`) never leaves
 * this file, and the customer's email is never read at all.
 *
 * ⚠️ `_id` is read only inside `referenceId` (`apiResponse.ts`), to learn which
 * document a populated reference is — and never written into anything the app
 * holds.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import {
  isMalformedResponse,
  isRecord,
  malformedResponse,
  optionalString,
  referenceId,
  requireRecord,
  requireString,
} from '@/shared/services/api/apiResponse';
import { toAppPriority, toAppRequestStatus } from '@/shared/services/api/requestTokens';
import { fromScheduledAt } from '@/shared/services/api/scheduledAt';
import type { RequestStatus } from '@/shared/services/types/RequestService';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';
import {
  PAYMENT_STATUS_PAID,
  type VendorCompletionRecord,
  type VendorRequestDetails,
  type VendorRequestList,
} from '@/shared/services/types/VendorRequestService';

const log = createLogger('vendorWork');

/** The backend's ids: Mongo ObjectIds, 24 hex digits (its Joi `hex().length(24)`). */
const BACKEND_ID = /^[0-9a-f]{24}$/i;

/** Paise per rupee: the backend's `amount` is in rupees, the app holds paise. */
const MINOR_PER_MAJOR = 100;

/** The statuses in which this vendor holds the work (section 32). */
const HELD: ReadonlySet<string> = new Set(['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED']);

/** Held work that is finished. */
const FINISHED: ReadonlySet<string> = new Set(['COMPLETED', 'CLOSED']);

/** How far along active work is: the furthest first (`VendorRequestList.active`). */
const ACTIVE_RANK: Readonly<Record<string, number>> = Object.freeze({
  IN_PROGRESS: 0,
  ACCEPTED: 1,
});

/** The references the backend may send as an id or as the document it names. */
const REFERENCE_KEYS = Object.freeze([
  'customerId',
  'vendorId',
  'categoryId',
  'subCategoryId',
  'addressId',
  'assignedTeamMemberId',
] as const);

/**
 * Whether a reference could be one of the backend's ids. Anything else cannot
 * name a record there, so a service answers `notFound` without asking — the
 * backend would refuse it as invalid input, which is the wrong answer to a
 * stale link.
 */
export function isBackendId(value: string): boolean {
  return BACKEND_ID.test(value);
}

/** One backend request, read as far as the vendor's rules need it. */
export interface VendorRequestRecord {
  id: string;
  /** The app's status (`requestTokens.ts`). */
  status: RequestStatus;
  /** The vendor it belongs to, or undefined for open dispatch nobody has taken. */
  vendorId?: string;
  /** The backend's record. Read by the mappers here; never handed on. */
  raw: Record<string, unknown>;
}

export function readRequestRecord(value: unknown): VendorRequestRecord {
  const raw = requireRecord(value, 'request');
  const vendorId = referenceId(raw.vendorId);

  return {
    id: requireString(raw, 'id', 'request'),
    status: toAppRequestStatus(requireString(raw, 'status', 'request')),
    ...(vendorId ? { vendorId } : {}),
    raw,
  };
}

/**
 * Where a request stands for one vendor.
 *
 * - `waiting` — `PENDING`, open or directed at them: theirs to answer;
 * - `held` — theirs, accepted, in progress or finished;
 * - `declined` — theirs, `REJECTED`;
 * - `unknown` — theirs, in a status the app does not know;
 * - `cancelled` — theirs, `CANCELLED`;
 * - `closed` — open dispatch that is no longer waiting (rejected, cancelled):
 *   nobody's, and no longer offered;
 * - `elsewhere` — another vendor's.
 */
export type VendorStanding =
  | 'waiting'
  | 'held'
  | 'declined'
  | 'unknown'
  | 'cancelled'
  | 'closed'
  | 'elsewhere';

export function standingOf(record: VendorRequestRecord, vendorId: string): VendorStanding {
  if (record.vendorId !== undefined && record.vendorId !== vendorId) {
    return 'elsewhere';
  }
  if (record.status === 'PENDING_VENDOR') {
    return 'waiting';
  }
  if (record.vendorId === undefined) {
    return 'closed';
  }
  if (HELD.has(record.status)) {
    return 'held';
  }
  if (record.status === 'REJECTED') {
    return 'declined';
  }
  return record.status === 'CANCELLED' ? 'cancelled' : 'unknown';
}

/**
 * A fresh record with the references an earlier read had populated put back.
 *
 * The action endpoints (`/requests/accept`, `/reject`, `/start`, `/complete`)
 * answer with the record as it now stands but with every reference as a bare
 * id — no customer, no service name. The service read the same record a
 * moment earlier, populated, to check the step; a reference that still names
 * the same document is that document. One that changed (a vendor id, once
 * accepted) is taken as the fresh record has it.
 */
export function repopulate(
  fresh: Record<string, unknown>,
  earlier: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...fresh };
  for (const key of REFERENCE_KEYS) {
    const before = earlier[key];
    if (
      typeof fresh[key] === 'string' &&
      isRecord(before) &&
      referenceId(before) === referenceId(fresh[key])
    ) {
      merged[key] = before;
    }
  }
  return merged;
}

function nameOf(reference: unknown): string | undefined {
  return isRecord(reference) ? optionalString(reference, 'name') : undefined;
}

/** A timestamp the backend sent, or a refusal. */
function requireInstant(raw: Record<string, unknown>, key: string): string {
  const value = requireString(raw, key, 'request');
  if (Number.isNaN(Date.parse(value))) {
    throw malformedResponse(`request.${key}`);
  }
  return value;
}

function optionalInstant(raw: Record<string, unknown>, key: string): string | undefined {
  const value = optionalString(raw, key);
  return value !== undefined && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

/** Milliseconds, for ordering; a missing or unreadable time sorts last. */
function instant(raw: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = raw[key];
    const ms = typeof value === 'string' ? Date.parse(value) : Number.NaN;
    if (!Number.isNaN(ms)) {
      return ms;
    }
  }
  return Number.NEGATIVE_INFINITY;
}

/** ⚠️ Called only for held work (section 32). */
function customerNameOf(customer: unknown): string | undefined {
  if (!isRecord(customer)) {
    return undefined;
  }
  const name = [optionalString(customer, 'firstName'), optionalString(customer, 'lastName')]
    .filter((part): part is string => part !== undefined)
    .map(part => part.trim())
    .join(' ');
  return name === '' ? undefined : name;
}

/**
 * The area of a request: its own address details' area and city, else the
 * populated address-book entry's city. Never a street, never `serviceAddress`.
 */
function localityOf(raw: Record<string, unknown>): string | undefined {
  const details = isRecord(raw.serviceAddressDetails) ? raw.serviceAddressDetails : undefined;
  const area = details ? optionalString(details, 'area')?.trim() : undefined;
  const city = details ? optionalString(details, 'city')?.trim() : undefined;
  const parts = [area, city].filter((part): part is string => part !== undefined);
  if (parts.length === 2 && parts[0] === parts[1]) {
    parts.pop();
  }
  if (parts.length > 0) {
    return parts.join(', ');
  }
  return isRecord(raw.addressId) ? optionalString(raw.addressId, 'city') : undefined;
}

function imagesOf(raw: Record<string, unknown>): string[] | undefined {
  const images = Array.isArray(raw.images)
    ? raw.images.filter((url): url is string => typeof url === 'string' && url.trim() !== '')
    : [];
  return images.length > 0 ? images : undefined;
}

/** See the header: only the backend's own `PAID`, and only with an amount. */
function completionOf(raw: Record<string, unknown>): VendorCompletionRecord | undefined {
  const amount = raw.amount;
  if (raw.paymentStatus !== 'PAID' || typeof amount !== 'number' || !(amount > 0)) {
    return undefined;
  }
  return {
    finalAmountMinor: Math.round(amount * MINOR_PER_MAJOR),
    currency: AppConfig.money.currency,
    paymentStatus: PAYMENT_STATUS_PAID,
  };
}

/** The amount the backend is sent for a job that came to `finalAmountMinor` paise. */
export function backendAmount(finalAmountMinor: number): number {
  return finalAmountMinor / MINOR_PER_MAJOR;
}

/** A record as a card (section 31's fields), for the vendor asking. */
export function toJobSummary(record: VendorRequestRecord, vendorId: string): VendorJobSummary {
  const { raw } = record;
  const standing = standingOf(record, vendorId);
  const held = standing === 'held';

  const serviceName = nameOf(raw.subCategoryId) ?? nameOf(raw.categoryId);
  if (serviceName === undefined) {
    throw malformedResponse('request.serviceName');
  }
  // Section 32: the customer only on work this vendor holds.
  const customerName = held ? customerNameOf(raw.customerId) : undefined;
  const locality = localityOf(raw);
  const reference = optionalString(raw, 'requestNumber');
  const completedAt = FINISHED.has(record.status) ? optionalInstant(raw, 'completedAt') : undefined;

  return {
    id: record.id,
    ...(reference ? { reference } : {}),
    serviceName,
    ...(customerName ? { customerName } : {}),
    ...(locality ? { locality } : {}),
    priority: toAppPriority(requireString(raw, 'priority', 'request')),
    status: record.status,
    ...(standing === 'waiting'
      ? { dispatch: record.vendorId === vendorId ? ('directed' as const) : ('broadcast' as const) }
      : {}),
    createdAt: requireInstant(raw, 'createdAt'),
    ...(completedAt ? { completedAt } : {}),
  };
}

/**
 * A record opened (section 32), for the vendor asking.
 *
 * ⚠️ Withheld means absent — not null, not "", not masked. The phone and the
 * address are read only for held work, as the name is in `toJobSummary`.
 */
export function toRequestDetails(record: VendorRequestRecord, vendorId: string): VendorRequestDetails {
  const { raw } = record;
  const held = standingOf(record, vendorId) === 'held';
  const summary = toJobSummary(record, vendorId);

  // The category is a line of its own only when the service is a sub-category.
  const categoryName = nameOf(raw.subCategoryId) ? nameOf(raw.categoryId) : undefined;
  const description = optionalString(raw, 'description') ?? optionalString(raw, 'notes');
  const imageUrls = imagesOf(raw);
  const customerPhone =
    held && isRecord(raw.customerId) ? optionalString(raw.customerId, 'phone') : undefined;
  const formattedAddress = held ? optionalString(raw, 'serviceAddress') : undefined;
  const completion = held && FINISHED.has(record.status) ? completionOf(raw) : undefined;

  return {
    ...summary,
    ...(categoryName ? { categoryName } : {}),
    ...(description ? { description } : {}),
    ...(imageUrls ? { imageUrls } : {}),
    ...fromScheduledAt(raw.scheduledAt),
    ...(customerPhone ? { customerPhone } : {}),
    ...(formattedAddress ? { address: { formattedAddress } } : {}),
    ...(completion ? { completion } : {}),
  };
}

interface Placed {
  record: VendorRequestRecord;
  summary: VendorJobSummary;
}

const newestFirst = (...keys: string[]) => (a: Placed, b: Placed) =>
  instant(b.record.raw, ...keys) - instant(a.record.raw, ...keys);

function activeRank(placed: Placed): number {
  return ACTIVE_RANK[placed.record.status] ?? Object.keys(ACTIVE_RANK).length;
}

/**
 * A record from the declined answer, as this vendor sees it: `REJECTED`,
 * whatever it is for everybody else (`VendorRequestList.rejected`).
 */
export function asDeclined(record: VendorRequestRecord): VendorRequestRecord {
  return { ...record, status: 'REJECTED' };
}

/**
 * Everything the backend listed, sorted into the vendor's groups and the
 * orders the contract gives them. `declinedRows` is the `declined: true`
 * answer — the dashboard passes none. A record listed twice (one added between
 * two page reads shifts the next page by one, or both answers name it) is kept
 * once, as the first answer has it.
 *
 * A row that breaks the contract — no service name, no id, no priority — is
 * left out rather than failing the vendor's whole list or dashboard (code
 * review, 17/11/2026), and counted in one log line: never its id or contents.
 */
export function groupVendorWork(
  rows: readonly unknown[],
  vendorId: string,
  declinedRows: readonly unknown[] = [],
): VendorRequestList {
  const seen = new Set<string>();
  const pending: Placed[] = [];
  const active: Placed[] = [];
  const completed: Placed[] = [];
  const rejected: Placed[] = [];

  let skipped = 0;
  /** `place`, or a count of one more row left out when the row breaks the contract. */
  const tryPlace = (place: () => void) => {
    try {
      place();
    } catch (error) {
      if (!isMalformedResponse(error)) {
        throw error;
      }
      skipped += 1;
    }
  };

  const placeRow = (row: unknown): void => {
    const read = readRequestRecord(row);
    if (seen.has(read.id)) {
      return;
    }
    seen.add(read.id);

    // The backend's own word that this vendor declined it: theirs as `REJECTED`.
    const record = read.raw.declinedByMe === true ? asDeclined(read) : read;
    const standing = standingOf(record, vendorId);
    const group =
      standing === 'waiting'
        ? pending
        : standing === 'held'
          ? FINISHED.has(record.status)
            ? completed
            : active
          : standing === 'declined' || record.raw.declinedByMe === true
            ? rejected
            : standing === 'unknown'
              ? active
              : undefined;
    group?.push({ record, summary: toJobSummary(record, vendorId) });
  };

  for (const row of rows) {
    tryPlace(() => placeRow(row));
  }

  for (const row of declinedRows) {
    tryPlace(() => {
      const record = asDeclined(readRequestRecord(row));
      if (seen.has(record.id)) {
        return;
      }
      seen.add(record.id);
      rejected.push({ record, summary: toJobSummary(record, vendorId) });
    });
  }

  if (skipped > 0) {
    log.warn('Requests that break the contract were left out', { skipped });
  }

  pending.sort(newestFirst('createdAt'));
  const latest = newestFirst('updatedAt', 'createdAt');
  active.sort((a, b) => activeRank(a) - activeRank(b) || latest(a, b));
  completed.sort(newestFirst('completedAt', 'updatedAt'));
  rejected.sort(latest);

  const summaries = (placed: Placed[]) => placed.map(entry => entry.summary);
  return {
    pending: summaries(pending),
    active: summaries(active),
    completed: summaries(completed),
    rejected: summaries(rejected),
  };
}
