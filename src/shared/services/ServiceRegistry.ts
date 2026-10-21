/**
 * ServiceRegistry
 *
 * The single place that decides which implementation backs each service.
 *
 * Going live is one edit per service in `configureServices` plus flipping
 * `AppConfig.features.useMockServices`. Screens, hooks, components and
 * navigation are unaffected, because they resolve services through this
 * registry and depend only on the interfaces.
 *
 * Add a new service by extending `ServiceMap` and registering it below.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { getSessionStorage } from '@/core/storage/SessionStorage';
import { DeviceNetworkStatusService } from '@/shared/services/device/DeviceNetworkStatusService';
import { DevicePermissionService } from '@/shared/services/device/DevicePermissionService';
import { MockAddressService } from '@/shared/services/mock/MockAddressService';
import { MockAnalyticsService } from '@/shared/services/mock/MockAnalyticsService';
import { MockAuthService } from '@/shared/services/mock/MockAuthService';
import { MockCategoryService } from '@/shared/services/mock/MockCategoryService';
import { MockCrashReporter } from '@/shared/services/mock/MockCrashReporter';
import { MockImageService } from '@/shared/services/mock/MockImageService';
import { MockLocationService } from '@/shared/services/mock/MockLocationService';
import { MockNotificationService } from '@/shared/services/mock/MockNotificationService';
import { AsyncStorageMockRequestHistory } from '@/shared/services/mock/MockRequestHistoryStorage';
import { MockRequestService } from '@/shared/services/mock/MockRequestService';
import { MockReviewService } from '@/shared/services/mock/MockReviewService';
import { AsyncStorageMockReviewStorage } from '@/shared/services/mock/MockReviewStorage';
import { MockAddressBookService } from '@/shared/services/mock/MockAddressBookService';
import { AsyncStorageMockSavedAddresses } from '@/shared/services/mock/MockSavedAddressStorage';
import { MockProfileService } from '@/shared/services/mock/MockProfileService';
import { MockVendorService } from '@/shared/services/mock/MockVendorService';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { MockVendorRequestBook } from '@/shared/services/mock/MockVendorRequestBook';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import { MockVendorReportService } from '@/shared/services/mock/MockVendorReportService';
import { AsyncStorageMockVendorProfiles } from '@/shared/services/mock/MockVendorProfileStorage';
import { MockVendorTeamService } from '@/shared/services/mock/MockVendorTeamService';
import { AsyncStorageMockVendorTeam } from '@/shared/services/mock/MockVendorTeamStorage';
import type { AddressService } from '@/shared/services/types/AddressService';
import type { AnalyticsService } from '@/shared/services/types/AnalyticsService';
import type { AuthService } from '@/shared/services/types/AuthService';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type { CrashReporter } from '@/shared/services/types/CrashReporter';
import type { ImageService } from '@/shared/services/types/ImageService';
import type { LocationService } from '@/shared/services/types/LocationService';
import type { NetworkStatusService } from '@/shared/services/types/NetworkStatusService';
import type { NotificationService } from '@/shared/services/types/NotificationService';
import type { PermissionService } from '@/shared/services/types/PermissionService';
import type { RequestService } from '@/shared/services/types/RequestService';
import type { ReviewService } from '@/shared/services/types/ReviewService';
import type { AddressBookService } from '@/shared/services/types/AddressBookService';
import type { ProfileService } from '@/shared/services/types/ProfileService';
import type { VendorService } from '@/shared/services/types/VendorService';
import type { VendorDashboardService } from '@/shared/services/types/VendorDashboardService';
import type { VendorProfileService } from '@/shared/services/types/VendorProfileService';
import type { VendorRequestService } from '@/shared/services/types/VendorRequestService';
import type { VendorReportService } from '@/shared/services/types/VendorReportService';
import type { VendorTeamService } from '@/shared/services/types/VendorTeamService';
import type { AuthUser } from '@/features/auth/types';

const log = createLogger('ServiceRegistry');

/**
 * The signed-in customer's id, for the mock request table.
 *
 * Read from the stored session rather than the store. The auth thunks write a
 * session to the device before anything else hears of it, and clear it before
 * signing out is announced, so this is never behind what the navigator shows.
 * A vendor's session is not a customer's, and has no customer requests.
 */
