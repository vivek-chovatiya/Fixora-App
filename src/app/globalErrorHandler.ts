/**
 * Global error handler
 *
 * Records what nothing else catches — an exception thrown from a press handler,
 * a timer or a callback, outside any render (PROJECT_BIBLE.md section 57,
 * "Crash Handling") — and then hands it to the handler that was there before,
 * so React Native behaves exactly as it did: the red box in a debug build, its
 * own crash handling in a release one. This adds a record; it changes nothing
 * the user sees.
 *
 * Render failures do not arrive here. `AppErrorBoundary` catches those inside
 * the app, and one that escapes every boundary React hands straight to React
 * Native's exception manager, not to this handler.
 *
 * ⚠️ Installed once, and the check is on the handler actually installed rather
 * than a flag in this module. Fast Refresh can evaluate this module again with
 * fresh state while React Native's handler stays put, so a module flag would
 * wrap our own handler a second time — and every crash would be recorded twice
 * for the rest of the session. The handler carries a mark in the global symbol
 * registry, which is the same symbol however often this file is evaluated.
 *
 * ⚠️ Unhandled promise rejections are not recorded. React Native 0.86 tracks
 * them in debug builds only, through a Hermes-internal hook that reports
 * straight to its exception manager and holds a single tracker; there is no
 * supported way to observe them without replacing React Native's tracker or
 * patching Promise, and this does neither. Recorded as an open item.
 */

import { createLogger } from '@/core/logger/Logger';
import { recordError } from '@/shared/services/telemetry';

const log = createLogger('globalErrorHandler');

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

/**
 * The two members of React Native's `ErrorUtils` this needs. Narrow on purpose,
 * so a test can hand in its own instead of replacing the runtime's.
 */
export interface GlobalErrorUtils {
  getGlobalHandler(): GlobalErrorHandler;
  setGlobalHandler(handler: GlobalErrorHandler): void;
}

const INSTALLED = Symbol.for('fixora.globalErrorHandler');

function isInstalled(handler: unknown): boolean {
  return (
    typeof handler === 'function' &&
    (handler as unknown as Record<symbol, unknown>)[INSTALLED] === true
  );
}

/** `null`, not `undefined`, for "none": `undefined` would select the default. */
function runtimeErrorUtils(): GlobalErrorUtils | null {
  return typeof ErrorUtils === 'undefined' ? null : ErrorUtils;
}

/**
 * Wraps the current global handler. Answers whether it installed anything —
 * `false` when ours is already in place, or when there is no `ErrorUtils` to
 * wrap.
 */
export function installGlobalErrorHandler(
  errorUtils: GlobalErrorUtils | null = runtimeErrorUtils(),
): boolean {
  if (!errorUtils) {
    log.warn('No global error handler to wrap; uncaught errors are not recorded');
    return false;
  }

  const previous = errorUtils.getGlobalHandler();
  if (isInstalled(previous)) {
    return false;
  }

  const handler: GlobalErrorHandler = (error, isFatal) => {
    try {
      // First: a fatal error in a release build ends the process inside the
      // previous handler, and nothing after it would run.
      recordError(error, { fatal: isFatal === true, source: 'global' });
    } finally {
      // Always, whatever recording did. React Native's handling is what the
      // user sees, and a report must never stand in its way.
      if (typeof previous === 'function') {
        previous(error, isFatal);
      }
    }
  };
  Object.defineProperty(handler, INSTALLED, { value: true });

  errorUtils.setGlobalHandler(handler);
  return true;
}
