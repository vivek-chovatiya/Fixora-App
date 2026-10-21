/**
 * The global handler adds a record and changes nothing else (PROJECT_BIBLE.md
 * section 57). Pinned here:
 *
 * - an uncaught error is recorded, with React Native's fatal flag, and then
 *   handed to the handler that was there before — in that order, because a
 *   fatal error in a release build ends the process inside that handler;
 * - the previous handler runs whatever recording does: with no crash reporter
 *   registered, and with one that throws;
 * - installing twice does not wrap twice, including when the module is
 *   evaluated afresh, as Fast Refresh does. A double wrap would record every
 *   crash twice for the rest of the session.
 */

import {
  installGlobalErrorHandler,
  type GlobalErrorUtils,
} from '@/app/globalErrorHandler';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';

type Handler = (error: unknown, isFatal?: boolean) => void;

/** Stands in for React Native's ErrorUtils, holding one handler as it does. */
function createErrorUtils(initial: Handler) {
  let current: Handler = initial;
  const errorUtils: GlobalErrorUtils = {
    getGlobalHandler: () => current,
    setGlobalHandler: handler => {
      current = handler;
    },
  };
  return { errorUtils, current: () => current };
}

function stubCrashReporter() {
  return { recordError: jest.fn(), setUser: jest.fn() };
}

afterEach(() => {
  resetServices();
  jest.restoreAllMocks();
});

describe('installGlobalErrorHandler', () => {
  it('records an uncaught error, then hands it to the previous handler', () => {
    const crashReporter = stubCrashReporter();
    registerService('crashReporter', crashReporter);
    const previous = jest.fn();
    const runtime = createErrorUtils(previous);
    const error = new Error('thrown from a press handler');

    expect(installGlobalErrorHandler(runtime.errorUtils)).toBe(true);
    runtime.current()(error, true);

    expect(crashReporter.recordError).toHaveBeenCalledTimes(1);
    expect(crashReporter.recordError).toHaveBeenCalledWith(error, {
      fatal: true,
      source: 'global',
    });
    expect(previous).toHaveBeenCalledTimes(1);
    expect(previous).toHaveBeenCalledWith(error, true);
    expect(crashReporter.recordError.mock.invocationCallOrder[0]).toBeLessThan(
      previous.mock.invocationCallOrder[0],
    );
  });

  it('records a non-fatal error as not fatal', () => {
    const crashReporter = stubCrashReporter();
    registerService('crashReporter', crashReporter);
    const runtime = createErrorUtils(jest.fn());

    installGlobalErrorHandler(runtime.errorUtils);
    runtime.current()(new Error('soft'), false);
    runtime.current()(new Error('no flag'));

    expect(crashReporter.recordError.mock.calls.map(call => call[1])).toEqual([
      { fatal: false, source: 'global' },
      { fatal: false, source: 'global' },
    ]);
  });

  it('still hands the error on with no crash reporter registered', () => {
    resetServices();
    const previous = jest.fn();
    const runtime = createErrorUtils(previous);
    const error = new Error('boom');

    installGlobalErrorHandler(runtime.errorUtils);

    expect(() => runtime.current()(error, true)).not.toThrow();
    expect(previous).toHaveBeenCalledWith(error, true);
  });

  it('still hands the error on when the crash reporter throws', () => {
    registerService('crashReporter', {
      recordError: jest.fn(() => {
        throw new Error('reporter exploded');
      }),
      setUser: jest.fn(),
    });
    const previous = jest.fn();
    const runtime = createErrorUtils(previous);
    const error = new Error('boom');

    installGlobalErrorHandler(runtime.errorUtils);
    runtime.current()(error, true);

    expect(previous).toHaveBeenCalledTimes(1);
    expect(previous).toHaveBeenCalledWith(error, true);
  });

  it('installs once, however often it is asked', () => {
    const crashReporter = stubCrashReporter();
    registerService('crashReporter', crashReporter);
    const previous = jest.fn();
    const runtime = createErrorUtils(previous);

    expect(installGlobalErrorHandler(runtime.errorUtils)).toBe(true);
    const installed = runtime.current();
    expect(installGlobalErrorHandler(runtime.errorUtils)).toBe(false);
    expect(runtime.current()).toBe(installed);

    runtime.current()(new Error('boom'), true);

    expect(crashReporter.recordError).toHaveBeenCalledTimes(1);
    expect(previous).toHaveBeenCalledTimes(1);
  });

  it('installs once even when the module is evaluated again, as Fast Refresh does', () => {
    const crashReporter = stubCrashReporter();
    registerService('crashReporter', crashReporter);
    const runtime = createErrorUtils(jest.fn());

    installGlobalErrorHandler(runtime.errorUtils);

    let installedAgain: boolean | undefined;
    jest.isolateModules(() => {
      const fresh: typeof import('@/app/globalErrorHandler') = require('@/app/globalErrorHandler');
      installedAgain = fresh.installGlobalErrorHandler(runtime.errorUtils);
    });

    expect(installedAgain).toBe(false);
    runtime.current()(new Error('boom'), true);
    expect(crashReporter.recordError).toHaveBeenCalledTimes(1);
  });

  it("wraps React Native's own ErrorUtils by default", () => {
    const original = ErrorUtils.getGlobalHandler();
    try {
      const crashReporter = stubCrashReporter();
      registerService('crashReporter', crashReporter);
      const previous = jest.fn();
      ErrorUtils.setGlobalHandler(previous);

      expect(installGlobalErrorHandler()).toBe(true);
      ErrorUtils.getGlobalHandler()(new Error('boom'), false);

      expect(crashReporter.recordError).toHaveBeenCalledTimes(1);
      expect(previous).toHaveBeenCalledTimes(1);
    } finally {
      ErrorUtils.setGlobalHandler(original);
    }
  });

  it('says so, and installs nothing, where there is no ErrorUtils', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(installGlobalErrorHandler(null)).toBe(false);
  });
});
