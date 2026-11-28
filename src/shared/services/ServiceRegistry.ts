/**
 * ServiceRegistry
 *
 * The single place that decides which implementation backs each service.
 *
 * Each backend service is switched on its own (Phase 4A, 17/11/2026): the Api
 * implementation when `AppConfig.services.live` names it, the mock otherwise.
 * Taking a service live is writing its Api implementation, adding it to
 * `API_SERVICES` below and naming its key in `AppConfig.services.live`.
 * Screens, hooks, components and navigation are unaffected, because they
 * resolve services through this registry and depend only on the interfaces.
 *
 * Add a new service by extending `ServiceMap` and registering it below.
 *
 * ⚠️ Some mocks read each other's tables, as a backend joins its own: the
 * review mock reads the request mock's, the vendor dashboard and request mocks
 * share one book of answers, and the request mock names a request from the
 * mock catalogue. When one side of such a pair goes live, the other must be
 * checked — a mock joining against a table the real backend no longer shares
 * refuses what the backend would accept.
 */

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { getSessionStorage } from '@/core/storage/SessionStorage';
import { ApiAuthService } from '@/shared/services/api/ApiAuthService';
import { ApiAddressBookService } from '@/shared/services/api/ApiAddressBookService';
import { ApiCategoryService } from '@/shared/services/api/ApiCategoryService';
import { ApiImageService } from '@/shared/services/api/ApiImageService';
import { ApiNotificationService } from '@/shared/services/api/ApiNotificationService';
import { ApiProfileService } from '@/shared/services/api/ApiProfileService';
import { ApiRequestService } from '@/shared/services/api/ApiRequestService';
import { ApiReviewService } from '@/shared/services/api/ApiReviewService';
import { ApiVendorService } from '@/shared/services/api/ApiVendorService';
import { ApiVendorDashboardService } from '@/shared/services/api/ApiVendorDashboardService';
import { ApiVendorProfileService } from '@/shared/services/api/ApiVendorProfileService';
import { ApiVendorReportService } from '@/shared/services/api/ApiVendorReportService';
import { ApiVendorRequestService } from '@/shared/services/api/ApiVendorRequestService';
import { ApiVendorTeamService } from '@/shared/services/api/ApiVendorTeamService';
import { DeviceNetworkStatusService } from '@/shared/services/device/DeviceNetworkStatusService';
import { DevicePermissionService } from '@/shared/services/device/DevicePermissionService';
import { FirebasePushService } from '@/shared/services/device/FirebasePushService';
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
import type { PushService } from '@/shared/services/types/PushService';
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
   * and 80), for either role — and pairing this device's push token with the
   * account (`registerDevice` / `unregisterDevice`, phase5-contract.md section
   * 6.1), which follows the live switch like the rest of it.
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
   * ⚠️ Registered as a mock below, outside the live switch, rather than beside
   * `permission` — unlike the device capability it looks like. Permissions have a real
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
   * ⚠️ Registered as a mock below for the reason `location` is: there is no
   * analytics provider in this project, so nothing real to register yet.
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
   * outside the live switch below. A camera permission does not become
   * real when the API does.
   */
  permission: PermissionService;
  /**
   * Whether the device is offline (PROJECT_BIBLE.md sections 49 and 57), for
   * the app-wide banner. Registered beside `permission` for the same reason:
   * the device's answer in every build. Reached through `useNetworkStatus`.
   */
  networkStatus: NetworkStatusService;
  /**
   * The device's push token and the messages it receives (phase5-contract.md
   * section 6, owner-approved 28/11/2026). The device's answer, registered
   * beside `permission`: Firebase on every build, and a build without
   * Firebase's config file answers "not available" and does nothing. Telling
   * the backend about the token is `notification`'s, which follows the live
   * switch like every backend call.
   */
  push: PushService;
}

export type ServiceKey = keyof ServiceMap;

/**
 * The services the backend answers, and so the ones `AppConfig.services.live`
 * may name. The rest are the device's (`permission`, `networkStatus`, `push`) or a
 * provider's (`location`, `analytics`, `crashReporter`): going live with the
 * API changes none of their answers.
 */
export type BackendServiceKey = Exclude<
  ServiceKey,
  'permission' | 'networkStatus' | 'push' | 'location' | 'analytics' | 'crashReporter'
>;

/**
 * Every Api implementation that exists. A live key missing here stops startup
 * rather than falling back to its mock.
 */
const API_SERVICES: { readonly [K in BackendServiceKey]?: () => ServiceMap[K] } = {
  auth: () => new ApiAuthService(),
  category: () => new ApiCategoryService(),
  // The customer's side (17/11/2026). Each asks the session who is signed in,
  // as the mocks did, to send only that account's own id and to refuse a record
  // the backend hands back for somebody else.
  vendor: () => new ApiVendorService(),
  request: () => new ApiRequestService({ currentCustomerId: signedInCustomerId }),
  review: () => new ApiReviewService({ currentUser: signedInUser }),
  profile: () => new ApiProfileService({ currentUser: signedInUser }),
  notification: () => new ApiNotificationService(),
  // Saves only what the app holds: no state, and no made-up town or PIN code.
  addressBook: () => new ApiAddressBookService(),
  // The vendor's side (17/11/2026). Each asks the session who is signed in and
  // refuses anybody but a vendor; the request list and the dashboard read the
  // same `/requests/list` through `vendorWork.ts`, so they move together.
  vendorRequests: () => new ApiVendorRequestService({ currentUser: signedInUser }),
  vendorDashboard: () => new ApiVendorDashboardService({ currentUser: signedInUser }),
  vendorTeam: () => new ApiVendorTeamService({ currentUser: signedInUser }),
  vendorProfile: () => new ApiVendorProfileService({ currentUser: signedInUser }),
  // No report endpoint: period reports refuse; today's requests is counted from the list.
  vendorReports: () => new ApiVendorReportService({ currentUser: signedInUser }),
  // The phone's camera and library, and `/uploads` (Phase 4B). The camera is
  // asked for through the device's permissions, read when it is wanted.
  image: () => new ApiImageService({ permissions: () => getService('permission') }),
};

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

