/**
 * CrashReporter
 *
 * The only route to crash and error reporting (PROJECT_BIBLE.md section 57,
 * Shared: "Crash Handling").
 *
 * Two things feed it: `AppErrorBoundary`, for a screen that fails to render, and
 * the global JavaScript handler installed at bootstrap, for anything thrown
 * outside a render. Code reaches it through `recordError` in
 * `shared/services/telemetry.ts`, never through `getService`.
 *
 * Synchronous and never throws, for the reason analytics is (section 54): the
 * moment something is reported is the moment the app is already in trouble, and
 * a reporter that threw would turn a recoverable failure into a lost one — or,
 * inside the global handler, stop React Native's own handling from running.
 *
 * ⚠️ A report carries the error and the signed-in user's id and role. Never the
 * user's name, phone number or any code: a one-time code is a credential for
 * as long as it lives, and section 7A keeps every code out of crash reports.
 */

export interface CrashContext {
  /**
   * True when the app cannot carry on. React Native decides this for the global
   * handler; a render failure the error boundary recovers from is not fatal.
   */
  fatal?: boolean;
  /**
   * Where it was caught: `'render'` from the error boundary, `'global'` from the
   * JavaScript handler.
   */
  source?: string;
}

/** Who was signed in when it happened. Id and role only — see the ⚠️ above. */
export interface CrashReportUser {
  id: string;
  role: string;
}

export interface CrashReporter {
  /** Records a failure. Accepts anything thrown, not only an `Error`. Never throws. */
  recordError(error: unknown, context?: CrashContext): void;

  /** Attaches reports that follow to a user, or to nobody after sign out. Never throws. */
  setUser(user: CrashReportUser | null): void;
}
