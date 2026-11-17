/**
 * MockCrashReporter is called from the global error handler, ahead of React
 * Native's own (PROJECT_BIBLE.md section 57). So it must:
 *
 * - never throw, even when the logger does — an exception here would bury the
 *   error being reported;
 * - keep a report short and free of what was not an error: a thrown object can
 *   be a whole server response, and a phone number inside one must not be
 *   copied into a crash report;
 * - keep only an id and a role for a user (section 7A.2 forbids credentials in
 *   crash reports, and a name or phone number has no business there either).
 */

import type { AuthUser } from '@/features/auth/types';
import {
  MOCK_CRASH_MESSAGE_MAX_LENGTH,
  MOCK_CRASH_REPORT_LIMIT,
  MOCK_CRASH_STACK_MAX_LENGTH,
  MockCrashReporter,
} from '@/shared/services/mock/MockCrashReporter';
import { AppError } from '@/shared/types/error';

const VENDOR: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

beforeEach(() => {
  // Recording logs at error level; the output is the mock's, not a failure.
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('MockCrashReporter', () => {
  it('records the error, where it was caught, whether it was fatal and who was signed in', () => {
    const reporter = new MockCrashReporter();
    const error = new TypeError('undefined is not a function');

    reporter.setUser(VENDOR);
    reporter.recordError(error, { fatal: true, source: 'global' });

    const [report] = reporter.recentReports();
    expect(report).toMatchObject({
      name: 'TypeError',
      message: 'undefined is not a function',
      fatal: true,
      source: 'global',
      user: { id: 'usr_vendor_1', role: 'vendor' },
    });
    expect(report.stack).toContain('undefined is not a function');
  });

  it('treats a report as not fatal unless told otherwise', () => {
    const reporter = new MockCrashReporter();

    reporter.recordError(new Error('render failed'), { source: 'render' });
    reporter.recordError(new Error('no context'));

    expect(reporter.recentReports().map(report => report.fatal)).toEqual([false, false]);
  });

  it('keeps the id and role of the user, never their name or phone number', () => {
    const reporter = new MockCrashReporter();

    reporter.setUser(VENDOR);
    reporter.recordError(new Error('boom'));
    reporter.setUser(null);
    reporter.recordError(new Error('after sign out'));

    const [signedIn, signedOut] = reporter.recentReports();
    expect(Object.keys(signedIn.user ?? {}).sort()).toEqual(['id', 'role']);
    expect(signedOut.user).toBeNull();
    expect(JSON.stringify(reporter.recentReports())).not.toContain('9000000001');
    expect(JSON.stringify(reporter.recentReports())).not.toContain('Ravi');
  });

  it('cuts a long message and a long stack to a bounded length', () => {
    const reporter = new MockCrashReporter();
    const error = new Error('x'.repeat(MOCK_CRASH_MESSAGE_MAX_LENGTH * 3));
    error.stack = 'y'.repeat(MOCK_CRASH_STACK_MAX_LENGTH * 3);

    reporter.recordError(error);

    const [report] = reporter.recentReports();
    // The bound plus the one-character ellipsis that says it was cut.
    expect(report.message.length).toBe(MOCK_CRASH_MESSAGE_MAX_LENGTH + 1);
    expect(report.stack?.length).toBe(MOCK_CRASH_STACK_MAX_LENGTH + 1);
  });

  it('keeps an AppError by its developer message, never needing its user message', () => {
    const reporter = new MockCrashReporter();

    reporter.recordError(new AppError({ kind: 'server', message: 'Mock server fault' }));

    expect(reporter.recentReports()[0]).toMatchObject({
      name: 'AppError',
      message: 'Mock server fault',
    });
  });

  it('describes a thrown non-error by its type, never by what it held', () => {
    const reporter = new MockCrashReporter();

    reporter.recordError({ customer: { phone: '9876543210', name: 'Asha Patel' } });
    reporter.recordError(null);
    reporter.recordError(42);

    const reports = reporter.recentReports();
    expect(reports.map(report => report.name)).toEqual(['NonError', 'NonError', 'NonError']);
    expect(reports[0].message).toContain('object');
    expect(reports[1].message).toContain('null');
    expect(JSON.stringify(reports)).not.toContain('9876543210');
    expect(JSON.stringify(reports)).not.toContain('Asha');
  });

  it('keeps a thrown string as its message', () => {
    const reporter = new MockCrashReporter();

    reporter.recordError('Unexpected end of input');

    expect(reporter.recentReports()[0]).toMatchObject({
      name: 'NonError',
      message: 'Unexpected end of input',
    });
  });

  it('forgets the oldest once it holds its limit', () => {
    const reporter = new MockCrashReporter({ limit: 2 });

    reporter.recordError(new Error('first'));
    reporter.recordError(new Error('second'));
    reporter.recordError(new Error('third'));

    expect(reporter.recentReports().map(report => report.message)).toEqual(['second', 'third']);
  });

  it('is bounded by default', () => {
    const reporter = new MockCrashReporter();

    for (let i = 0; i < MOCK_CRASH_REPORT_LIMIT + 5; i += 1) {
      reporter.recordError(new Error(`failure ${i}`));
    }

    expect(reporter.recentReports()).toHaveLength(MOCK_CRASH_REPORT_LIMIT);
  });

  it('never throws, even when the logger does', () => {
    const reporter = new MockCrashReporter();
    const broken = () => {
      throw new Error('console is gone');
    };
    jest.spyOn(console, 'log').mockImplementation(broken);
    jest.spyOn(console, 'warn').mockImplementation(broken);
    jest.spyOn(console, 'error').mockImplementation(broken);

    expect(() => reporter.recordError(new Error('boom'), { fatal: true })).not.toThrow();
    expect(() => reporter.setUser(VENDOR)).not.toThrow();
    expect(() => reporter.setUser(null)).not.toThrow();
  });

  it('never throws on an error whose properties throw when read', () => {
    const reporter = new MockCrashReporter();
    const hostile = new Error('hostile');
    Object.defineProperty(hostile, 'message', {
      get() {
        throw new Error('no reading this');
      },
    });

    expect(() => reporter.recordError(hostile)).not.toThrow();
  });
});
