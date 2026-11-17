/**
 * MockVendorProfileStorage
 *
 * Keeps a vendor's business profile on this device, so it is still there after
 * the app is closed and opened again (Phase 3E-1).
 *
 * ⚠️ Local, and a mock's — the same terms as `MockSavedAddressStorage`. There is
 * no server and no sync; it goes when a real `VendorProfileService` arrives.
 *
 * Per vendor, keyed by the session's vendor id, so a second vendor on the same
 * device never sees the first one's business. Not cleared at logout: it is the
 * vendor's own record, as a customer's addresses are.
 *
 * Only the business fields are kept. The owner's name and contact details are
 * the account's and are read from the session every time, so there is never a
 * stored copy to go stale.
 *
 * Versioned and strict: another schema is ignored, a record that does not
 * decode is treated as no record, and nothing here throws.
 *
 * ⚠️ Shop images (section 38) were added beside the business without a new
 * schema version, because a record written before them still satisfies the
 * shape: `shopImageUrls` is optional here and an old record simply has none,
 * which the service reads as an empty list. Bumping the version would have
 * made every saved profile unreadable — sending each vendor back through setup
 * for a field they had never filled in. A list that *is* there and is not a
 * list of URLs is corrupt like any other field: all or nothing.
 *
 * ⚠️ Availability and working hours (section 38) were added the same way and
 * for the same reason, still under version 1: a record without them is read as
 * accepting new requests and as the default week (the service supplies both),
 * so no vendor is sent back through setup. Either one present and not what the
 * service would have stored — a flag that is not true or false, a week that is
 * not the seven days in order with sound times — makes the whole record read
 * as none, as any corrupt field does. The week is checked by the very rules the
 * service applies before storing one (`decodeWorkingHours`), so what this file
 * accepts and what the service writes cannot drift apart.
 *
 * The device is reached through `core/storage`'s `KeyValueStorage`, never
 * AsyncStorage directly (CLAUDE.md section 4) — the same keys and JSON as
 * before. The class keeps its name: AsyncStorage is still what lies underneath.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { getKeyValueStorage } from '@/core/storage/KeyValueStorage';
import {
  VENDOR_WORKING_DAYS,
  VENDOR_WORKING_TIME_FORMAT,
  type VendorProfileUpdate,
  type VendorWorkingDay,
} from '@/shared/services/types/VendorProfileService';

const log = createLogger('MockVendorProfileStorage');

/** Bumped whenever the stored shape changes in a way an old record cannot satisfy. */
const SCHEMA_VERSION = 1;

/** What is stored: exactly what setup saves, and the shop images kept beside it. */
export interface StoredVendorProfile extends VendorProfileUpdate {
  /** Absent in a record written before shop images existed; read as none. */
  shopImageUrls?: string[];
  /** Absent in a record written before availability existed; read as accepting. */
  acceptingRequests?: boolean;
  /** Absent in a record written before working hours existed; read as the default week. */
  workingHours?: VendorWorkingDay[];
}

export interface MockVendorProfileStorage {
  /** The vendor's saved business, or null when there is none or it cannot be read. Never throws. */
  read(vendorId: string): Promise<StoredVendorProfile | null>;

  /** Replaces the record. Resolves `false` when it could not be written. Never throws. */
  write(vendorId: string, profile: StoredVendorProfile): Promise<boolean>;
}

