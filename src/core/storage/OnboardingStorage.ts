/**
 * OnboardingStorage
 *
 * Remembers that the introduction has been seen, so it is shown once.
 *
 * Separate from SessionStorage rather than a field on the session, because the
 * two answer different questions and have different lifetimes: signing out ends
 * a session but does not make someone a first-time user again, and clearing one
 * must never clear the other.
 *
 * Deliberately an interface with a swappable implementation, matching
 * SessionStorage. Screens never see AsyncStorage, and tests never need it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';

const log = createLogger('OnboardingStorage');

/** The only value ever written. Presence is the flag; the string is for humans. */
const COMPLETED = 'completed';

export interface OnboardingStorage {
  hasCompletedOnboarding(): Promise<boolean>;
  setOnboardingCompleted(): Promise<void>;
  /** Development affordance: makes the next launch a first launch again. */
  clear(): Promise<void>;
}

class AsyncStorageOnboarding implements OnboardingStorage {
  async hasCompletedOnboarding(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(AppConfig.storage.onboardingKey)) === COMPLETED;
    } catch (error) {
      /**
       * An unreadable flag is treated as "not yet completed".
       *
       * The failure mode is showing the introduction twice, which is mildly
       * annoying. Guessing the other way would silently skip it for a genuine
       * first-time user, who then meets a sign-in screen with no idea what the
       * app is.
       */
      log.error('Failed to read onboarding state', { error: String(error) });
      return false;
    }
  }

  async setOnboardingCompleted(): Promise<void> {
    try {
      await AsyncStorage.setItem(AppConfig.storage.onboardingKey, COMPLETED);
    } catch (error) {
      // A failed write means the introduction reappears next launch. That is
      // recoverable, and it must not block the user from reaching sign in now.
      log.error('Failed to persist onboarding state', { error: String(error) });
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AppConfig.storage.onboardingKey);
    } catch (error) {
      log.error('Failed to clear onboarding state', { error: String(error) });
    }
  }
}

let onboardingStorage: OnboardingStorage = new AsyncStorageOnboarding();

export function getOnboardingStorage(): OnboardingStorage {
  return onboardingStorage;
}

/** Swaps the implementation. For tests, and for any future storage migration. */
export function setOnboardingStorage(implementation: OnboardingStorage): void {
  onboardingStorage = implementation;
}
