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
import { DevicePermissionService } from '@/shared/services/device/DevicePermissionService';
import { MockAuthService } from '@/shared/services/mock/MockAuthService';
import { MockCategoryService } from '@/shared/services/mock/MockCategoryService';
import { MockImageService } from '@/shared/services/mock/MockImageService';
import { MockNotificationService } from '@/shared/services/mock/MockNotificationService';
import type { AuthService } from '@/shared/services/types/AuthService';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type { ImageService } from '@/shared/services/types/ImageService';
import type { NotificationService } from '@/shared/services/types/NotificationService';
import type { PermissionService } from '@/shared/services/types/PermissionService';

const log = createLogger('ServiceRegistry');

export interface ServiceMap {
  auth: AuthService;
  category: CategoryService;
  notification: NotificationService;
  image: ImageService;
  /**
   * Device capability rather than a backend one, which is why it is registered
   * outside the mock/live switch below. A camera permission does not become
   * real when the API does.
   */
  permission: PermissionService;
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

  if (AppConfig.features.useMockServices) {
    registerService('auth', new MockAuthService());
    registerService('category', new MockCategoryService());
    registerService('notification', new MockNotificationService());
    registerService('image', new MockImageService());
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
