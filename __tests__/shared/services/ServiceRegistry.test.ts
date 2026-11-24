/**
 * The per-service switch (Phase 4A, 17/11/2026): each backend service runs on
 * its Api implementation when `AppConfig.services.live` names it and on its
 * mock otherwise, so services go live one at a time without the rest of the
 * app noticing.
 *
 * Pinned here: the default (sign in, the catalogue and the customer's side
 * live; the services with no backend still mock), that a
 * service flips on its own, that the device's and providers' services never
 * move with it, and that naming a service with no Api implementation stops
 * startup instead of quietly running a mock.
 *
 * The vendor's services are pinned by their own agent's tests (Phase 4A), so
 * the default is checked here as "includes", not as an exact list.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { ApiAuthService } from '@/shared/services/api/ApiAuthService';
import { ApiCategoryService } from '@/shared/services/api/ApiCategoryService';
import { ApiImageService } from '@/shared/services/api/ApiImageService';
import { ApiAddressBookService } from '@/shared/services/api/ApiAddressBookService';
import { ApiNotificationService } from '@/shared/services/api/ApiNotificationService';
import { ApiProfileService } from '@/shared/services/api/ApiProfileService';
import { ApiRequestService } from '@/shared/services/api/ApiRequestService';
import { ApiReviewService } from '@/shared/services/api/ApiReviewService';
import { ApiVendorService } from '@/shared/services/api/ApiVendorService';
import { DeviceNetworkStatusService } from '@/shared/services/device/DeviceNetworkStatusService';
import { DevicePermissionService } from '@/shared/services/device/DevicePermissionService';
import { MockAddressService } from '@/shared/services/mock/MockAddressService';
import { MockAnalyticsService } from '@/shared/services/mock/MockAnalyticsService';
import { MockAuthService } from '@/shared/services/mock/MockAuthService';
import { MockCategoryService } from '@/shared/services/mock/MockCategoryService';
import { MockCrashReporter } from '@/shared/services/mock/MockCrashReporter';
import { MockImageService } from '@/shared/services/mock/MockImageService';
import { MockLocationService } from '@/shared/services/mock/MockLocationService';
import { MockRequestService } from '@/shared/services/mock/MockRequestService';
import { MockReviewService } from '@/shared/services/mock/MockReviewService';
import { MockVendorService } from '@/shared/services/mock/MockVendorService';
import {
  configureServices,
  getService,
  resetServices,
  type ServiceKey,
} from '@/shared/services/ServiceRegistry';

/** Every key in `ServiceMap`, so a test can prove each one is registered. */
const EVERY_SERVICE: ServiceKey[] = [
  'auth',
  'category',
  'notification',
  'image',
  'request',
  'review',
  'vendor',
  'vendorProfile',
  'vendorDashboard',
  'vendorRequests',
  'vendorTeam',
  'vendorReports',
  'profile',
  'address',
  'addressBook',
  'location',
  'analytics',
  'crashReporter',
  'permission',
  'networkStatus',
];

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  resetServices();
  jest.restoreAllMocks();
});

describe('the default', () => {
  it('is sign in, the catalogue and the customer’s side live', () => {
    expect(AppConfig.services.live).toEqual(
      expect.arrayContaining([
        'auth',
        'category',
        'vendor',
        'request',
        'review',
        'profile',
        'notification',
        'addressBook',
        'image',
      ]),
    );
  });

  it('registers the Api implementations for the live services', () => {
    configureServices();

    expect(getService('auth')).toBeInstanceOf(ApiAuthService);
    expect(getService('category')).toBeInstanceOf(ApiCategoryService);
    expect(getService('vendor')).toBeInstanceOf(ApiVendorService);
    expect(getService('request')).toBeInstanceOf(ApiRequestService);
    expect(getService('review')).toBeInstanceOf(ApiReviewService);
    expect(getService('profile')).toBeInstanceOf(ApiProfileService);
    expect(getService('notification')).toBeInstanceOf(ApiNotificationService);
    expect(getService('addressBook')).toBeInstanceOf(ApiAddressBookService);
    // The phone's camera and `/uploads` since Phase 4B: the live services that
    // keep a picture accept only one the backend stored.
    expect(getService('image')).toBeInstanceOf(ApiImageService);
  });

  it('keeps the services with no live backend on their mocks', () => {
    configureServices();

    expect(getService('address')).toBeInstanceOf(MockAddressService);
  });

  it('registers every service, live or not', () => {
    configureServices();

    for (const key of EVERY_SERVICE) {
      expect(() => getService(key)).not.toThrow();
    }
  });
});

describe('flipping one service', () => {
  it('with nothing live, runs every backend service on its mock', () => {
    configureServices({ live: [] });

    expect(getService('auth')).toBeInstanceOf(MockAuthService);
    expect(getService('category')).toBeInstanceOf(MockCategoryService);
    expect(getService('image')).toBeInstanceOf(MockImageService);
  });

  it('moves only the service it names', () => {
    configureServices({ live: ['category'] });

    expect(getService('category')).toBeInstanceOf(ApiCategoryService);
    expect(getService('auth')).toBeInstanceOf(MockAuthService);
    expect(getService('request')).toBeInstanceOf(MockRequestService);
    expect(getService('review')).toBeInstanceOf(MockReviewService);
    expect(getService('vendor')).toBeInstanceOf(MockVendorService);
  });

  it('never moves the device’s services or the providers’', () => {
    for (const live of [[], ['auth', 'category']] as const) {
      configureServices({ live });

      expect(getService('permission')).toBeInstanceOf(DevicePermissionService);
      expect(getService('networkStatus')).toBeInstanceOf(DeviceNetworkStatusService);
      expect(getService('location')).toBeInstanceOf(MockLocationService);
      expect(getService('analytics')).toBeInstanceOf(MockAnalyticsService);
      expect(getService('crashReporter')).toBeInstanceOf(MockCrashReporter);
    }
  });

  it('stops startup for a live service that has no Api implementation yet', () => {
    expect(() => configureServices({ live: ['address'] })).toThrow(
      /"address", which has no Api implementation/,
    );
  });

  it('starts from nothing each time, so a second configuration replaces the first', () => {
    configureServices({ live: ['auth'] });
    configureServices({ live: [] });

    expect(getService('auth')).toBeInstanceOf(MockAuthService);
  });
});