function keyFor(vendorId: string): string {
  return `${AppConfig.storage.mockVendorProfileKey}/${encodeURIComponent(vendorId)}`;
}

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFilled(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function optionalText(value: unknown): value is string | undefined {
  return value === undefined || isFilled(value);
}

function isWorkingTime(value: unknown): value is string {
  return typeof value === 'string' && VENDOR_WORKING_TIME_FORMAT.test(value);
}

/**
 * A working week exactly as the service stores one, or null when it is not
 * one: the seven days in order, Monday first; an open day with both times,
 * closing after opening (no overnight shift); a closed day with neither. All
 * or nothing — a single day out of place refuses the whole week.
 *
 * ⚠️ The service's own check on what it is sent, as well as this file's on
 * what it reads back — one set of rules, so the two can never disagree about
 * what a week is. Answers with fresh objects holding only the known fields.
 */
export function decodeWorkingHours(value: unknown): VendorWorkingDay[] | null {
  if (!Array.isArray(value) || value.length !== VENDOR_WORKING_DAYS.length) {
    return null;
  }

  const week: VendorWorkingDay[] = [];
  for (let index = 0; index < VENDOR_WORKING_DAYS.length; index += 1) {
    const day = VENDOR_WORKING_DAYS[index];
    const entry: unknown = value[index];
    if (!isFields(entry)) {
      return null;
    }
    const { isOpen, opensAt, closesAt } = entry;

    // Exactly this day in this place: none missing, none twice, none unknown.
    if (entry.day !== day || typeof isOpen !== 'boolean') {
      return null;
    }
    if (!isOpen) {
      // A closed day with hours is two answers to one question.
      if (opensAt !== undefined || closesAt !== undefined) {
        return null;
      }
      week.push({ day, isOpen });
      continue;
    }
    // Zero-padded 24-hour times compare correctly as text.
    if (!isWorkingTime(opensAt) || !isWorkingTime(closesAt) || closesAt <= opensAt) {
      return null;
    }
    week.push({ day, isOpen, opensAt, closesAt });
  }

  return week;
}

/** The stored business, or null when it is not one. All or nothing. */
export function decodeVendorProfile(value: unknown): StoredVendorProfile | null {
  if (!isFields(value)) {
    return null;
  }

  const {
    businessName,
    description,
    serviceCategoryIds,
    serviceArea,
    imageUrl,
    shopImageUrls,
    acceptingRequests,
    workingHours,
  } = value;

  if (
    !isFilled(businessName) ||
    !optionalText(description) ||
    !optionalText(imageUrl) ||
    !Array.isArray(serviceCategoryIds) ||
    !serviceCategoryIds.every(isFilled)
  ) {
    return null;
  }

  if (
    shopImageUrls !== undefined &&
    !(Array.isArray(shopImageUrls) && shopImageUrls.every(isFilled))
  ) {
    return null;
  }

  if (serviceArea !== undefined && !(isFields(serviceArea) && isFilled(serviceArea.description))) {
    return null;
  }

  if (acceptingRequests !== undefined && typeof acceptingRequests !== 'boolean') {
    return null;
  }

  const week = workingHours === undefined ? undefined : decodeWorkingHours(workingHours);
  if (week === null) {
    return null;
  }

  return {
    businessName,
    // A duplicated id would read as the same service offered twice.
    serviceCategoryIds: [...new Set(serviceCategoryIds as string[])],
    ...(description === undefined ? {} : { description }),
    ...(serviceArea === undefined
      ? {}
      : { serviceArea: { description: (serviceArea as { description: string }).description } }),
    ...(imageUrl === undefined ? {} : { imageUrl }),
    // A repeated URL would draw the same photograph twice; the first keeps its place.
    ...(shopImageUrls === undefined
      ? {}
      : { shopImageUrls: [...new Set(shopImageUrls as string[])] }),
    ...(acceptingRequests === undefined ? {} : { acceptingRequests }),
    ...(week === undefined ? {} : { workingHours: week }),
  };
}

function decode(raw: string | null): StoredVendorProfile | null {
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Not logged with the parser's message: it can quote the business.
    log.warn('Vendor profile is not valid JSON; ignoring it');
    return null;
  }

  if (!isFields(parsed) || parsed.version !== SCHEMA_VERSION) {
    log.info('Ignoring a vendor profile written for another schema', {
      version: isFields(parsed) && typeof parsed.version === 'number' ? parsed.version : 'unknown',
    });
    return null;
  }

  const profile = decodeVendorProfile(parsed.profile);
  if (!profile) {
    log.warn('Vendor profile did not decode; ignoring it');
  }

  return profile;
}

export class AsyncStorageMockVendorProfiles implements MockVendorProfileStorage {
  async read(vendorId: string): Promise<StoredVendorProfile | null> {
    try {
      return decode(await getKeyValueStorage().getItem(keyFor(vendorId)));
    } catch (error) {
      /*
        Unreadable is treated as not set up. The vendor is offered setup again,
        which is where they would be without a record at all; throwing would
        keep them out of the app over storage the mock owns.
      */
      log.error('Failed to read vendor profile', { error: String(error) });
      return null;
    }
  }

  async write(vendorId: string, profile: StoredVendorProfile): Promise<boolean> {
    try {
      await getKeyValueStorage().setItem(
        keyFor(vendorId),
        JSON.stringify({ version: SCHEMA_VERSION, profile }),
      );
      return true;
    } catch (error) {
      log.error('Failed to save vendor profile', { error: String(error) });
      return false;
    }
  }
}
