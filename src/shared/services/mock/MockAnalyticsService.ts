/**
 * MockAnalyticsService
 *
 * Stands in for an analytics provider until one is chosen (PROJECT_BIBLE.md
 * section 54). There is no provider SDK in this project and none may be added
 * without approval, so sending an event means writing it to the app log — which
 * is also how an event is checked on a device: every one is a line from
 * `MockAnalyticsService` in logcat.
 *
 * It remembers the most recent events, oldest first, so a test can assert on
 * what was sent and a debugging session can read it back. Bounded, because an
 * app left open all day must not grow a list for ever.
 *
 * ⚠️ It never throws — not even when the logger does. Section 54 says analytics
 * "must not interfere with business operations", and an exception from here
 * would surface in the middle of a sign in. A failure inside it is logged where
 * possible and goes no further: an event lost is cheap, a sign in lost is not.
 *
 * Delete it, and its registration, when a real provider's implementation lands;
 * nothing above the interface changes.
 */

import { createLogger } from '@/core/logger/Logger';
import type {
  AnalyticsEventName,
  AnalyticsProperties,
  AnalyticsService,
  AnalyticsUser,
} from '@/shared/services/types/AnalyticsService';

const log = createLogger('MockAnalyticsService');

/** How many events the mock remembers. Comfortably more than one whole flow. */
export const MOCK_ANALYTICS_EVENT_LIMIT = 50;

export interface RecordedAnalyticsEvent {
  event: AnalyticsEventName;
  properties: AnalyticsProperties;
  /** Who was identified when it was tracked — who a provider would attribute it to. */
  user: AnalyticsUser | null;
}

export interface MockAnalyticsServiceOptions {
  /** How many events to remember. Tests pass a small one to reach the bound. */
  limit?: number;
}

export class MockAnalyticsService implements AnalyticsService {
  private readonly limit: number;

  private readonly events: RecordedAnalyticsEvent[] = [];

  private user: AnalyticsUser | null = null;

  constructor(options: MockAnalyticsServiceOptions = {}) {
    this.limit = Math.max(1, options.limit ?? MOCK_ANALYTICS_EVENT_LIMIT);
  }

  track(event: AnalyticsEventName, properties: AnalyticsProperties = {}): void {
    try {
      // A copy, so a caller reusing its object afterwards cannot rewrite history.
      const recorded: RecordedAnalyticsEvent = {
        event,
        properties: { ...properties },
        user: this.user,
      };

      this.events.push(recorded);
      if (this.events.length > this.limit) {
        this.events.shift();
      }

      log.info('Event tracked', { event, properties: recorded.properties });
    } catch (caught) {
      reportOwnFailure('track', caught);
    }
  }

  identify(user: AnalyticsUser | null): void {
    try {
      // Field by field: whatever object the caller handed over, only these two
      // are kept.
      this.user = user ? { id: user.id, role: user.role } : null;

      if (this.user) {
        log.info('User identified', this.user);
      } else {
        log.info('User cleared');
      }
    } catch (caught) {
      reportOwnFailure('identify', caught);
    }
  }

  /** The remembered events, oldest first. A copy: reading it changes nothing. */
  recentEvents(): readonly RecordedAnalyticsEvent[] {
    return this.events.map(recorded => ({ ...recorded }));
  }
}

/**
 * Says that analytics itself failed, if it can.
 *
 * Only the failure's name is logged. Its message could quote whatever the
 * provider choked on, and that could be the very property being sent.
 */
function reportOwnFailure(operation: string, caught: unknown): void {
  try {
    log.warn('Analytics failed; nothing was recorded', {
      operation,
      error: caught instanceof Error ? caught.name : typeof caught,
    });
  } catch {
    // The logger is what failed. There is nowhere left to say so, and section
    // 54 forbids handing the failure to the caller instead.
  }
}
