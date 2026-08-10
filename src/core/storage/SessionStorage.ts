/**
 * SessionStorage
 *
 * Persists the signed-in session across app launches.
 *
 * Deliberately an interface with a swappable implementation. The default is
 * backed by AsyncStorage, which stores values in plaintext on the device. That is
 * acceptable for Phase 1 — the backend remains the authority on every request
 * (PROJECT_BIBLE.md section 52) and a stolen token is invalidated server-side —
 * but it is not encrypted at rest.
 *
 * Moving to the OS keystore (react-native-keychain) later means writing one new
 * implementation and calling `setSessionStorage`. No caller changes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import type { AuthUser } from '@/features/auth/types';

const log = createLogger('SessionStorage');

export interface PersistedSession {
  token: string;
  user: AuthUser;
}

export interface SessionStorage {
  read(): Promise<PersistedSession | null>;
  write(session: PersistedSession): Promise<void>;
  clear(): Promise<void>;
}

/**
 * A session that cannot be parsed is treated as no session at all, and the bad
 * value is removed. Throwing here would leave the user permanently stuck on the
 * splash screen with no way to recover short of reinstalling.
 */
function parseSession(raw: string | null): PersistedSession | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (typeof parsed.token === 'string' && parsed.token.length > 0 && parsed.user) {
      return parsed as PersistedSession;
    }
    log.warn('Stored session is incomplete; discarding.');
    return null;
  } catch (error) {
    log.warn('Stored session is not valid JSON; discarding.', { error: String(error) });
    return null;
  }
}

class AsyncStorageSession implements SessionStorage {
  async read(): Promise<PersistedSession | null> {
    try {
      const raw = await AsyncStorage.getItem(AppConfig.storage.sessionKey);
      const session = parseSession(raw);
      if (raw && !session) {
        await this.clear();
      }
      return session;
    } catch (error) {
      log.error('Failed to read session', { error: String(error) });
      return null;
    }
  }

  async write(session: PersistedSession): Promise<void> {
    try {
      await AsyncStorage.setItem(AppConfig.storage.sessionKey, JSON.stringify(session));
    } catch (error) {
      // A failed write means the user is signed in for this launch only. That is
      // recoverable, so it must not break the sign-in they just completed.
      log.error('Failed to persist session', { error: String(error) });
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AppConfig.storage.sessionKey);
    } catch (error) {
      log.error('Failed to clear session', { error: String(error) });
    }
  }
}

let sessionStorage: SessionStorage = new AsyncStorageSession();

export function getSessionStorage(): SessionStorage {
  return sessionStorage;
}

/** Swaps the implementation. For tests, and for the future keystore migration. */
export function setSessionStorage(implementation: SessionStorage): void {
  sessionStorage = implementation;
}
