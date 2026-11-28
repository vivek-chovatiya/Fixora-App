/**
 * PushService
 *
 * The device's side of push notifications (phase5-contract.md section 6,
 * owner-approved 28/11/2026): its token, and the messages it receives. Nothing
 * above `src/shared/services/device` ever names Firebase — a screen or hook
 * asks this, and the registry decides what answers.
 *
 * Deliberately not the device-token endpoints. Telling the backend which device
 * belongs to whom is `NotificationService.registerDevice` / `unregisterDevice`,
 * a backend call like any other that follows `AppConfig.services.live`; this is
 * the phone's own capability, the same in a mock build and a live one, and is
 * registered beside `permission` for that reason.
 *
 * Deliberately not the permission either. Whether notifications may be shown is
 * `PermissionService` ('notifications'), which the app already asks through;
 * when to ask is `pushRegistration.ts`'s rule, not the platform's.
 *
 * ⚠️ "Not available" is a normal answer, not an error. A build with no
 * `google-services.json` has no Firebase app, and then every method here does
 * nothing: no token, no messages, no listener that will ever be called. The
 * app must behave exactly as it did before push existed, so a caller checks
 * `isAvailable()` or simply gets nothing back — it never sees a failure.
 */

/** The platforms the backend registers a token for (contract section 6.1). */
export type PushPlatform = 'android' | 'ios';

/**
 * A message as the app reads it: the visible text, if any, and the data.
 *
 * `data` holds strings and ids only (contract section 6.2): `notificationId`,
 * the backend's `type` token, and `requestId` when the notification is about a
 * service request. Each is absent when the message did not carry it as a
 * non-empty string — anything else the sender put there is dropped, never
 * guessed at.
 *
 * ⚠️ `title` and `body` are the stored notification's own words (English for
 * now), the same text the inbox shows. They are for showing to the person
 * whose notification it is, never for logging.
 */
export interface PushMessage {
  title?: string;
  body?: string;
  data: PushMessageData;
}

export interface PushMessageData {
  notificationId?: string;
  type?: string;
  requestId?: string;
}

export interface PushService {
  /**
   * Whether push works on this build: Firebase is configured and its native
   * module is present. Fixed for the life of the process — adding the
   * configuration means rebuilding the app.
   */
  isAvailable(): boolean;

  /** Which platform this device registers as, or null where push does not exist. */
  platform(): PushPlatform | null;

  /**
   * The device's push token, or null when push is not available or the token
   * could not be read. Never rejects.
   *
   * ⚠️ A credential for this device: it is sent to the backend and nowhere
   * else, and never logged.
   */
  getToken(): Promise<string | null>;

  /** Calls `listener` with each new token the platform issues. Returns the way to stop. */
  onTokenRefresh(listener: (token: string) => void): () => void;

  /** Calls `listener` for a message that arrives while the app is in front. */
  onForegroundMessage(listener: (message: PushMessage) => void): () => void;

  /** Calls `listener` when a notification is tapped while the app was in the background. */
  onMessageOpened(listener: (message: PushMessage) => void): () => void;

  /**
   * The notification whose tap started the app from closed, once; null when the
   * app was started any other way. Never rejects.
   */
  getInitialMessage(): Promise<PushMessage | null>;

  /**
   * Accepts messages that arrive while the app is in the background or closed,
   * which the system shows by itself. Call once, while the JavaScript starts
   * and before anything renders — a handler set later misses the messages that
   * woke the app.
   */
  handleBackgroundMessages(): void;
}
