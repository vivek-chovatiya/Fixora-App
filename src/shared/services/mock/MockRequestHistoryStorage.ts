/**
 * MockRequestHistoryStorage
 *
 * Keeps the requests a customer has raised on this device, so the mock request
 * table still has them after the app is closed and opened again.
 *
 * ⚠️ Local, and a mock's. This is not backend persistence: there is no server,
 * no sync and no history anywhere but this phone. It exists so the flow the
 * product is built around — raise a request, leave, come back to it — can be
 * walked end to end before a backend exists. It belongs to `MockRequestService`
 * and to nothing else; when a real `RequestService` arrives the requests live on
 * the server, and this file and its key are deleted with the mock. No screen,
 * hook or context ever sees it.
 *
 * ⚠️ Never the draft. `RequestDraftStorage` holds a form somebody is still
 * filling in, under its own key, and is cleared the moment the request is sent;
 * this holds what was accepted once it was. Different owner, different lifetime,
 * different key — and neither reads the other, so a sent request can never come
 * back as something to resume.
 *
 * Per customer. Each customer's requests sit under a key of their own, named by
 * the session's customer id, so a second customer signing in on the same device
 * finds their own history and not the first one's.
 *
 * What is kept is the request record the mock holds — identifiers, the backend
 * status exactly as it was, the customer's answers and the names resolved for
 * them. Never anything a screen derives from those: no status wording, tone or
 * progress, which are worked out afresh on every read (`requestStatus.ts`). It
 * includes the service address, on the same terms as the draft: this device
 * only, never logged.
 *
 * Versioned, and strict about what it reads back. History from another schema
 * is ignored rather than migrated, and an entry that does not decode is dropped
 * rather than shown half-formed; the next save writes back only what decoded.
 * Every failure is survivable and nothing here throws: unreadable history reads
 * as none, and a write that fails resolves `false`.
 *
 * The device is reached through `core/storage`'s `KeyValueStorage`, never
 * AsyncStorage directly (CLAUDE.md section 4) — the same keys and JSON as
 * before, so history already on a device is still read. The class keeps its
 * name: AsyncStorage is still what lies underneath.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { getKeyValueStorage } from '@/core/storage/KeyValueStorage';
import type {
  CustomerRequestDetails,
  RequestAddress,
  RequestedVendor,
} from '@/shared/services/types/RequestService';

const log = createLogger('MockRequestHistoryStorage');

/**
 * Bumped whenever `CustomerRequestDetails` changes in a way an old record cannot
 * satisfy.
 *
 * Older history is ignored rather than migrated. This stands in for a table that
 * will live on a server, and a migration for data that only ever exists on
 * development devices is code nobody should have to maintain.
 */
const SCHEMA_VERSION = 1;

export interface MockRequestHistoryStorage {
  /**
   * The customer's saved requests, in no promised order — the table sorts them.
   * Empty when there are none and when they cannot be read. Never throws.
   */
  read(customerId: string): Promise<CustomerRequestDetails[]>;

  /**
   * Saves one request, replacing any already saved under the same reference.
   * Resolves `false` when it could not be written. Never throws.
   */
  save(customerId: string, request: CustomerRequestDetails): Promise<boolean>;
}

/** One key per customer. Encoded, so an id is always a single segment of it. */
function keyFor(customerId: string): string {
  return `${AppConfig.storage.mockRequestHistoryKey}/${encodeURIComponent(customerId)}`;
}

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFilled(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalText(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

/**
 * Leaves out what is undefined, so a record read back has exactly the keys it
 * was saved with — an absent preference stays absent rather than arriving as a
 * key with nothing in it.
 */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function decodeAddress(value: unknown): RequestAddress | null {
  if (!isFields(value)) {
    return null;
  }

  const { formattedAddress, latitude, longitude, addressLine, locality, postalCode, placeId } =
    value;

  if (
    !isFilled(formattedAddress) ||
    !isOptionalNumber(latitude) ||
    !isOptionalNumber(longitude) ||
    !isOptionalText(addressLine) ||
    !isOptionalText(locality) ||
    !isOptionalText(postalCode) ||
    !isOptionalText(placeId)
  ) {
    return null;
  }

  return compact({ formattedAddress, latitude, longitude, addressLine, locality, postalCode, placeId });
}

/** Undefined when there was no preference; null when there was one that does not decode. */
function decodePreferredVendor(value: unknown): RequestedVendor | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isFields(value)) {
    return null;
  }

  const { id, name } = value;

  return isFilled(id) && typeof name === 'string' ? { id, name } : null;
}

