/**
 * Onboarding copy
 *
 * Every user-facing string for the introduction, in one place, so the flow can
 * be translated or reworded without opening a screen.
 *
 * ⚠️ Onboarding is a promise. Whatever it says the app does, the app must do in
 * Phase 1 — so two lines from the supplied design were deliberately not used:
 *
 *   "Track your requests in real-time"  → live tracking is Phase 2 (section 65).
 *                                         Request tracking by status is Phase 1,
 *                                         and that is what this says instead.
 *   "chat and important alerts"         → chat is Phase 2 (section 64), so the
 *                                         notification line does not mention it.
 *
 * Promising either would have the introduction advertising features the launch
 * build cannot show, which is worse than a plainer sentence.
 */

import type { IconName } from '@/shared/theme';
import type { PermissionKind } from '@/shared/services/types/PermissionService';

export interface PermissionCopy {
  kind: PermissionKind;
  icon: IconName;
  title: string;
  body: string;
  allow: string;
  allowHint: string;
  decline: string;
  declineHint: string;
  /** Shown once the system has been asked and said no. */
  denied: string;
  /** Shown when the system will no longer ask, so only Settings can change it. */
  blocked: string;
  /** Shown once it has been allowed. */
  granted: string;
}

export interface OnboardingPageCopy {
  /** Stable identity, used for keys and test ids. Never shown. */
  id: 'services' | 'compare' | 'track';
  title: string;
  body: string;
  permission: PermissionCopy;
}

export const ONBOARDING_COPY = Object.freeze({
  skip: 'Skip',
  skipHint: 'Skips the introduction and goes to sign in',
  back: 'Back',
  backHint: 'Returns to the previous step',
  /**
   * Shown only on a step the user has already answered and come back to.
   *
   * There is no Next button: answering a permission is what moves the
   * introduction on, so a settled question needs its own way forward or the
   * page would have nothing to press.
   */
  continueAction: 'Continue',
  continueHint: 'Moves on to the next step',
  openSettings: 'Open Settings',
  openSettingsHint: 'Opens this app in system settings, where the permission can be changed',

  /**
   * Names the position for a screen reader, which cannot see the dots.
   * A function rather than a template with placeholders — one caller, and this
   * keeps the numbers out of the component.
   */
  stepLabel: (current: number, total: number) => `Step ${current} of ${total}`,

  pages: Object.freeze([
    Object.freeze({
      id: 'services',
      title: 'Reliable home services\nat your fingertips',
      body: 'Book trusted professionals for all your home service needs in just a few taps.',
      permission: Object.freeze({
        kind: 'location',
        icon: 'location',
        title: 'Allow location access?',
        body: 'We use your location to find service professionals near you.',
        allow: 'Allow',
        allowHint: 'Asks the system for permission to use your location, then moves on',
        decline: 'Not Now',
        declineHint: 'Moves on without location. You can allow it later',
        denied: 'No problem — you can enter an address instead.',
        blocked: 'Location is turned off for Fixora. You can change that in Settings.',
        granted: 'Thanks. We can find professionals near you.',
      }),
    }),
    Object.freeze({
      id: 'compare',
      title: 'Choose and compare',
      body: 'View profiles, ratings and reviews, and choose the professional that suits you.',
      permission: Object.freeze({
        kind: 'camera',
        icon: 'camera',
        title: 'Allow camera access?',
        body: 'Take photos of the problem so professionals know what to expect.',
        allow: 'Allow',
        allowHint: 'Asks the system for permission to use the camera, then moves on',
        decline: 'Not Now',
        declineHint: 'Moves on without the camera. You can allow it later',
        denied: 'No problem — you can describe the problem in words.',
        blocked: 'The camera is turned off for Fixora. You can change that in Settings.',
        granted: 'Thanks. You can add photos to a request.',
      }),
    }),
    Object.freeze({
      id: 'track',
      // Not "in real-time": live tracking is Phase 2, and this is what Phase 1
      // actually does — a request whose status the customer can follow.
      title: 'Track it through\nto done',
      body: 'Follow every request from accepted to completed, then rate how it went.',
      permission: Object.freeze({
        kind: 'notifications',
        icon: 'notifications',
        title: 'Enable notifications?',
        // No mention of chat, which is Phase 2.
        body: 'Get updates when your request is accepted, started and completed.',
        allow: 'Allow',
        allowHint: 'Asks the system for permission to send notifications, then moves on',
        decline: 'Not Now',
        declineHint: 'Moves on without notifications. You can allow them later',
        denied: 'No problem — you can check progress in the app.',
        blocked: 'Notifications are turned off for Fixora. You can change that in Settings.',
        granted: 'Thanks. We will let you know as things happen.',
      }),
    }),
  ] as readonly OnboardingPageCopy[]),
});
