/**
 * DevicePermissionService
 *
 * The real implementation, backed by react-native-permissions.
 *
 * It lives under `device/` rather than `mock/` or a future `api/` because it is
 * not a backend service pretending to be local. Nothing about a camera
 * permission becomes real when the API does, so this implementation is used in
 * every build — the mock/live switch in ServiceRegistry does not apply to it.
 *
 * This file is the only place in the application that names a platform
 * permission constant. Everything above it speaks in PermissionKind.
 */

import { Platform } from 'react-native';
import {
  PERMISSIONS,
  RESULTS,
  check,
  checkNotifications,
  openSettings,
  request,
  requestNotifications,
  type Permission,
  type PermissionStatus as LibraryStatus,
} from 'react-native-permissions';

import { createLogger } from '@/core/logger/Logger';
import type {
  PermissionKind,
  PermissionService,
  PermissionStatus,
} from '@/shared/services/types/PermissionService';

const log = createLogger('PermissionService');

/**
 * Which platform constant a kind means here.
 *
 * Location is "while in use" on both platforms. Background location is a
 * separate, far more intrusive grant that this app has no Phase 1 reason to ask
 * for — live tracking is Phase 2 (PROJECT_BIBLE.md section 1241).
 *
 * Notifications are absent: neither platform exposes them as a plain permission
 * constant, so they go through the library's own notification methods below.
 */
const PLATFORM_PERMISSION: Readonly<Record<'location' | 'camera', Permission | undefined>> = {
  location: Platform.select({
    android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
  }),
  camera: Platform.select({
    android: PERMISSIONS.ANDROID.CAMERA,
    ios: PERMISSIONS.IOS.CAMERA,
  }),
};

/**
 * Collapses the library's five results onto the four a caller acts on.
 *
 * `limited` joins `granted`: it means the user allowed partial access, and every
 * use in this app can proceed on that.
 */
function toStatus(result: LibraryStatus): PermissionStatus {
  switch (result) {
    case RESULTS.GRANTED:
    case RESULTS.LIMITED:
      return 'granted';
    case RESULTS.DENIED:
      return 'denied';
    case RESULTS.BLOCKED:
      return 'blocked';
    default:
      return 'unavailable';
  }
}

export class DevicePermissionService implements PermissionService {
  async check(kind: PermissionKind): Promise<PermissionStatus> {
    return this.run(kind, {
      notifications: () => checkNotifications().then(({ status }) => status),
      permission: target => check(target),
    });
  }

  async request(kind: PermissionKind): Promise<PermissionStatus> {
    return this.run(kind, {
      // Asking for the alert types the product actually uses. A badge or sound
      // the app never sets would be permission requested for nothing.
      notifications: () => requestNotifications(['alert', 'sound']).then(({ status }) => status),
      permission: target => request(target),
    });
  }

  async openSettings(): Promise<void> {
    try {
      await openSettings();
    } catch (error) {
      // Nothing to recover: the user simply stays where they are. Reported so a
      // platform that stops honouring this is visible in logs rather than as a
      // button that silently does nothing.
      log.warn('Could not open application settings', { error: String(error) });
    }
  }

  /**
   * Shared plumbing for the two operations, which differ only in the calls they
   * make. Failures resolve `unavailable` rather than throwing: a permission that
   * cannot be asked about is, from the caller's side, one that is not available,
   * and onboarding must continue either way.
   */
  private async run(
    kind: PermissionKind,
    handlers: {
      notifications: () => Promise<LibraryStatus>;
      permission: (target: Permission) => Promise<LibraryStatus>;
    },
  ): Promise<PermissionStatus> {
    try {
      if (kind === 'notifications') {
        return toStatus(await handlers.notifications());
      }

      const target = PLATFORM_PERMISSION[kind];

      if (!target) {
        // A platform this build does not carry a constant for — Windows, say.
        return 'unavailable';
      }

      return toStatus(await handlers.permission(target));
    } catch (error) {
      log.warn('Permission call failed', { kind, error: String(error) });
      return 'unavailable';
    }
  }
}
