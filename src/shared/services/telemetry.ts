/**
 * Telemetry
 *
 * The one door to analytics and crash reporting (PROJECT_BIBLE.md sections 54
 * and 57) for code that is not a component: the auth thunks, bootstrap, the
 * global error handler and the error boundary. A component uses `useAnalytics`,
 * which is `trackEvent` in a hook's shape.
 *
 * Both services watch the app and neither may change what it does — section 54:
 * analytics "must not interfere with business operations". So every function
 * here:
 *
 * - resolves its service at the moment of the call, so a test's stub and a
 *   fresh `configureServices` are both honoured;
 * - does nothing when no service is registered. A suite that resets the
 *   registry, or code that runs before bootstrap, loses an event and nothing
 *   else — `getService` would have thrown into a sign in instead;
 * - catches whatever an implementation throws in spite of its contract. The
 *   mocks never do; a provider SDK one day might, and these calls run inside
 *   sign in and inside the global error handler.
 *
 * ⚠️ `identifyUser` copies the id and the role and nothing else. TypeScript lets
 * a whole `AuthUser` through a `{ id, role }` parameter, so that copy is what
 * keeps a name and a phone number out of a third party's user record.
 *
 * ⚠️ `trackEvent` drops a property whose key looks personal, and logs the key —
 * never the value. It is a net under the rule in AnalyticsService, not the rule:
 * it cannot see a name filed under an innocent key.
 */

import { createLogger } from '@/core/logger/Logger';
import { getService, type ServiceMap } from '@/shared/services/ServiceRegistry';
import type {
  AnalyticsEventName,
  AnalyticsProperties,
} from '@/shared/services/types/AnalyticsService';
import type { CrashContext } from '@/shared/services/types/CrashReporter';

const log = createLogger('telemetry');

type TelemetryKey = 'analytics' | 'crashReporter';

/**
 * Parts of a property key that mark its value as personal data.
 *
 * Matched anywhere in the key, ignoring case, so `customerPhone` and
 * `ownerName` are caught along with `phone` and `name`. `code` is here for the
 * vendor auth code (section 7A.2) and takes every other code with it: a false
 * positive costs one property, a false negative leaks a standing credential.
 */
const PERSONAL_KEY_FRAGMENTS: readonly string[] = [
  'name',
  'phone',
  'mobile',
  'email',
  'address',
  'street',
  'location',
  'latitude',
  'longitude',
  'note',
  'comment',
  'message',
  'text',
  'body',
  'description',
  'otp',
  'code',
  'token',
  'password',
  'secret',
  'vpa',
  'whatsapp',
  'contact',
  'aadhaar',
  'msisdn',
  'birth',
  'pincode',
  'landmark',
  'house',
];

/**
 * Whole words that mark a key as personal: `upi` (`upiHandle`), `pan` (the PAN
 * card number), `pin` (`pinCode`), `dob`, and the short forms of a place —
 * `lat`, `lng`, `zip`. Words, not fragments — `groupId`,
 * `pickupTime`, `companyName` and `spinnerShown` contain the letters and are
 * none of these.
 */
const PERSONAL_KEY_WORDS: readonly string[] = ['upi', 'pan', 'pin', 'dob', 'lat', 'lng', 'zip'];

/**
 * A key that names an identifier — `id`, `requestId`, `addressId` — carries an
 * id, which section 54's events are built from, whatever else the key says —
 * except a contact handle named like one (see `looksPersonal`).
 */
const IDENTIFIER_KEY = /^id$|Id$/;

/**
 * What makes an id-named key a way to reach or identify somebody: `emailId`,
 * `whatsAppId`, `aadhaarId`. Fragments of the lower-cased key — so a brand's
 * own capitals (`whatsApp`) cannot split the word apart.
 */
const CONTACT_ID_FRAGMENTS: readonly string[] = [
  'email',
  'vpa',
  'phone',
  'mobile',
  'whatsapp',
  'aadhaar',
  'msisdn',
];

/**
 * The same, as whole words, for the ones too short to match inside another
 * word: `upiId` and `panId` are handles, `groupId` and `companyId` are not.
 */
const CONTACT_ID_WORDS: readonly string[] = ['upi', 'pan'];

/**
 * A key's words, lower-cased: `customerPhoneId` → customer, phone, id; and an
 * acronym keeps its own word — `PANNumber` → pan, number, not `pannumber`.
 */
