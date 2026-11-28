/**
 * pushRegistration
 *
 * When this device's push token is paired with the signed-in account, and when
 * it stops being (phase5-contract.md section 6.3, owner-approved 28/11/2026):
 *
 * - after a sign in — and when a stored session is restored at start-up — the
 *   token is read and sent (`NotificationService.registerDevice`), and every
 *   token the platform issues after it is sent too, for as long as the session
 *   lasts;
 * - straight after a sign in, and only then, the app may ask once to show
 *   notifications (Android 13+ and iOS; older Android grants it at install);
 * - while signing out the token is unregistered (`unregisterPushDevice`, called
 *   by `authThunks.signOut`): a Log out the person asked for waits for it before
 *   `/auth/logout`; a forced sign-out (the session was refused) only starts it,
 *   so the app never holds someone in a dead session.
 *
 * A module of functions, like `telemetry.ts`, rather than a hook: signing out
 * is a thunk, and the session it ends must lose its token whichever screen —
 * or none — asked for it.
 *
 * ⚠️ Nothing here can fail a sign in or a sign out. Every failure is logged by
 * kind and swallowed, a missing service is "push off", and unregistering gives
 * up after `AppConfig.push.unregisterTimeoutMs` so a slow network never holds
 * the person in an app they asked to leave. A token left registered is moved
 * to whoever signs in next on this phone (contract section 6.1).
 *
 * ⚠️ With push off — no Firebase config in the build — nothing here does
 * anything at all: no permission asked, no request sent. The app behaves
 * exactly as it did before push existed.
 *
 * ⚠️ Asked once means once per device, kept under
 * `AppConfig.storage.notificationPermissionAskedKey` and written *before* the
 * dialog is shown, so a refusal — here or in onboarding, which notes its own
 * ask through `noteNotificationPermissionAsked` — is never met with a second
 * dialog. An unreadable or unwritable note means not asking: the failure mode
 * is a person who is never nagged, never one who is asked twice.
 *
 * ⚠️ The token is a credential for the device. It goes to the backend and
 * nowhere else; nothing here logs it.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { getKeyValueStorage } from '@/core/storage/KeyValueStorage';
import { getService, type ServiceMap } from '@/shared/services/ServiceRegistry';
import type { PushPlatform } from '@/shared/services/types/PushService';
import { AppError } from '@/shared/types/error';

const log = createLogger('pushRegistration');

/** The only value written under the key. Presence is the note; the word is for humans. */
const ASKED = 'asked';

export interface RegisterPushOptions {
  /**
   * True straight after a sign in, the one moment the app may ask to show
   * notifications. False for a session restored at start-up: the app never
   * asks as it opens.
   */
  mayAskPermission: boolean;
}

/** The token sent — or being sent — for the signed-in account. Null with nobody signed in. */
let currentToken: string | null = null;

/** Stops listening for new tokens. Set while a session has one registered. */
let stopTokenRefresh: (() => void) | null = null;

/** Bumped as a session ends, so a registration still in the air for it stops where it is. */
let sessionNumber = 0;

/** A send in the air, which unregistering waits for: the pair must land before it is undone. */
let sending: Promise<void> | null = null;

type PushServiceKey = 'push' | 'notification' | 'permission';

/** A service, or null when it is not registered — a test that reset the registry, or before bootstrap. */
function resolve<K extends PushServiceKey>(key: K): ServiceMap[K] | null {
  try {
    return getService(key);
  } catch {
    return null;
  }
}

function kindOf(caught: unknown): string {
  return AppError.from(caught).kind;
}

/**
 * Pairs this device's token with the account that has just signed in (or been
 * restored), and keeps it paired as the token changes. Never rejects.
 */
export async function registerPushDevice(options: RegisterPushOptions): Promise<void> {
  try {
    await register(options);
  } catch (caught) {
    // Tried again at the next start or sign in, or when the token next changes.
    log.warn('Push device not registered', { kind: kindOf(caught) });
  }
}

async function register({ mayAskPermission }: RegisterPushOptions): Promise<void> {
  const push = resolve('push');
  const platform = push?.platform() ?? null;
  if (!push || !platform || !push.isAvailable()) {
    return;
  }

  const session = sessionNumber;

  if (mayAskPermission) {
    await askPermissionOnce();
  }

  const token = await push.getToken();
  if (!token || session !== sessionNumber) {
    return;
  }

  await send(token, platform);

  if (!stopTokenRefresh && session === sessionNumber) {
    stopTokenRefresh = push.onTokenRefresh(fresh => {
      send(fresh, platform).catch(caught => {
        log.warn('Refreshed push token not registered', { kind: kindOf(caught) });
      });
    });
  }
}

