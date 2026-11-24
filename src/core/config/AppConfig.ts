/**
 * AppConfig
 *
 * The ONLY configuration entry point in the application.
 *
 * Rules:
 * - Never read process.env, __DEV__ or any platform config outside this file.
 * - Never hardcode a URL, timeout, page size or limit anywhere else.
 * - Every value is readonly; configuration is never mutated at runtime.
 *
 * When environment-specific builds are introduced, only this file changes.
 */

import { Platform } from 'react-native';

export type AppEnvironment = 'development' | 'staging' | 'production';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

const environment: AppEnvironment = isDev ? 'development' : 'production';

/**
 * Backend host. The Android emulator reaches the host machine through 10.0.2.2;
 * iOS simulator and web use localhost. For a physical device, set this to the
 * development machine's LAN IP (e.g. http://192.168.1.20:5000).
 */
const DEV_API_HOST = Platform.select({
  // Physical device over USB: run `adb reverse tcp:5000 tcp:5000`, then localhost
  // reaches the dev machine. For the emulator, use 'http://10.0.2.2:5000'.
  android: 'http://localhost:5000',
  default: 'http://localhost:5000',
});

const PROD_API_HOST = 'https://api.fixora.app';

const apiHost = isDev ? DEV_API_HOST : PROD_API_HOST;

export const AppConfig = Object.freeze({
  environment,
  isDevelopment: environment === 'development',

  app: Object.freeze({
    name: 'Fixora',
    /** Reserved for future multi-language support. */
    defaultLocale: 'en',
    /** Reserved for future multi-country support. */
    defaultCountry: 'IN',
  }),

  api: Object.freeze({
    /** Backend API endpoint */
    baseUrl: `${apiHost}/api/v1`,
    /** Uploaded files are returned as server paths (/uploads/...) and resolved against this. */
    fileBaseUrl: apiHost,
    /** Milliseconds before an in-flight request is aborted. */
    timeoutMs: 30000,
    /** Retry attempts for idempotent requests that fail on transport errors. */
    maxRetries: 2,
  }),

  storage: Object.freeze({
    sessionKey: '@fixora/session',
  }),

  support: Object.freeze({
    phone: '+91 90000 00001',
    email: 'support@fixora.app',
  }),

  pagination: Object.freeze({
    defaultPageSize: 20,
    initialPage: 1,
  }),

  image: Object.freeze({
    maxSizeBytes: 5 * 1024 * 1024,
    maxUploadsPerRequest: 5,
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const,
    /** Longest edge, in pixels, after compression. */
    maxDimension: 1600,
    /** 0-1. Applied by ImageService, never by a screen. */
    compressionQuality: 0.7,
  }),

  logging: Object.freeze({
    level: (isDev ? 'debug' : 'error') as LogLevel,
    /**
     * Keys whose values Logger must never emit. The vendor auth code is a
     * standing credential, so it must not reach logs or crash reports.
     */
    redactedKeys: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'authCode',
      'vendorCode',
      'otp',
      'authorization',
    ] as const,
  }),
});

export type AppConfigType = typeof AppConfig;
