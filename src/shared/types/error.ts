/**
 * AppError
 *
 * The single error shape crossing the service boundary. Every service — mock or
 * API — rejects with an AppError, so screens and hooks handle exactly one type
 * regardless of what failed underneath.
 *
 * Errors are never swallowed. They are normalised here and surfaced to the UI
 * with a message safe to display.
 */

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
const USER_MESSAGE: Readonly<Record<AppErrorKind, string>> = {
  network: 'Unable to connect. Please check your internet connection.',
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
  /** Overrides the default copy for this kind. */
  userMessage?: string;
  statusCode?: number;
  /** Field-level messages, keyed by field name, for validation failures. */
  fieldErrors?: Record<string, string>;
  /** Machine-readable backend error code (e.g. REQUEST_ALREADY_ASSIGNED). */
  code?: string;
  cause?: unknown;
}

/**
 * Backend error codes the app branches on. Copy for the two dispatch outcomes
 * that are business results rather than faults lives here (App PROJECT_BIBLE §49).
 */
export const ApiErrorCode = Object.freeze({
  REQUEST_ALREADY_ASSIGNED: 'REQUEST_ALREADY_ASSIGNED',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  VENDOR_NOT_APPROVED: 'VENDOR_NOT_APPROVED',
  VENDOR_NOT_ELIGIBLE: 'VENDOR_NOT_ELIGIBLE',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
} as const);

const CODE_MESSAGE: Readonly<Record<string, string>> = {
  REQUEST_ALREADY_ASSIGNED: 'This request has already been assigned to another vendor.',
};

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly userMessage: string;
  readonly statusCode?: number;
  readonly fieldErrors?: Record<string, string>;
  readonly code?: string;
  readonly isRetryable: boolean;
  readonly cause?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message ?? options.userMessage ?? USER_MESSAGE[options.kind]);

    this.name = 'AppError';
    this.kind = options.kind;
    this.userMessage =
      (options.code ? CODE_MESSAGE[options.code] : undefined) ??
      options.userMessage ??
      USER_MESSAGE[options.kind];
    this.statusCode = options.statusCode;
    this.fieldErrors = options.fieldErrors;
    this.code = options.code;
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

  /** True when this failure is the normal "another vendor won the race" outcome. */
  get isAssignmentConflict(): boolean {
    return this.code === ApiErrorCode.REQUEST_ALREADY_ASSIGNED;
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
      case 429:
        return 'server';
      default:
        return status >= 500 ? 'server' : 'unknown';
    }
  }
}