export interface ConfigureServicesOptions {
  /**
   * The backend services to register live. `AppConfig.services.live` when
   * absent, which is what the app always uses; a test passes its own.
   */
  live?: readonly BackendServiceKey[];
}

/**
 * Wires every service. Called once from the app root before render.
 */
export function configureServices(options: ConfigureServicesOptions = {}): void {
  registry.clear();

  const live: ReadonlySet<BackendServiceKey> = new Set(options.live ?? AppConfig.services.live);

  /** The Api implementation when the key is live, the mock otherwise. */
  function registerBackend<K extends BackendServiceKey>(key: K, mock: () => ServiceMap[K]): void {
    if (!live.has(key)) {
      registerService(key, mock());
      return;
    }

    const api = API_SERVICES[key];
    if (!api) {
      // Failing loudly beats a build that believes it is live quietly running a mock.
      throw new Error(
        `AppConfig.services.live names "${key}", which has no Api implementation yet.`,
      );
    }
    registerService(key, api());
  }

  // Outside the switch on purpose. Everything registered through
  // `registerBackend` is a backend service and follows `AppConfig.services.live`;
  // permissions are the device's answer either way, and a mock one would prompt
  // nobody.
  registerService('permission', new DevicePermissionService());
  // Connectivity is the device's answer too: a mock backend still runs on a
  // phone that can lose its signal.
  registerService('networkStatus', new DeviceNetworkStatusService());
  // The phone's push token is the device's too. Nothing is loaded here: the
  // service looks for Firebase on first use, and off is its normal answer.
  registerService('push', new FirebasePushService());

  registerBackend('auth', () => new MockAuthService());
  registerBackend('category', () => new MockCategoryService());
  // Each account's own inbox, by whoever is signed in — either role has one.
  registerBackend(
    'notification',
    () => new MockNotificationService({ latency: AppConfig.mock, currentUser: signedInUser }),
  );
  registerBackend('image', () => new MockImageService());
  const requests = new MockRequestService({
    history: new AsyncStorageMockRequestHistory(),
    currentCustomerId: signedInCustomerId,
  });
  // ⚠️ Names each new request from the mock catalogue (`findMockServiceNames`),
  // so it refuses the backend's ids: with `category` live, `request` must be
  // live too (WORKING_NOTES section 5, "Connecting to the backend").
  registerBackend('request', () => requests);
  // Reads the same request table, as a backend checks a review against its own.
  // The vendor's side asks who is signed in and refuses anybody but a vendor.
  // ⚠️ Goes live with `request`, or it reviews requests the backend never had.
  registerBackend(
    'review',
    () =>
      new MockReviewService({
        requests,
        storage: new AsyncStorageMockReviewStorage(),
        currentCustomerId: signedInCustomerId,
        currentUser: signedInUser,
      }),
  );
  registerBackend('vendor', () => new MockVendorService());
  registerBackend(
    'vendorProfile',
    () =>
      new MockVendorProfileService({
        latency: AppConfig.mock,
        storage: new AsyncStorageMockVendorProfiles(),
        currentUser: signedInUser,
      }),
  );
  // One record of who answered what, so the dashboard counts what the list changed.
  const vendorAnswers = new MockVendorRequestBook();
  registerBackend(
    'vendorDashboard',
    () =>
      new MockVendorDashboardService({
        latency: AppConfig.mock,
        currentUser: signedInUser,
        book: vendorAnswers,
      }),
  );
  registerBackend(
    'vendorRequests',
    () =>
      new MockVendorRequestService({
        latency: AppConfig.mock,
        currentUser: signedInUser,
        book: vendorAnswers,
      }),
  );
  registerBackend(
    'vendorTeam',
    () =>
      new MockVendorTeamService({
        latency: AppConfig.mock,
        storage: new AsyncStorageMockVendorTeam(),
        currentUser: signedInUser,
      }),
  );
  // A fixture table per vendor and period: it counts nothing the other mocks hold.
  registerBackend(
    'vendorReports',
    () =>
      new MockVendorReportService({
        latency: AppConfig.mock,
        currentUser: signedInUser,
      }),
  );
  registerBackend('profile', () => new MockProfileService({ latency: AppConfig.mock }));
  registerBackend('address', () => new MockAddressService());
  registerBackend(
    'addressBook',
    () =>
      new MockAddressBookService({
        storage: new AsyncStorageMockSavedAddresses(),
        currentCustomerId: signedInCustomerId,
      }),
  );

  // Not backend services, so outside the switch: nothing real exists for any of
  // them yet, and the API going live changes none of their answers.
  registerService('location', new MockLocationService());
  registerService('analytics', new MockAnalyticsService());
  registerService('crashReporter', new MockCrashReporter());

  log.info('Services configured', { live: [...live], count: registry.size });
}

/** Test helper. Allows a suite to substitute a stub for any service. */
export function resetServices(): void {
  registry.clear();
}
