/**
 * AppError
 *
 * The single error shape crossing the service boundary. Every service — mock or
 * API — rejects with an AppError, so screens and hooks handle exactly one type
 * regardless of what failed underneath.
 *
 * Errors are never swallowed. They are normalised here and surfaced to the UI
 * with a message safe to display.
 *
 * Since the app began talking to the real backend (Phase 4A, 17/11/2026) an
 * error can also carry the backend's machine `code`. The code picks the copy;
 * the backend's English `message` never does — it is developer detail, and a
 * server that could choose the sentence on a screen could put anything there.
 *
 * Since Phase 5 (28/11/2026, phase5-contract.md section 7) every sentence here
 * is in English, Hindi and Gujarati: the English tables below are the source,
 * `error.hi.ts` and `error.gu.ts` translate them, and `ERROR_COPY` answers in the
 * current language. A `userMessage` is worded when the error is made, so it is
 * in the language the app spoke at that moment.
 *
 * ⚠️ The code tables are filled from `USER_MESSAGE_EN`, the raw English table,
 * never from the localized `USER_MESSAGE`: a read of a localized table while this
 * module loads would freeze whichever language was current into the English.
 */

import { localized } from '@/core/i18n';
import { ERROR_COPY_GU } from '@/shared/types/error.gu';
import { ERROR_COPY_HI } from '@/shared/types/error.hi';

export type AppErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'validation'
  | 'conflict'
  | 'permission'
  | 'server'
  | 'cancelled'
  | 'unknown';

/**
 * Default user-facing copy per failure kind.
 *
 * These live here rather than in screens so messaging stays consistent, and so
 * that introducing multi-language support later means translating one map.
 */
const USER_MESSAGE_EN: Readonly<Record<AppErrorKind, string>> = {
  network: 'No internet connection. Check your network and try again.',
  timeout: 'This is taking longer than expected. Please try again.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: 'You do not have access to this.',
  notFound: 'We could not find what you were looking for.',
  validation: 'Please check the details you entered.',
  conflict: 'This action conflicts with a recent change. Please refresh.',
  permission: 'Permission is required to continue.',
  server: 'Something went wrong on our side. Please try again.',
  cancelled: 'The request was cancelled.',
  unknown: 'Something went wrong. Please try again.',
};

/**
 * The app's sentence for each machine code the backend sends with a failure
 * (the shared sign-in contract of 17/11/2026, and the codes that follow it).
 *
 * A code not listed falls back to its kind's sentence above, so a code the
 * backend adds tomorrow still reads as a sensible failure rather than as
 * nothing. Where `MockAuthService` already says a thing, the words are its
 * words: the screens were built and checked against them.
 *
 * ⚠️ Keyed by the code and nothing else — never by the backend's `message`.
 * No entry may repeat what was typed, and none may say whether a number has an
 * account: `OTP_INVALID` is one answer for a wrong code and, at vendor sign in,
 * for a number no code was ever sent to, on purpose (phase5-contract.md
 * section 1.1). The vendor auth code's `AUTH_CODE_INVALID` and its sign-in
 * lockout `SIGNIN_TOO_MANY_ATTEMPTS` were retired with it (section 1.3,
 * 28/11/2026); a stray one reads as its kind.
 */
