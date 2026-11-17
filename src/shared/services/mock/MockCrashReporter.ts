/**
 * MockCrashReporter
 *
 * Stands in for a crash reporting provider until one is chosen
 * (PROJECT_BIBLE.md section 57, "Crash Handling"). No crash SDK is in this
 * project and none may be added without approval, so reporting means writing
 * the failure to the app log, and remembering the most recent ones for tests and
 * debugging.
 *
 * A report keeps the error's name, its message and its stack, each cut to a
 * bounded length, plus where it was caught, whether it was fatal and who was
 * signed in. A value thrown that is not an `Error` is described by its type
 * alone: it can be a whole server response, and a crash report is not the place
 * to find out what was in it.
 *
 * ⚠️ It never throws — not even when the logger does. It is called from the
 * global error handler, ahead of React Native's own; an exception here would
 * replace the error being reported, and the one that mattered would be lost.
 *
 * Delete it, and its registration, when a real provider's implementation lands;
 * nothing above the interface changes.
 */

import { createLogger } from '@/core/logger/Logger';
import type {
  CrashContext,
  CrashReporter,
  CrashReportUser,
} from '@/shared/services/types/CrashReporter';

const log = createLogger('MockCrashReporter');

/** How many reports the mock remembers. */
export const MOCK_CRASH_REPORT_LIMIT = 20;

/**
 * Longest message kept. Messages are written by developers, but one can quote a
 * value it was handed, and a short one is all that is needed to find the throw.
 */
export const MOCK_CRASH_MESSAGE_MAX_LENGTH = 300;

/** Longest stack kept. The frames that matter are the first few. */
export const MOCK_CRASH_STACK_MAX_LENGTH = 2000;

export interface RecordedCrash {
  name: string;
  message: string;
  stack?: string;
  fatal: boolean;
  source?: string;
  /** Who was signed in when it happened. */
  user: CrashReportUser | null;
}

export interface MockCrashReporterOptions {
  /** How many reports to remember. Tests pass a small one to reach the bound. */
  limit?: number;
}

export class MockCrashReporter implements CrashReporter {
  private readonly limit: number;

  private readonly reports: RecordedCrash[] = [];

  private user: CrashReportUser | null = null;

  constructor(options: MockCrashReporterOptions = {}) {
    this.limit = Math.max(1, options.limit ?? MOCK_CRASH_REPORT_LIMIT);
  }

  recordError(error: unknown, context: CrashContext = {}): void {
    try {
      const report: RecordedCrash = {
        ...describeError(error),
        fatal: context.fatal === true,
        source: context.source,
        user: this.user,
      };

      this.reports.push(report);
      if (this.reports.length > this.limit) {
        this.reports.shift();
      }

      log.error(report.fatal ? 'Fatal error recorded' : 'Error recorded', {
        name: report.name,
        message: report.message,
        source: report.source,
        stack: report.stack,
      });
    } catch (caught) {
      reportOwnFailure('recordError', caught);
    }
  }

  setUser(user: CrashReportUser | null): void {
    try {
      // Field by field: whatever object the caller handed over, only these two
      // are kept.
      this.user = user ? { id: user.id, role: user.role } : null;

      if (this.user) {
        log.info('User set', this.user);
      } else {
        log.info('User cleared');
      }
    } catch (caught) {
      reportOwnFailure('setUser', caught);
    }
  }

  /** The remembered reports, oldest first. A copy: reading it changes nothing. */
  recentReports(): readonly RecordedCrash[] {
    return this.reports.map(report => ({ ...report }));
  }
}

function describeError(error: unknown): Pick<RecordedCrash, 'name' | 'message' | 'stack'> {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: truncate(error.message, MOCK_CRASH_MESSAGE_MAX_LENGTH),
      stack:
        typeof error.stack === 'string'
          ? truncate(error.stack, MOCK_CRASH_STACK_MAX_LENGTH)
          : undefined,
    };
  }

  if (typeof error === 'string') {
    return { name: 'NonError', message: truncate(error, MOCK_CRASH_MESSAGE_MAX_LENGTH) };
  }

  return {
    name: 'NonError',
    message: `A non-Error value was thrown (${error === null ? 'null' : typeof error})`,
  };
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/**
 * Says that reporting itself failed, if it can — by name only, for the reason
 * the analytics mock gives.
 */
function reportOwnFailure(operation: string, caught: unknown): void {
  try {
    log.warn('Crash reporting failed; nothing was recorded', {
      operation,
      error: caught instanceof Error ? caught.name : typeof caught,
    });
  } catch {
    // The logger is what failed. There is nowhere left to say so, and throwing
    // from here would bury the error that was being reported.
  }
}