async function signedInCustomerId(): Promise<string | null> {
  const session = await getSessionStorage().read();

  return session?.user.role === 'customer' ? session.user.id : null;
}

/**
 * Whoever is signed in, for services that decide for themselves whether the
 * role fits — the vendor profile refuses a customer, as its endpoint would.
 */
async function signedInUser(): Promise<AuthUser | null> {
  const session = await getSessionStorage().read();

  return session?.user ?? null;
}

export interface ServiceMap {
  auth: AuthService;
  category: CategoryService;
  /**
   * The signed-in account's in-app notifications (PROJECT_BIBLE.md sections 57
   * and 80), for either role. Push is section 72's Phase 2: its methods are on
   * the interface as a seam and do nothing yet.
   */
  notification: NotificationService;
  image: ImageService;
  request: RequestService;
  /**
   * A customer's review of a finished request (PROJECT_BIBLE.md section 24),
   * and — read-only — the reviews a vendor has received (section 41). Its own
   * service, because a review is not part of the request and never changes it.
   */
  review: ReviewService;
  vendor: VendorService;
  /**
   * The signed-in vendor's own business profile (PROJECT_BIBLE.md section 38).
   * Separate from `vendor`, which lists vendors for a customer to choose from.
   */
  vendorProfile: VendorProfileService;
  /**
   * The signed-in vendor's work at a glance (PROJECT_BIBLE.md section 30).
   * A read-only summary; the request list and its actions get their own.
   */
  vendorDashboard: VendorDashboardService;
  /**
   * The signed-in vendor's requests, and their answer to one that is waiting
   * (PROJECT_BIBLE.md sections 31 to 33). Nothing moves work along yet.
   */
  vendorRequests: VendorRequestService;
  /**
   * The people who work for the signed-in vendor (PROJECT_BIBLE.md section 39).
   * A list the vendor keeps: nobody on it is assigned work or signs in.
   */
  vendorTeam: VendorTeamService;
  /**
   * The signed-in vendor's basic figures for today, this week or this month
   * (PROJECT_BIBLE.md section 42). Counted by the server, never by the app.
   */
  vendorReports: VendorReportService;
  /**
   * What the account says about its owner (PROJECT_BIBLE.md section 25).
   * Separate from `auth`: proving who somebody is and editing their name are
   * different operations that will be different endpoints.
   */
  profile: ProfileService;
  /**
   * Where the work is (PROJECT_BIBLE.md section 18). A gazetteer, not the device.
   */
  address: AddressService;
  /**
   * The customer's own saved addresses (PROJECT_BIBLE.md section 18, reached
   * from section 25). Separate from `address`: that one finds places for
   * anybody, this one keeps a collection belonging to one customer.
   */
  addressBook: AddressBookService;
  /**
   * The device's own position.
   *
   * ⚠️ Registered in the mock branch below rather than beside `permission`,
   * unlike the device capability it looks like. Permissions have a real
   * implementation because `react-native-permissions` is a dependency; there is
   * no geolocation library in this project, so there is nothing real to register
   * yet. It moves up beside `permission` on the day one is approved.
   */
  location: LocationService;
  /**
   * Product analytics (PROJECT_BIBLE.md section 54). Reached through
   * `trackEvent` in `telemetry.ts` or `useAnalytics`, never `getService`: those
   * do nothing when it is missing, where `getService` would throw into the
   * sign in that was being counted.
   *
   * ⚠️ Registered in the mock branch below for the reason `location` is: there
   * is no analytics provider in this project, so nothing real to register yet.
   * It is a provider rather than the backend, so it moves up beside
   * `permission` on the day one is approved — going live with the API does not
   * change where events go.
   */
  analytics: AnalyticsService;
  /**
   * Crash and error reporting (PROJECT_BIBLE.md section 57, "Crash Handling").
   * Reached through `recordError` in `telemetry.ts`, and registered where
   * `analytics` is, for the same reasons.
   */
  crashReporter: CrashReporter;
  /**
   * Device capability rather than a backend one, which is why it is registered
   * outside the mock/live switch below. A camera permission does not become
   * real when the API does.
   */
  permission: PermissionService;
  /**
   * Whether the device is offline (PROJECT_BIBLE.md sections 49 and 57), for
   * the app-wide banner. Registered beside `permission` for the same reason:
   * the device's answer in every build. Reached through `useNetworkStatus`.
   */
  networkStatus: NetworkStatusService;
}

