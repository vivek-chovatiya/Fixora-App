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

export type AppEnvironment = 'development' | 'staging' | 'production';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

const environment: AppEnvironment = isDev ? 'development' : 'production';

/**
 * UI-first phase: every service resolves to its Mock implementation.
 * Flipping this to `false` once ApiService implementations exist is the
 * single switch that moves the app onto real HTTP.
 */
const useMockServices = true;

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
    /** Placeholder until backend contracts are finalized. */
    baseUrl: 'https://api.fixora.local',
    /** Milliseconds before an in-flight request is aborted. */
    timeoutMs: 30000,
    /** Retry attempts for idempotent requests that fail on transport errors. */
    maxRetries: 2,
  }),

  features: Object.freeze({
    useMockServices,
  }),

  storage: Object.freeze({
    /** Namespace for every persisted key, so clearing Fixora data is unambiguous. */
    keyPrefix: '@fixora',
    /** Holds the signed-in session. Read once at startup, written on sign in/out. */
    sessionKey: '@fixora/session',
  }),

  pagination: Object.freeze({
    defaultPageSize: 20,
    initialPage: 1,
  }),

  /**
   * Phone number limits, counted in digits after formatting is stripped.
   *
   * Deliberately a range rather than a country-specific pattern. `maxDigits` is
   * the E.164 ceiling, so a number entered with a country code still validates
   * and multi-country support needs no change here. `minDigits` is the shortest
   * national number accepted today.
   *
   * The backend remains the authority on whether a number is real or reachable;
   * this only stops an obviously incomplete entry reaching the network.
   */
  phone: Object.freeze({
    minDigits: 10,
    maxDigits: 15,
  }),

  /**
   * One-time code shape, for input length and local validation only.
   *
   * This is not a claim about how codes are generated. Whether a code is correct
   * or still valid is the backend's answer (PROJECT_BIBLE.md section 7A.4); this
   * exists so an obviously incomplete entry costs no network round trip.
   */
  otp: Object.freeze({
    length: 6,
  }),

  image: Object.freeze({
    maxSizeBytes: 5 * 1024 * 1024,
    maxUploadsPerRequest: 5,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
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

  /**
   * Mock service behaviour. Latency and failures are simulated so that the
   * loading, error and retry states required by the Definition of Done are
   * actually reachable during the UI-first phase.
   */
  mock: Object.freeze({
    minLatencyMs: 350,
    maxLatencyMs: 900,
    /** 0-1. Probability a mock call rejects, exercising error and retry paths. */
    failureRate: 0,
  }),
});

export type AppConfigType = typeof AppConfig;
