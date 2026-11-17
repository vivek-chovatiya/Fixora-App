/**
 * Bootstrap is where crash handling starts and where `app_opened` is sent
 * (PROJECT_BIBLE.md sections 54 and 57). One cold start is one `app_opened`:
 * App.tsx calls bootstrap at import, and anything that called it twice must not
 * count the start twice or wrap the global handler twice.
 */

import { bootstrapApp } from '@/app/bootstrap';
import type { MockAnalyticsService } from '@/shared/services/mock/MockAnalyticsService';
import { getService, resetServices } from '@/shared/services/ServiceRegistry';

describe('bootstrapApp', () => {
  const originalHandler = ErrorUtils.getGlobalHandler();

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    ErrorUtils.setGlobalHandler(originalHandler);
    resetServices();
    jest.restoreAllMocks();
  });

  it('sends app_opened once and wraps the global handler once, however often it runs', () => {
    const previous = jest.fn();
    ErrorUtils.setGlobalHandler(previous);

    bootstrapApp();
    const installed = ErrorUtils.getGlobalHandler();
    bootstrapApp();

    const analytics = getService('analytics') as MockAnalyticsService;
    const opened = analytics.recentEvents().filter(recorded => recorded.event === 'app_opened');
    expect(opened).toHaveLength(1);
    expect(opened[0].properties).toEqual({});

    expect(installed).not.toBe(previous);
    expect(ErrorUtils.getGlobalHandler()).toBe(installed);
  });
});
