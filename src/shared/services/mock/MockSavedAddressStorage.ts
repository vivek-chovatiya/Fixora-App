/**
 * MockSavedAddressStorage
 *
 * Keeps a customer's saved addresses on this device, so the address book is
 * still there after the app is closed and opened again.
 *
 * ⚠️ Local, and a mock's — the same terms as `MockRequestHistoryStorage` and
 * `MockReviewStorage`. There is no server and no sync. It belongs to
 * `MockAddressBookService` and goes with it when a real `AddressBookService`
 * arrives.
 *
 * ⚠️ Its own key, never the draft's, the history's or the reviews'. An address
 * book outlives every request: the draft is one unfinished form and is cleared
 * when it is sent, the history is what a request became, and a review is about
 * one request. These are none of those, so they are stored apart and can be
 * cleared apart.
 *
 * Per customer, keyed by the session's customer id, so a second customer on the
 * same device never sees the first one's addresses — and, unlike the draft, they
 * are **not** cleared at logout. They are the customer's own records, exactly as
 * their submitted requests and reviews are (Phase 3D-7).
 *
 * What is kept is the address as the mock accepted it. Versioned and strict:
 * another schema is ignored, an entry that does not decode is dropped, and
 * nothing here throws.
 *
 * The device is reached through `core/storage`'s `KeyValueStorage`, never
 * AsyncStorage directly (CLAUDE.md section 4) — the same keys and JSON as
 * before. The class keeps its name: AsyncStorage is still what lies underneath.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { getKeyValueStorage } from '@/core/storage/KeyValueStorage';
import type { SavedAddress } from '@/shared/services/types/AddressBookService';

const log = createLogger('MockSavedAddressStorage');

/** Bumped whenever `SavedAddress` changes in a way an old record cannot satisfy. */
const SCHEMA_VERSION = 1;

export interface MockSavedAddressStorage {
  /** The customer's addresses. Empty when there are none or they cannot be read. Never throws. */
  read(customerId: string): Promise<SavedAddress[]>;

  /** Replaces the whole collection. Resolves `false` when it could not be written. Never throws. */
  write(customerId: string, addresses: readonly SavedAddress[]): Promise<boolean>;
}

function keyFor(customerId: string): string {
  return `${AppConfig.storage.mockSavedAddressKey}/${encodeURIComponent(customerId)}`;
}

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFilled(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** An optional string field: absent, or present and not blank. */
function optionalText(value: unknown): value is string | undefined {
  return value === undefined || isFilled(value);
}

/** An optional coordinate: absent, or a real finite number. */
function optionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

/** One saved address, or null when it is not one. All or nothing. */
function decodeAddress(value: unknown): SavedAddress | null {
  if (!isFields(value)) {
    return null;
  }

  const { id, formattedAddress, addressLine, locality, postalCode, isDefault } = value;
  const { placeId, latitude, longitude } = value;

  if (
    !isFilled(id) ||
    !isFilled(formattedAddress) ||
    typeof isDefault !== 'boolean' ||
    !optionalText(addressLine) ||
    !optionalText(locality) ||
    !optionalText(postalCode) ||
    !optionalText(placeId) ||
    !optionalNumber(latitude) ||
    !optionalNumber(longitude)
  ) {
    return null;
  }

  /*
    Coordinates are both or neither, as `RequestAddress` requires of them. Half
    a position is worse than none: it would convert into a request address that
    a backend cannot use and cannot reject as obviously missing.
  */
  const hasPoint = latitude !== undefined && longitude !== undefined;

  return {
    id,
    formattedAddress,
    isDefault,
    ...(addressLine === undefined ? {} : { addressLine }),
    ...(locality === undefined ? {} : { locality }),
    ...(postalCode === undefined ? {} : { postalCode }),
    ...(placeId === undefined ? {} : { placeId }),
    ...(hasPoint ? { latitude, longitude } : {}),
  };
}

/**
 * Everything that decodes, with the collection's own rule applied.
 *
 * ⚠️ "Exactly one default" is repaired on the way out rather than trusted. A
 * record that did not decode may have been the default, and a file edited by
 * hand may have none or several; the screen must not have to cope with either,
 * so the first flagged address keeps the flag, and a non-empty collection with
 * no flag at all gets one. It is the same rule the service maintains, applied
 * where corruption can break it.
 */
function decodeAddresses(raw: string | null): SavedAddress[] {
  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Not logged with the parser's message: it can quote an address.
    log.warn('Saved addresses are not valid JSON; ignoring them');
    return [];
  }

  if (!isFields(parsed) || parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.addresses)) {
    log.info('Ignoring addresses written for another schema', {
      version: isFields(parsed) && typeof parsed.version === 'number' ? parsed.version : 'unknown',
    });
    return [];
  }

  const seen = new Set<string>();
  const addresses: SavedAddress[] = [];
  let dropped = 0;

  for (const entry of parsed.addresses) {
    const address = decodeAddress(entry);

    // A duplicated id would make edit and delete ambiguous, so the first wins.
    if (address && !seen.has(address.id)) {
      seen.add(address.id);
      addresses.push(address);
    } else {
      dropped += 1;
    }
  }

  if (dropped > 0) {
    log.warn('Dropped saved addresses that did not decode', { dropped });
  }

  if (addresses.length === 0) {
    return addresses;
  }

  const defaultAt = addresses.findIndex(address => address.isDefault);
  const keep = defaultAt === -1 ? 0 : defaultAt;

  return addresses.map((address, index) => ({ ...address, isDefault: index === keep }));
}

export class AsyncStorageMockSavedAddresses implements MockSavedAddressStorage {
  async read(customerId: string): Promise<SavedAddress[]> {
    try {
      return decodeAddresses(await getKeyValueStorage().getItem(keyFor(customerId)));
    } catch (error) {
      /*
        Unreadable is treated as an empty book.

        The customer sees the empty state and can add an address again, which is
        where they would be without this feature at all. Throwing would take the
        screen down over storage the mock owns.
      */
      log.error('Failed to read saved addresses', { error: String(error) });
      return [];
    }
  }

  async write(customerId: string, addresses: readonly SavedAddress[]): Promise<boolean> {
    try {
      await getKeyValueStorage().setItem(
        keyFor(customerId),
        JSON.stringify({ version: SCHEMA_VERSION, addresses }),
      );
      return true;
    } catch (error) {
      // The caller decides what a failed write means; here it is only reported.
      log.error('Failed to save addresses', { error: String(error) });
      return false;
    }
  }
}