const BACKEND_CODE_MESSAGE_EN = Object.freeze({
  VALIDATION_FAILED: USER_MESSAGE_EN.validation,
  UNAUTHORIZED: USER_MESSAGE_EN.unauthorized,
  OTP_INVALID: 'That code is not correct. Please check and try again.',
  OTP_EXPIRED: 'That code has expired. Request a new one.',
  OTP_TOO_MANY_ATTEMPTS: 'Too many incorrect attempts. Request a new code to try again.',
  OTP_RESEND_TOO_SOON: 'Please wait a moment before requesting another code.',
  // phase5-contract.md section 2 (28/11/2026): the provider refused or timed out
  // (503, so `server` — retryable). The code was not counted as sent, so trying
  // again at once is the right advice. Names no channel: it may not be the one
  // the screen last said.
  OTP_DELIVERY_FAILED: 'We could not send your code just now. Please try again.',
  PHONE_ALREADY_REGISTERED: 'An account already exists for this number. Try signing in instead.',
  // No support channel exists in Phase 1, so this promises none. Customers and
  // vendors alike, and only ever after a correct code.
  ACCOUNT_SUSPENDED: 'This account is not active right now, so you cannot sign in with it.',
  REGISTRATION_NOT_FOUND: 'That registration is no longer available. Please start again.',

  // Raised by the app's own Api services, never sent by the backend (17/11/2026):
  // what a connected service cannot do because the backend has no way to do it
  // yet. `NOT_SUPPORTED` travels as kind `forbidden`, so nothing offers a retry
  // that would fail the same way.
  NOT_SUPPORTED: 'This is not available in the app yet.',
  // Raised by `ApiImageService` (T136, 28/11/2026) when the picker reports no camera
  // it can use — none on the device, or one another app holds. Points to the way
  // that still works rather than to a retry.
  CAMERA_UNAVAILABLE:
    'The camera can’t be used right now. You can choose a photo from your gallery instead.',
  // Phase 4B contract §7 (24/11/2026): the customer has no verified phone, so the
  // email and its password are their only way in. Nothing changed.
  EMAIL_REQUIRED_FOR_SIGN_IN:
    'Your email address can’t be removed: it is how you sign in to this account.',
  // Phase 4B contract §1: the backend's refusals of an uploaded file, judged by its
  // bytes. `ApiImageService` reads each as a validation failure, so nothing offers to
  // send the same file again. The type sentence is the device check's own
  // (`shared/validation/image.ts`), so both refusals read the same.
  FILE_TOO_LARGE: 'This photo is too large to upload. Please choose a smaller one.',
  FILE_TYPE_NOT_ALLOWED: 'Only JPG, PNG and WebP images are supported.',
  TOO_MANY_FILES: 'Too many photos were sent at once. Please try again with fewer.',
  // Sent by the backend (requests-contract.md, 17/11/2026). Not found also covers
  // a request the caller may not see — it never confirms one exists.
  REQUEST_NOT_FOUND: 'We could not find that request.',
  REQUEST_NOT_CANCELLABLE:
    "A professional has already accepted this request, so it can't be cancelled here.",
  // Phase 4B contract §4 (24/11/2026). The vendor's request service answers it as
  // recorded — a paid record is final, a retry is not a failure — so this shows only
  // if it reaches a screen some other way. Recorded, never processed (section 37).
  PAYMENT_ALREADY_RECORDED: 'A payment is already recorded for this job.',
  // Phase 4B contract §8: not in this inbox, whoever else's it may be.
  NOTIFICATION_NOT_FOUND: 'This notification is no longer available.',
  // The request contract (17/11/2026). The vendor's request service reads all three
  // as business answers — refused, not failed — so these show only if one reaches a
  // screen some other way. The words are the vendor copy's own (`vendorCopy.ts`).
  REQUEST_ALREADY_TAKEN: 'This request is no longer available. Another professional accepted it first.',
  REQUEST_NOT_PENDING: 'This request is no longer waiting for an answer.',
  INVALID_TRANSITION: 'This job has already changed. Showing its latest status.',
  // requests-contract.md section 8. A per-IP limit on `/auth/*`, or ten codes to
  // one phone in a day; this is the wording for when no `Retry-After` came with it.
  RATE_LIMITED: 'Too many attempts. Please wait a little and try again.',
  // Section 8 too: the customer has not reviewed this request yet.
  REVIEW_NOT_FOUND: 'We could not find a review for this request.',
});

/**
 * The refusals that last a while, worded with what is left of the wait when
 * the backend says (`Retry-After`, carried as `AppError.retryAfterSeconds`).
 * `{wait}` is a `WAIT_COPY` phrase, rounded up to whole minutes so the app never
 * says "try again" before the backend will allow it. Without the header, the
 * fixed sentence above is used.
 */
const BACKEND_CODE_WAIT_MESSAGE_EN = Object.freeze({
  RATE_LIMITED: 'Too many attempts. Try again in {wait}.',
});

/** Minutes under an hour; whole hours, rounded up, past it (a day's code limit). */
const WAIT_COPY_EN = Object.freeze({
  oneMinute: '1 minute',
  minutes: '{minutes} minutes',
  oneHour: '1 hour',
  hours: '{hours} hours',
});

/**
 * Every sentence above, as one table the translations are typed against
 * (`LocaleTable<typeof ERROR_COPY_EN>`), so a Hindi or Gujarati key that English
 * does not have fails `tsc`.
 */
export const ERROR_COPY_EN = Object.freeze({
  userMessage: USER_MESSAGE_EN,
  backendCode: BACKEND_CODE_MESSAGE_EN,
  backendCodeWait: BACKEND_CODE_WAIT_MESSAGE_EN,
  wait: WAIT_COPY_EN,
});

/** The same tables, answering in the current language (English where a translation has no entry). */
const ERROR_COPY = localized({ en: ERROR_COPY_EN, hi: ERROR_COPY_HI, gu: ERROR_COPY_GU });

