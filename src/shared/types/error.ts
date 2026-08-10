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
  cause?: unknown;
}

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly userMessage: string;
  readonly statusCode?: number;
  readonly fieldErrors?: Record<string, string>;
  readonly isRetryable: boolean;
  readonly cause?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message ?? options.userMessage ?? USER_MESSAGE[options.kind]);

    this.name = 'AppError';
    this.kind = options.kind;
    this.userMessage = options.userMessage ?? USER_MESSAGE[options.kind];
    this.statusCode = options.statusCode;
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
