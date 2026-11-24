/**
 * SessionStorage
 *
 * Persists the signed-in session across app restarts. The only module that
 * touches AsyncStorage for auth state.
 *
 * Phase 1 stores the JWT in AsyncStorage. Moving to the platform keychain later
 * changes only this file.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';

const log = createLogger('SessionStorage');

export type UserRole = 'CUSTOMER' | 'VENDOR' | 'ADMIN';

export interface StoredSession {
  token: string;
  role: UserRole;
}

export const SessionStorage = {
  async load(): Promise<StoredSession | null> {
    try {
      const raw = await AsyncStorage.getItem(AppConfig.storage.sessionKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<StoredSession>;
      return parsed.token && parsed.role ? { token: parsed.token, role: parsed.role } : null;
    } catch (error) {
      log.warn('failed to read session', { error });
      return null;
    }
  },

  async save(session: StoredSession): Promise<void> {
    await AsyncStorage.setItem(AppConfig.storage.sessionKey, JSON.stringify(session));
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AppConfig.storage.sessionKey);
    } catch (error) {
      log.warn('failed to clear session', { error });
    }
  },
};
