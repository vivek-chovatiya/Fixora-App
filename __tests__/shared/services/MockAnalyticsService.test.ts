/**
 * MockAnalyticsService stands in for a provider, so it has to keep the two
 * promises a provider will be held to (PROJECT_BIBLE.md section 54):
 *
 * - it never throws into the caller — not even when the logger it writes to
 *   does, because the caller is in the middle of a sign in;
 * - it keeps only an id and a role for a user, whatever object it is handed.
 *
 * And it must stay bounded: an app left open all day cannot grow a list for
 * ever.
 */

import type { AuthUser } from '@/features/auth/types';
import {
  MOCK_ANALYTICS_EVENT_LIMIT,
  MockAnalyticsService,
} from '@/shared/services/mock/MockAnalyticsService';

const FULL_USER: AuthUser = {
  id: 'usr_customer_1',
  firstName: 'Asha',
  lastName: 'Patel',
  email: 'asha@example.com',
  phone: '9876543210',
  role: 'customer',
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('MockAnalyticsService', () => {
  it('remembers events oldest first, with what they carried', () => {
    const analytics = new MockAnalyticsService();

    analytics.track('app_opened');
    analytics.track('login_completed', { role: 'customer' });

    expect(analytics.recentEvents()).toEqual([
      { event: 'app_opened', properties: {}, user: null },
      { event: 'login_completed', properties: { role: 'customer' }, user: null },
    ]);
  });

  it('forgets the oldest once it holds its limit', () => {
    const analytics = new MockAnalyticsService({ limit: 3 });

    analytics.track('app_opened');
    analytics.track('login_completed', { role: 'customer' });
    analytics.track('category_selected', { categoryId: 'cat_1' });
    analytics.track('subcategory_selected', { subCategoryId: 'sub_1' });
    analytics.track('request_started');

    expect(analytics.recentEvents().map(recorded => recorded.event)).toEqual([
      'category_selected',
      'subcategory_selected',
      'request_started',
    ]);
  });

  it('is bounded by default', () => {
    const analytics = new MockAnalyticsService();

    for (let i = 0; i < MOCK_ANALYTICS_EVENT_LIMIT + 10; i += 1) {
      analytics.track('app_opened');
    }

    expect(analytics.recentEvents()).toHaveLength(MOCK_ANALYTICS_EVENT_LIMIT);
  });

  it('keeps what an event carried even if the caller changes its object afterwards', () => {
    const analytics = new MockAnalyticsService();
    const properties: Record<string, string> = { role: 'customer' };

    analytics.track('login_completed', properties);
    properties.role = 'vendor';

    expect(analytics.recentEvents()[0].properties).toEqual({ role: 'customer' });
  });

  it('attributes events to whoever is identified, by id and role only', () => {
    const analytics = new MockAnalyticsService();

    analytics.identify(FULL_USER);
    analytics.track('login_completed', { role: 'customer' });
    analytics.identify(null);
    analytics.track('app_opened');

    const [signedIn, signedOut] = analytics.recentEvents();
    expect(signedIn.user).toEqual({ id: 'usr_customer_1', role: 'customer' });
    expect(Object.keys(signedIn.user ?? {}).sort()).toEqual(['id', 'role']);
    expect(signedOut.user).toBeNull();

    const serialised = JSON.stringify(analytics.recentEvents());
    expect(serialised).not.toContain('9876543210');
    expect(serialised).not.toContain('Asha');
    expect(serialised).not.toContain('asha@example.com');
  });

  it('never throws, even when the logger does', () => {
    const analytics = new MockAnalyticsService();
    const broken = () => {
      throw new Error('console is gone');
    };
    jest.spyOn(console, 'log').mockImplementation(broken);
    jest.spyOn(console, 'warn').mockImplementation(broken);
    jest.spyOn(console, 'error').mockImplementation(broken);

    expect(() => analytics.track('login_completed', { role: 'customer' })).not.toThrow();
    expect(() => analytics.identify(FULL_USER)).not.toThrow();
    expect(() => analytics.identify(null)).not.toThrow();
  });

  it('hands out a copy, so reading cannot rewrite what was recorded', () => {
    const analytics = new MockAnalyticsService();
    analytics.track('app_opened');

    const read = analytics.recentEvents() as unknown as Array<{ event: string }>;
    read[0].event = 'vendor_signup';
    read.pop();

    expect(analytics.recentEvents()).toEqual([
      { event: 'app_opened', properties: {}, user: null },
    ]);
  });
});
