/**
 * KeyValueStorage
 *
 * Strings on the device, by key — the door a feature's own small storage module
 * goes through instead of importing AsyncStorage itself.
 *
 * `SessionStorage` and `OnboardingStorage` each reach AsyncStorage directly
 * because each is the whole of its own job. A feature module (the remembered
 * vendor phone was the first, the request draft followed) owns a rule — what
 * may be kept, in what shape, at what version — but must not own the device:
 * CLAUDE.md keeps AsyncStorage inside `src/core/storage`, and this is how a
 * feature keeps to that. The mock backends' own stores go through it too, for
 * the same reason; every key any of them uses was already under the prefix
 * below, so none was renamed and nothing already on a device was lost.
 *
 * Deliberately three calls and nothing else. No JSON, no versions, no defaults:
 * those are the feature's decisions, and a primitive that made them would be
 * making them for every caller at once.
 *
 * ⚠️ Every key must sit under `AppConfig.storage.keyPrefix`. One namespace is
 * what makes "clear Fixora's data" unambiguous, and a key outside it is refused
 * here rather than discovered later as something a clear left behind.
 *
 * ⚠️ It rejects rather than swallowing. Whether a failed read means "nothing
 * stored" or a failed write is survivable is the caller's call — this file
 * cannot know which, and guessing would hide a failure the caller must answer.
 * Nothing here logs a value: a caller's value may be personal.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import { AppError } from '@/shared/types/error';

export interface KeyValueStorage {
  /** The stored string, or null when there is none. Rejects if the device could not be read. */
  getItem(key: string): Promise<string | null>;
  /** Replaces whatever the key held. Rejects if the device could not be written. */
  setItem(key: string, value: string): Promise<void>;
  /** Removes the key; removing an absent key is not a failure. */
  removeItem(key: string): Promise<void>;
}

/**
 * Refuses a key outside the app's namespace.
 *
 * The key is safe to put in the error: keys are constants from AppConfig, never
 * something a person typed.
 */
function requireAppKey(key: string): void {
  if (!key.startsWith(`${AppConfig.storage.keyPrefix}/`)) {
    throw new AppError({
      kind: 'unknown',
      message: `Storage key "${key}" is outside ${AppConfig.storage.keyPrefix}`,
    });
  }
}

class AsyncKeyValueStorage implements KeyValueStorage {
  async getItem(key: string): Promise<string | null> {
    requireAppKey(key);
    return AsyncStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    requireAppKey(key);
    await AsyncStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    requireAppKey(key);
    await AsyncStorage.removeItem(key);
  }
}

let keyValueStorage: KeyValueStorage = new AsyncKeyValueStorage();

export function getKeyValueStorage(): KeyValueStorage {
  return keyValueStorage;
}

/** Swaps the implementation. For tests, and for a future encrypted store. */
export function setKeyValueStorage(implementation: KeyValueStorage): void {
  keyValueStorage = implementation;
}