export type ServiceKey = keyof ServiceMap;

const registry = new Map<ServiceKey, ServiceMap[ServiceKey]>();

export function registerService<K extends ServiceKey>(key: K, implementation: ServiceMap[K]): void {
  registry.set(key, implementation);
}

/**
 * Resolves a service. Throws rather than returning undefined: an unregistered
 * service is a wiring bug that should surface immediately, not a runtime
 * condition for callers to handle.
 */
export function getService<K extends ServiceKey>(key: K): ServiceMap[K] {
  const implementation = registry.get(key);
  if (!implementation) {
    throw new Error(
      `Service "${key}" is not registered. Call configureServices() during app startup.`,
    );
  }
  return implementation as ServiceMap[K];
}

/**
 * Wires every service. Called once from the app root before render.
 */
export function configureServices(): void {
  registry.clear();

  // Registered in both branches on purpose. Everything below this line is a
  // backend service and follows `useMockServices`; permissions are the device's
  // answer either way, and a mock one would prompt nobody.
  registerService('permission', new DevicePermissionService());
  // Connectivity is the device's answer too: a mock backend still runs on a
  // phone that can lose its signal.
  registerService('networkStatus', new DeviceNetworkStatusService());

  if (AppConfig.features.useMockServices) {
    registerService('auth', new MockAuthService());
    registerService('category', new MockCategoryService());
    // Each account's own inbox, by whoever is signed in — either role has one.
    registerService(
      'notification',
      new MockNotificationService({ latency: AppConfig.mock, currentUser: signedInUser }),
    );
    registerService('image', new MockImageService());
    const requests = new MockRequestService({
      history: new AsyncStorageMockRequestHistory(),
      currentCustomerId: signedInCustomerId,
    });
    registerService('request', requests);
    // Reads the same request table, as a backend checks a review against its own.
    // The vendor's side asks who is signed in and refuses anybody but a vendor.
    registerService(
      'review',
      new MockReviewService({
        requests,
        storage: new AsyncStorageMockReviewStorage(),
        currentCustomerId: signedInCustomerId,
        currentUser: signedInUser,
      }),
    );
    registerService('vendor', new MockVendorService());
    registerService(
      'vendorProfile',
      new MockVendorProfileService({
        latency: AppConfig.mock,
        storage: new AsyncStorageMockVendorProfiles(),
        currentUser: signedInUser,
      }),
    );
    // One record of who answered what, so the dashboard counts what the list changed.
    const vendorAnswers = new MockVendorRequestBook();
    registerService(
      'vendorDashboard',
      new MockVendorDashboardService({
        latency: AppConfig.mock,
        currentUser: signedInUser,
        book: vendorAnswers,
      }),
    );
    registerService(
      'vendorRequests',
      new MockVendorRequestService({
        latency: AppConfig.mock,
        currentUser: signedInUser,
        book: vendorAnswers,
      }),
    );
    registerService(
      'vendorTeam',
      new MockVendorTeamService({
        latency: AppConfig.mock,
        storage: new AsyncStorageMockVendorTeam(),
        currentUser: signedInUser,
      }),
    );
    // A fixture table per vendor and period: it counts nothing the other mocks hold.
    registerService(
      'vendorReports',
      new MockVendorReportService({
        latency: AppConfig.mock,
        currentUser: signedInUser,
      }),
    );
    registerService('profile', new MockProfileService({ latency: AppConfig.mock }));
    registerService('address', new MockAddressService());
    registerService(
      'addressBook',
      new MockAddressBookService({
        storage: new AsyncStorageMockSavedAddresses(),
        currentCustomerId: signedInCustomerId,
      }),
    );
    registerService('location', new MockLocationService());
    registerService('analytics', new MockAnalyticsService());
    registerService('crashReporter', new MockCrashReporter());
    log.info('Services configured', { mode: 'mock', count: registry.size });
    return;
  }

  // ApiService implementations land alongside the backend contracts. Until then
  // this branch is unreachable, and failing loudly beats silently using mocks
  // in a build that believes it is talking to a real API.
  throw new Error(
    'AppConfig.features.useMockServices is false but no ApiService implementations are registered.',
  );
}

/** Test helper. Allows a suite to substitute a stub for any service. */
export function resetServices(): void {
  registry.clear();
}