const USER_MESSAGE: Readonly<Record<AppErrorKind, string>> = ERROR_COPY.userMessage;
const BACKEND_CODE_MESSAGE: Readonly<Record<string, string>> = ERROR_COPY.backendCode;
const BACKEND_CODE_WAIT_MESSAGE: Readonly<Record<string, string>> = ERROR_COPY.backendCodeWait;
const WAIT_COPY = ERROR_COPY.wait;

function waitPhrase(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes > 60) {
    const hours = Math.ceil(minutes / 60);
    return WAIT_COPY.hours.replace('{hours}', String(hours));
  }
  if (minutes === 60) {
    return WAIT_COPY.oneHour;
  }
  return minutes === 1
    ? WAIT_COPY.oneMinute
    : WAIT_COPY.minutes.replace('{minutes}', String(minutes));
}

function hasEntry(table: Readonly<Record<string, string>>, code: string): boolean {
  return Object.prototype.hasOwnProperty.call(table, code);
}

/** Failures worth offering a retry for. Drives the retry affordance in ErrorState. */
const RETRYABLE: ReadonlySet<AppErrorKind> = new Set<AppErrorKind>([
  'network',
  'timeout',
  'server',
  'unknown',
]);

interface AppErrorOptions {
  kind: AppErrorKind;
  /** Developer-facing detail. Never rendered to the user. */
  message?: string;
  /** Overrides the default copy for this kind (and for `code`). */
  userMessage?: string;
  /**
   * The backend's machine code for this failure (`OTP_EXPIRED`), when there is
   * one. Chooses the copy through `BACKEND_CODE_MESSAGE`, and lets a service
   * tell two failures of the same kind apart without reading English.
   */
  code?: string;
  statusCode?: number;
  /**
   * How long the backend asked the app to wait (`Retry-After`, in seconds), for
   * a refusal that lasts a while. Words the copy of such a code with the wait.
   */
  retryAfterSeconds?: number;
  /** Field-level messages, keyed by field name, for validation failures. */
  fieldErrors?: Record<string, string>;
  cause?: unknown;
}

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly userMessage: string;
  /** The backend's machine code, if it sent one. Never rendered. */
  readonly code?: string;
  readonly statusCode?: number;
  /** Seconds the backend asked the app to wait, if it said. */
  readonly retryAfterSeconds?: number;
  readonly fieldErrors?: Record<string, string>;
  readonly isRetryable: boolean;
  readonly cause?: unknown;

  constructor(options: AppErrorOptions) {
    // The developer-facing message falls back to English whatever the app speaks:
    // it is for logs and the crash reporter, never for the screen.
    super(options.message ?? options.userMessage ?? USER_MESSAGE_EN[options.kind]);

    this.name = 'AppError';
    this.kind = options.kind;
    this.userMessage =
      options.userMessage ??
      AppError.messageForCode(options.code, options.retryAfterSeconds) ??
      USER_MESSAGE[options.kind];
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.fieldErrors = options.fieldErrors;
    this.isRetryable = RETRYABLE.has(options.kind);
    this.cause = options.cause;

    // Required for `instanceof` to survive transpilation of extended built-ins.
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Normalises any thrown value into an AppError. Anything that is already an
   * AppError passes through unchanged.
   */
  static from(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }
    if (error instanceof Error) {
      return new AppError({ kind: 'unknown', message: error.message, cause: error });
    }
    return new AppError({ kind: 'unknown', message: String(error), cause: error });
  }

  /**
   * The app's copy for a backend code, or undefined for a code it has no
   * sentence for (which then reads as its kind). With `retryAfterSeconds`, a
   * code that has a worded wait says how long is left.
   */
  static messageForCode(
    code: string | undefined,
    retryAfterSeconds?: number,
  ): string | undefined {
    if (!code) {
      return undefined;
    }
    if (retryAfterSeconds !== undefined && hasEntry(BACKEND_CODE_WAIT_MESSAGE, code)) {
      return BACKEND_CODE_WAIT_MESSAGE[code].replace('{wait}', waitPhrase(retryAfterSeconds));
    }
    return hasEntry(BACKEND_CODE_MESSAGE, code) ? BACKEND_CODE_MESSAGE[code] : undefined;
  }

  /** The app's own sentence for a kind, for a caller that needs it without an error. */
  static defaultMessage(kind: AppErrorKind): string {
    return USER_MESSAGE[kind];
  }

  /** Maps an HTTP status onto a failure kind. Used by the HTTP client. */
  static kindFromStatus(status: number): AppErrorKind {
    switch (status) {
      case 400:
      case 422:
        return 'validation';
      case 401:
        return 'unauthorized';
      case 403:
        return 'forbidden';
      case 404:
        return 'notFound';
      case 409:
        return 'conflict';
      default:
        return status >= 500 ? 'server' : 'unknown';
    }
  }
}