function wordsOf(key: string): string[] {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(word => word.length > 0)
    .map(word => word.toLowerCase());
}

const announcedMissing = new Set<TelemetryKey>();

/**
 * Records one of section 54's events. Fire and forget: returns nothing, never
 * throws, and is never worth awaiting.
 */
export function trackEvent(event: AnalyticsEventName, properties?: AnalyticsProperties): void {
  const analytics = resolve('analytics');
  if (!analytics) {
    return;
  }

  attempt('track', () => analytics.track(event, withoutPersonalData(event, properties)));
}

/**
 * Tells both services who is signed in — or, with `null`, that nobody is.
 *
 * One call for both so that they can never disagree about whose session a
 * report or an event belongs to.
 */
export function identifyUser(user: { id: string; role: string } | null): void {
  const identity = user ? { id: user.id, role: user.role } : null;

  const analytics = resolve('analytics');
  if (analytics) {
    attempt('identify', () => analytics.identify(identity));
  }

  const crashReporter = resolve('crashReporter');
  if (crashReporter) {
    attempt('setUser', () => crashReporter.setUser(identity));
  }
}

/** Reports a failure. Accepts anything thrown. Never throws. */
export function recordError(error: unknown, context?: CrashContext): void {
  const crashReporter = resolve('crashReporter');
  if (!crashReporter) {
    return;
  }

  attempt('recordError', () => crashReporter.recordError(error, context));
}

/* Internals --------------------------------------------------------------- */

function resolve<K extends TelemetryKey>(key: K): ServiceMap[K] | null {
  try {
    return getService(key);
  } catch {
    // Not registered: a test that reset the registry, or a call made before
    // bootstrap. Said once, at debug level — it is expected in both places,
    // and in the running app `configureServices` registers both services.
    if (!announcedMissing.has(key)) {
      announcedMissing.add(key);
      quietly(() => log.debug('Not registered; nothing is recorded', { service: key }));
    }
    return null;
  }
}

function attempt(operation: string, run: () => void): void {
  try {
    run();
  } catch (caught) {
    // By name only: a provider's message could quote the very value it was
    // handed.
    quietly(() =>
      log.warn('Telemetry failed; nothing was recorded', {
        operation,
        error: caught instanceof Error ? caught.name : typeof caught,
      }),
    );
  }
}

/** Logs, unless logging is itself what is broken. */
function quietly(write: () => void): void {
  try {
    write();
  } catch {
    // Nowhere is left to say so, and the caller must never hear about it.
  }
}

function withoutPersonalData(
  event: AnalyticsEventName,
  properties: AnalyticsProperties | undefined,
): AnalyticsProperties | undefined {
  if (!properties) {
    return undefined;
  }

  const kept: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(properties)) {
    // The type already forbids anything else; this is for the caller who got
    // round it, because a nested object is how a whole record gets sent.
    const isPrimitive =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

    if (!isPrimitive || looksPersonal(key, value)) {
      quietly(() => log.warn('Analytics property dropped', { event, key }));
      continue;
    }

    kept[key] = value;
  }

  return kept;
}

function looksPersonal(key: string, value: string | number | boolean): boolean {
  // A flag cannot carry a name or a number: `hasNote: true` says there is a
  // note and nothing about what it says.
  if (typeof value === 'boolean') {
    return false;
  }

  // An `@` is an email address or a UPI handle (`asha@okhdfc`) whatever the
  // key is called; no id, count or enum this app sends contains one.
  if (typeof value === 'string' && value.includes('@')) {
    return true;
  }

  const words = wordsOf(key);

  if (IDENTIFIER_KEY.test(key)) {
    // ⚠️ An id is kept — unless it is a contact handle wearing an id's name.
    // In Indian usage an "email id" or a "UPI id" *is* the address. Not a
    // digit-count rule for phone numbers: a backend's numeric ids can be just
    // as long.
    const lowerId = key.toLowerCase();
    return (
      CONTACT_ID_FRAGMENTS.some(fragment => lowerId.includes(fragment)) ||
      CONTACT_ID_WORDS.some(word => words.includes(word))
    );
  }

  const lower = key.toLowerCase();
  return (
    PERSONAL_KEY_FRAGMENTS.some(fragment => lower.includes(fragment)) ||
    PERSONAL_KEY_WORDS.some(word => words.includes(word))
  );
}
