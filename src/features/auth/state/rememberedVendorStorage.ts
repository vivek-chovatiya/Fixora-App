/**
 * RememberedVendorStorage
 *
 * Remembers which phone number a vendor last signed in with on this device, so
 * the next vendor sign in asks only for the auth code (PROJECT_BIBLE.md section
 * 7A.2, amended 21/10/2026: "remembers the phone number (never the code)").
 *
 * ⚠️ It holds a phone number and can hold nothing else. The vendor auth code is a
 * standing credential that must never be persisted beyond the request that uses
 * it (PROJECT_BIBLE.md section 7A.2), and this file is the most likely place for
 * someone to "helpfully" keep it. So `remember` takes one string, normalises it
 * to digits and refuses anything the shared phone rule would refuse — a code is
 * six digits, a phone number at least ten, so even a code passed here by mistake
 * is turned away rather than written.
 *
 * Feature-scoped and deliberately small, like `requestDraftStorage`: it is not
 * the auth module's general storage. Like that file it reaches the device
 * through `core/storage`'s `KeyValueStorage` rather than importing AsyncStorage,
 * which CLAUDE.md keeps inside `src/core/storage`.
 *
 * Signing out does not clear it — a vendor who signs out and back in is exactly
 * who it is for. Only "Use a different number" forgets it, or a newer vendor
 * signing in on the same device replaces it.
 *
 * ⚠️ Every failure is survivable and none is thrown. Nothing remembered means the
 * sign-in screen asks for the phone number, which is where every vendor started
 * before this existed — so an unreadable, unparseable or outdated value is
 * treated as nothing, and a failed write leaves the sign in that triggered it
 * untouched. Logs carry an error's name at most and never a value — every value
 * here is a phone number, and a parse error would quote the text it choked on,
 * which is why an unparseable value is discarded without its error being logged.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { getKeyValueStorage } from '@/core/storage/KeyValueStorage';
import { normalisePhone, phoneSchema } from '@/shared/validation/phone';

const log = createLogger('RememberedVendorStorage');

/**
 * Bumped whenever the stored shape changes.
 *
 * An older shape is discarded rather than migrated: the cost of losing it is one
 * phone number typed again, which no migration is worth.
 */
const SCHEMA_VERSION = 1;

interface StoredVendor {
  version: number;
  /** Digits only, as `normalisePhone` leaves them. */
  phone: string;
}

export interface RememberedVendorStorage {
  /** The remembered phone, digits only, or null. Never throws. */
  read(): Promise<string | null>;
  /**
   * Remembers this phone in place of any other. Resolves false when nothing was
   * written — refused as not a phone number, or the device failed. Never throws.
   */
  remember(phone: string): Promise<boolean>;
  /** Forgets the remembered phone. Never throws. */
  forget(): Promise<void>;
}

/**
 * The phone as it is kept, or null when it is not a phone number by the same
 * rule every phone field uses — so whatever is read back is guaranteed to pass
 * the sign-in form's own check.
 */
function toRememberedPhone(phone: string): string | null {
  const digits = normalisePhone(phone);
  return phoneSchema.safeParse(digits).success ? digits : null;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}

/**
 * The phone in a stored value, or null when the value is not exactly what this
 * build writes — another version, another shape, not JSON at all, or a phone
 * that was not stored as clean digits.
 *
 * Unparseable is "unusable", not "failed": the device answered, and what it
 * answered with is simply not a remembered vendor.
 */
function phoneFrom(raw: string): string | null {
  let stored: Partial<StoredVendor> | null;
  try {
    stored = JSON.parse(raw) as Partial<StoredVendor> | null;
  } catch {
    return null;
  }

  if (stored?.version !== SCHEMA_VERSION || typeof stored.phone !== 'string') {
    return null;
  }

  return toRememberedPhone(stored.phone) === stored.phone ? stored.phone : null;
}

/** Exported for its tests; the app reaches it through `getRememberedVendorStorage`. */
export class DeviceRememberedVendorStorage implements RememberedVendorStorage {
  async read(): Promise<string | null> {
    let raw: string | null;
    try {
      raw = await getKeyValueStorage().getItem(AppConfig.storage.rememberedVendorKey);
    } catch (error) {
      log.error('Failed to read the remembered vendor', { error: errorName(error) });
      return null;
    }

    if (raw === null) {
      return null;
    }

    const phone = phoneFrom(raw);
    if (phone === null) {
      // Dropped, so it is not re-read and re-discarded on every visit.
      log.info('Discarding a remembered vendor this build cannot use');
      await this.forget();
    }
    return phone;
  }

  async remember(phone: string): Promise<boolean> {
    const digits = toRememberedPhone(phone);

    if (digits === null) {
      // Says that something was refused, never what it was.
      log.warn('Refused to remember a value that is not a phone number');
      return false;
    }

    try {
      const stored: StoredVendor = { version: SCHEMA_VERSION, phone: digits };
      await getKeyValueStorage().setItem(
        AppConfig.storage.rememberedVendorKey,
        JSON.stringify(stored),
      );
      return true;
    } catch (error) {
      // The sign in that asked for this has already succeeded; only the shortcut
      // next time is lost.
      log.error('Failed to remember the vendor', { error: errorName(error) });
      return false;
    }
  }

  async forget(): Promise<void> {
    try {
      await getKeyValueStorage().removeItem(AppConfig.storage.rememberedVendorKey);
    } catch (error) {
      // The number may be offered again next time; "Use a different number"
      // still works then, so this is logged and not raised.
      log.error('Failed to forget the remembered vendor', { error: errorName(error) });
    }
  }
}

let rememberedVendorStorage: RememberedVendorStorage = new DeviceRememberedVendorStorage();

export function getRememberedVendorStorage(): RememberedVendorStorage {
  return rememberedVendorStorage;
}

/** Swaps the implementation. For tests, and for any future storage migration. */
export function setRememberedVendorStorage(implementation: RememberedVendorStorage): void {
  rememberedVendorStorage = implementation;
}
