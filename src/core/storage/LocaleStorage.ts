/**
 * LocaleStorage
 *
 * Remembers the language chosen on this device, so it is asked once
 * (phase5-contract.md section 7).
 *
 * Separate from the session and from onboarding for the reason those two are
 * separate from each other: different questions, different lifetimes. Signing
 * out keeps it; clearing the session must never send someone back to the
 * language chooser.
 *
 * Built on `KeyValueStorage`, the door feature-owned keys go through, and
 * swappable like its neighbours so tests never need AsyncStorage.
 *
 * ⚠️ Answers rather than rejects, as `OnboardingStorage` does. An unreadable or
 * unrecognised value reads as "nothing saved", whose cost is showing the
 * chooser once more — mild. Reading it the other way would silently keep a
 * first-time user in a language they never chose. A failed write is logged and
 * survived: the choice still applies for this launch.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { isAppLocale, type AppLocale } from '@/core/i18n/locale';
import { createLogger } from '@/core/logger/Logger';
import { getKeyValueStorage } from '@/core/storage/KeyValueStorage';

const log = createLogger('LocaleStorage');

export interface LocaleStorage {
  /** The saved language, or null when none is saved (or it could not be read). */
  read(): Promise<AppLocale | null>;
  write(locale: AppLocale): Promise<void>;
  /** Development affordance: makes the next launch ask again. */
  clear(): Promise<void>;
}

class KeyValueLocaleStorage implements LocaleStorage {
  async read(): Promise<AppLocale | null> {
    try {
      const stored = await getKeyValueStorage().getItem(AppConfig.storage.localeKey);
      if (stored === null) {
        return null;
      }
      if (isAppLocale(stored)) {
        return stored;
      }
      // A language this build does not speak — written by a newer build, or
      // damaged. Asking again is the recovery.
      log.warn('Saved language is not one this app speaks; asking again.');
      return null;
    } catch (error) {
      log.error('Failed to read the saved language', { error: String(error) });
      return null;
    }
  }

  async write(locale: AppLocale): Promise<void> {
    try {
      await getKeyValueStorage().setItem(AppConfig.storage.localeKey, locale);
    } catch (error) {
      log.error('Failed to save the language', { error: String(error) });
    }
  }

  async clear(): Promise<void> {
    try {
      await getKeyValueStorage().removeItem(AppConfig.storage.localeKey);
    } catch (error) {
      log.error('Failed to clear the saved language', { error: String(error) });
    }
  }
}

let localeStorage: LocaleStorage = new KeyValueLocaleStorage();

export function getLocaleStorage(): LocaleStorage {
  return localeStorage;
}

/** Swaps the implementation. For tests. */
export function setLocaleStorage(implementation: LocaleStorage): void {
  localeStorage = implementation;
}