/** Sends one token for the signed-in account, as the one unregistering will wait for. */
function send(token: string, platform: PushPlatform): Promise<void> {
  const notifications = resolve('notification');
  if (!notifications) {
    return Promise.resolve();
  }

  // Before the call, so a sign out that starts while it is in the air knows what to undo.
  currentToken = token;
  const call = notifications.registerDevice({ token, platform }).then(() => {
    log.info('Push device registered', { platform });
  });
  // What unregistering waits on: settled either way, since a failed send has nothing to undo.
  sending = call.catch(() => undefined);

  return call;
}

/**
 * Unpairs this device from the account that is signing out. Called before
 * `/auth/logout`, while the session's token still authorises the call. Never
 * rejects, and gives up after `AppConfig.push.unregisterTimeoutMs`.
 */
export async function unregisterPushDevice(): Promise<void> {
  // Whatever is still registering for this session stops at its next step.
  sessionNumber += 1;
  stopTokenRefresh?.();
  stopTokenRefresh = null;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new AppError({ kind: 'timeout', message: 'Push unregister timed out' })),
      AppConfig.push.unregisterTimeoutMs,
    );
  });

  try {
    await Promise.race([unregister(sending), timeout]);
  } catch (caught) {
    log.warn('Push device not unregistered; signing out anyway', { kind: kindOf(caught) });
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
    currentToken = null;
  }
}

async function unregister(inFlight: Promise<void> | null): Promise<void> {
  const push = resolve('push');
  const notifications = resolve('notification');
  if (!push || !notifications || !push.isAvailable()) {
    return;
  }

  // A registration already sent lands first, or the server could pair the
  // token after this removed it.
  if (inFlight) {
    await inFlight;
  }

  // The token this session sent; failing that, the device's own — one paired
  // on an earlier start whose registration this start could not repeat.
  const token = currentToken ?? (await push.getToken());
  if (!token) {
    return;
  }

  await notifications.unregisterDevice(token);
  log.info('Push device unregistered');
}

/** Whether this device has asked to show notifications before. Unreadable counts as asked. */
async function hasAskedForPermission(): Promise<boolean> {
  try {
    return (
      (await getKeyValueStorage().getItem(AppConfig.storage.notificationPermissionAskedKey)) ===
      ASKED
    );
  } catch (caught) {
    log.warn('Could not read whether notifications were asked for', { kind: kindOf(caught) });
    return true;
  }
}

/**
 * Notes that this device has asked to show notifications, so it is never asked
 * again automatically. For onboarding's own ask; never rejects.
 */
export async function noteNotificationPermissionAsked(): Promise<void> {
  try {
    await getKeyValueStorage().setItem(AppConfig.storage.notificationPermissionAskedKey, ASKED);
  } catch (caught) {
    log.warn('Could not note that notifications were asked for', { kind: kindOf(caught) });
  }
}

/**
 * Asks to show notifications, once per device, straight after a sign in.
 *
 * The note is written before anything is shown, and a note that cannot be
 * written means not asking. Then it asks only a platform that still would:
 * `denied` is "not decided yet" — granted, blocked and unavailable have
 * nothing to ask, and Android before 13 grants at install so never answers
 * `denied` here.
 */
async function askPermissionOnce(): Promise<void> {
  const permission = resolve('permission');
  if (!permission || (await hasAskedForPermission())) {
    return;
  }

  try {
    await getKeyValueStorage().setItem(AppConfig.storage.notificationPermissionAskedKey, ASKED);
  } catch (caught) {
    log.warn('Not asking for notifications: could not note it', { kind: kindOf(caught) });
    return;
  }

  try {
    if ((await permission.check('notifications')) !== 'denied') {
      return;
    }
    const answer = await permission.request('notifications');
    // Respected either way: a refusal is never asked again (the note above).
    log.info('Notifications asked for after sign in', { answer });
  } catch (caught) {
    log.warn('Notification permission could not be asked for', { kind: kindOf(caught) });
  }
}

/** Test helper: forgets the session's token and listener, as a fresh start of the app would. */
export function resetPushRegistration(): void {
  stopTokenRefresh?.();
  stopTokenRefresh = null;
  currentToken = null;
  sending = null;
  sessionNumber += 1;
}