/** Undefined when there were no photographs; null when the list does not decode. */
function decodeImageUrls(value: unknown): string[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) && value.every(url => typeof url === 'string')
    ? [...(value as string[])]
    : null;
}

/**
 * One saved request, or null when it is not one.
 *
 * ⚠️ All or nothing. A record missing its address or its reference is not shown
 * with a gap where the field should be — Request Details has no honest way to
 * draw a request nobody could have raised — so it is dropped.
 *
 * The status is taken as any non-empty string, deliberately. Section 21's list
 * is not this file's to enforce, and a status the app does not recognise is
 * already shown safely as unavailable.
 */
function decodeRequest(value: unknown): CustomerRequestDetails | null {
  if (!isFields(value)) {
    return null;
  }

  const {
    id,
    categoryId,
    subCategoryId,
    categoryName,
    serviceName,
    vendorName,
    status,
    priority,
    createdAt,
    preferredDate,
    preferredTime,
    notes,
  } = value;

  // What every request has.
  if (
    !isFilled(id) ||
    !isFilled(categoryId) ||
    !isFilled(subCategoryId) ||
    typeof categoryName !== 'string' ||
    typeof serviceName !== 'string' ||
    !isFilled(status) ||
    !isFilled(priority) ||
    !isFilled(createdAt) ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }

  // What some requests have, which must be the right kind when it is there.
  if (
    !isOptionalText(vendorName) ||
    !isOptionalText(preferredDate) ||
    !isOptionalText(preferredTime) ||
    !isOptionalText(notes)
  ) {
    return null;
  }

  const address = decodeAddress(value.address);
  const imageUrls = decodeImageUrls(value.imageUrls);
  const preferredVendor = decodePreferredVendor(value.preferredVendor);

  if (!address || imageUrls === null || preferredVendor === null) {
    return null;
  }

  return compact({
    id,
    categoryId,
    subCategoryId,
    categoryName,
    serviceName,
    vendorName,
    status,
    priority,
    createdAt,
    preferredDate,
    preferredTime,
    notes,
    imageUrls,
    address,
    preferredVendor,
  });
}

/** Everything that decodes, one record per reference. Never throws. */
function decodeHistory(raw: string | null): CustomerRequestDetails[] {
  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Not logged with the parser's message: it can quote the text it choked on,
    // and that text is somebody's address.
    log.warn('Request history is not valid JSON; ignoring it');
    return [];
  }

  if (!isFields(parsed) || parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.requests)) {
    log.info('Ignoring request history written for another schema', {
      version: isFields(parsed) && typeof parsed.version === 'number' ? parsed.version : 'unknown',
    });
    return [];
  }

  // By reference, the last one written winning: a request saved twice is one
  // request, not two.
  const byReference = new Map<string, CustomerRequestDetails>();
  let dropped = 0;

  for (const entry of parsed.requests) {
    const request = decodeRequest(entry);

    if (request) {
      byReference.delete(request.id);
      byReference.set(request.id, request);
    } else {
      dropped += 1;
    }
  }

  if (dropped > 0) {
    // Counted, never shown: what failed to decode could be anything the record held.
    log.warn('Dropped saved requests that did not decode', { dropped });
  }

  return [...byReference.values()];
}

export class AsyncStorageMockRequestHistory implements MockRequestHistoryStorage {
  async read(customerId: string): Promise<CustomerRequestDetails[]> {
    try {
      return decodeHistory(await getKeyValueStorage().getItem(keyFor(customerId)));
    } catch (error) {
      /*
        Unreadable is none. The customer still has the seed and anything they
        raise this session; only what they raised before is missing, which is
        where they would be without this file at all.

        A warning rather than an error: the shared logger turns an error into a
        red screen in a debug build, and a lost convenience has not earned one.
      */
      log.warn('Failed to read request history', { error: String(error) });
      return [];
    }
  }

  async save(customerId: string, request: CustomerRequestDetails): Promise<boolean> {
    try {
      const key = keyFor(customerId);

      /*
        Read, replace, write.

        Replacing by reference is what stops a request saved twice being listed
        twice. Only what decoded is written back, so history that is corrupt or
        from another schema is replaced rather than carried forward — while a
        read that fails outright throws to the catch below instead, and history
        that was merely unreachable for a moment is never overwritten.
      */
      const saved = decodeHistory(await getKeyValueStorage().getItem(key));
      const requests = [...saved.filter(entry => entry.id !== request.id), request];

      await getKeyValueStorage().setItem(
        key,
        JSON.stringify({ version: SCHEMA_VERSION, requests }),
      );
      return true;
    } catch (error) {
      log.warn('Failed to save request history', { error: String(error) });
      return false;
    }
  }
}
