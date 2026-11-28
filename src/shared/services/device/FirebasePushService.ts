/**
 * FirebasePushService
 *
 * PushService on Firebase Cloud Messaging (`@react-native-firebase/messaging`
 * 27.1.1, phase5-contract.md section 6, owner-approved 28/11/2026). The only
 * file in the app that names Firebase; everything above it speaks
 * `PushService`.
 *
 * It lives under `device/` beside the permissions and the network status: a
 * phone's push token is the device's answer in every build, mock or live, so
 * the live switch in ServiceRegistry does not apply to it.
 *
 * "Not configured" is decided once, on first use, and is the normal state
 * until the owner adds `android/app/google-services.json` (or iOS's
 * `GoogleService-Info.plist`) and rebuilds:
 * - the Firebase packages are loaded on demand, inside a try, never imported at
 *   the top of the file;
 * - Firebase is configured when its native side started a default app, which
 *   it does only from the config file (`getApps()` lists `[DEFAULT]`);
 * - anything else — no default app, no native module, a platform with no push —
 *   is "not available", said once in the log, and every method then does
 *   nothing: no token, no listener ever called, no error.
 *
 * ⚠️ Never `import` a Firebase package at the top of this file. Loading
 * `@react-native-firebase/app` builds its native event emitter on the spot, and
 * on a binary built before the package was installed — the phone running an
 * older debug build while Metro serves this JavaScript — that throws while the
 * registry is still being imported, and the whole app fails to start. Loaded
 * here, the same binary just has no push.
 *
 * ⚠️ Never ask Firebase for messaging before the default app is known to exist.
 * The messaging module reads `FirebaseMessaging.getInstance()` natively as it is
 * created, which throws on Android when there is no default app.
 *
 * ⚠️ The token is a credential for this device. It is handed to the caller and
 * never logged — failures are logged by error name only.
 *
 * Token calls are Firebase's `getToken` / `onTokenRefresh`, which 27.x marks
 * deprecated in favour of installation-id registration. They are what the
 * backend sends to (FCM HTTP v1 registration tokens, contract section 6.2) and
 * they keep working while that opt-in (`messaging_installation_id_enabled`)
 * stays off, which it does here.
 */

import { Platform } from 'react-native';

import { createLogger } from '@/core/logger/Logger';
import type {
  PushMessage,
  PushMessageData,
  PushPlatform,
  PushService,
} from '@/shared/services/types/PushService';

type FirebaseAppModule = typeof import('@react-native-firebase/app');
type FirebaseMessagingModule = typeof import('@react-native-firebase/messaging');
type Messaging = ReturnType<FirebaseMessagingModule['getMessaging']>;
type RemoteMessage = Parameters<Parameters<FirebaseMessagingModule['onMessage']>[1]>[0];

const log = createLogger('FirebasePushService');

/** The name Firebase gives the app it starts from the platform config file. */
const DEFAULT_APP_NAME = '[DEFAULT]';

/** The keys of `data` the app reads (contract section 6.2); everything else is ignored. */
const DATA_KEYS: readonly (keyof PushMessageData)[] = ['notificationId', 'type', 'requestId'];

interface Firebase {
  api: FirebaseMessagingModule;
  messaging: Messaging;
}

const NO_OP = () => undefined;

function currentPlatform(): PushPlatform | null {
  return Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : null;
}

/** An error's name for the log: a native message could quote the token it was handed. */
function nameOf(caught: unknown): string {
  return caught instanceof Error ? caught.name : typeof caught;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

/** A Firebase message as the app reads it: the text, and the data's string ids only. */
function toPushMessage(remote: RemoteMessage): PushMessage {
  const data: PushMessageData = {};
  for (const key of DATA_KEYS) {
    const value = nonEmpty(remote.data?.[key]);
    if (value !== undefined) {
      data[key] = value;
    }
  }

  const message: PushMessage = { data };
  const title = nonEmpty(remote.notification?.title);
  const body = nonEmpty(remote.notification?.body);
  if (title !== undefined) {
    message.title = title;
  }
  if (body !== undefined) {
    message.body = body;
  }
  return message;
}

export class FirebasePushService implements PushService {
  /** Undefined until first looked for; null once known to be unavailable. */
  private firebase: Firebase | null | undefined;

  private handlingBackground = false;

  isAvailable(): boolean {
    return this.load() !== null;
  }

  platform(): PushPlatform | null {
    return currentPlatform();
  }

  async getToken(): Promise<string | null> {
    const firebase = this.load();
    if (!firebase) {
      return null;
    }

    try {
      return nonEmpty(await firebase.api.getToken(firebase.messaging)) ?? null;
    } catch (caught) {
      // No connection on a first read, or Play services missing: no token this time.
      log.warn('Push token could not be read', { error: nameOf(caught) });
      return null;
    }
  }

  onTokenRefresh(listener: (token: string) => void): () => void {
    const firebase = this.load();
    if (!firebase) {
      return NO_OP;
    }

    return firebase.api.onTokenRefresh(firebase.messaging, token => {
      const fresh = nonEmpty(token);
      if (fresh !== undefined) {
        listener(fresh);
      }
    });
  }

  onForegroundMessage(listener: (message: PushMessage) => void): () => void {
    const firebase = this.load();
    if (!firebase) {
      return NO_OP;
    }

    return firebase.api.onMessage(firebase.messaging, remote => listener(toPushMessage(remote)));
  }

  onMessageOpened(listener: (message: PushMessage) => void): () => void {
    const firebase = this.load();
    if (!firebase) {
      return NO_OP;
    }

    return firebase.api.onNotificationOpenedApp(firebase.messaging, remote =>
      listener(toPushMessage(remote)),
    );
  }

  async getInitialMessage(): Promise<PushMessage | null> {
    const firebase = this.load();
    if (!firebase) {
      return null;
    }

    try {
      const remote = await firebase.api.getInitialNotification(firebase.messaging);
      return remote ? toPushMessage(remote) : null;
    } catch (caught) {
      log.warn('The notification that opened the app could not be read', {
        error: nameOf(caught),
      });
      return null;
    }
  }

  handleBackgroundMessages(): void {
    if (this.handlingBackground) {
      return;
    }
    const firebase = this.load();
    if (!firebase) {
      return;
    }
    this.handlingBackground = true;

    // Nothing to do, on purpose. A message that arrives in the background or
    // closed carries a notification the system shows by itself, and every screen
    // reads its data afresh when the app is opened. Setting a handler is what
    // keeps Firebase from logging each such message as unhandled.
    firebase.api.setBackgroundMessageHandler(firebase.messaging, async () => undefined);
  }

  /** Finds Firebase once: the messaging instance, or null when push is not available here. */
  private load(): Firebase | null {
    if (this.firebase !== undefined) {
      return this.firebase;
    }
    this.firebase = null;

    if (currentPlatform() === null) {
      log.info('Push is off: no push on this platform', { platform: Platform.OS });
      return null;
    }

    try {
      const app = require('@react-native-firebase/app') as FirebaseAppModule;
      if (!app.getApps().some(candidate => candidate.name === DEFAULT_APP_NAME)) {
        log.info('Push is off: Firebase is not configured in this build');
        return null;
      }

      const api = require('@react-native-firebase/messaging') as FirebaseMessagingModule;
      this.firebase = { api, messaging: api.getMessaging() };
      log.info('Push is on');
    } catch (caught) {
      // A binary without Firebase's native module, most often an older debug
      // build running newer JavaScript. Off, exactly as if it were not configured.
      log.info('Push is off: Firebase could not be loaded', { error: nameOf(caught) });
    }

    return this.firebase;
  }
}
