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
 *
 * ⚠️ Kept `true` on purpose when the web views were merged in (17/11/2026).
 * No service has an Api implementation yet, so `false` registers nothing and
 * every phone screen fails on its first read. The web views (`App.web.tsx`)
 * do not read this switch: they call `FixoraApiClient` directly, against
 * `api.baseUrl` below.
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
    /** Backend API endpoint */
    baseUrl: 'http://localhost:5000/api/v1',
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
    /**
     * Records that onboarding has been seen. Deliberately separate from the
     * session: signing out does not make someone a first-time user again, and
     * clearing one must not clear the other.
     */
    onboardingKey: '@fixora/onboarding',
    /**
     * The phone number of the last vendor to sign in on this device, so the
     * next vendor sign in asks for the auth code alone.
     *
     * ⚠️ The phone and nothing else — never the auth code, which is a standing
     * credential that must not be persisted (PROJECT_BIBLE.md section 7A.2).
     * Separate from the session because it outlives it: signing out keeps it,
     * which is the point of it.
     */
    rememberedVendorKey: '@fixora/remembered-vendor',
    /**
     * The request a customer started and has not sent yet.
     *
     * Separate from the session for the same reason onboarding is: they answer
     * different questions and have different lifetimes. It holds no credential
     * and no personal record — only what was typed into one unfinished form.
     */
    requestDraftKey: '@fixora/request-draft',
    /**
     * Requests the mock backend accepted, one key per customer beneath this
     * prefix, so they survive a restart until a real backend holds them.
     *
     * ⚠️ Mock-only, and separate from the draft for good reason: a draft is a
     * form still being filled in and is cleared when it is sent; this is what it
     * became. The key and everything under it go when the mock does.
     */
    mockRequestHistoryKey: '@fixora/mock-request-history',
    /**
     * Reviews the mock backend accepted (PROJECT_BIBLE.md section 24), one key
     * per customer beneath this prefix.
     *
     * ⚠️ Mock-only, and its own key rather than a field on the request history:
     * a review belongs to the review domain and never changes the request. It
     * survives a restart because the requests it is about do — a review that
     * vanished while its request stayed would offer a second one, which section
     * 24 forbids. The key goes when the mock does.
     */
    mockRequestReviewKey: '@fixora/mock-request-reviews',
    /**
     * A customer's saved addresses, one key per customer beneath this prefix
     * (PROJECT_BIBLE.md section 18, Phase 3D-9).
     *
     * ⚠️ Mock-only, and its own key for the same reason the reviews have one: an
     * address book outlives every request. The draft is one unfinished form and
     * is cleared when it is sent; this is a customer's own record and, unlike
     * the draft, survives logging out.
     */
    mockSavedAddressKey: '@fixora/mock-saved-addresses',
    /**
     * A vendor's business profile, one key per vendor beneath this prefix
     * (PROJECT_BIBLE.md section 38, Phase 3E-1).
     *
     * ⚠️ Mock-only. Business fields only — the owner's name and contact details
     * stay in the session. Survives logging out, as a vendor's own record.
     */
    mockVendorProfileKey: '@fixora/mock-vendor-profiles',
    /**
     * A vendor's team, one key per vendor beneath this prefix
     * (PROJECT_BIBLE.md section 39, Phase 3E-7).
     *
     * ⚠️ Mock-only, and its own key: the team is not part of the business
     * profile and is read and written apart from it. Survives logging out, as a
     * vendor's own record.
     */
    mockVendorTeamKey: '@fixora/mock-vendor-team',
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
    /**
     * The dialling code shown beside the phone field.
     *
     * ⚠️ Display only. It is not prepended to what the user types and it does
     * not reach the backend — `normalisePhone` still sends the digits entered
     * and nothing else, so this changes no contract. It says which country the
     * app serves, which on a single-country product is the whole of the truth.
     *
     * Choosing a different one is multi-country, which PROJECT_BIBLE.md lists
     * as a future phase and says explicitly not to implement prematurely. When
     * that phase arrives this becomes a default rather than a constant.
     */
    dialCode: '+91',
  }),

  /**
   * Money (PROJECT_BIBLE.md sections 36 and 37: the offline payment record).
   *
   * The one currency the app records amounts in, as an ISO 4217 code — never a
   * symbol; how it is written is `shared/presentation/money`'s. Every amount
   * leaving the app carries this code beside it, so a backend never has to
   * assume one. A single value for the reason `dialCode` is one: choosing
   * another currency is multi-country, a future phase, and when it comes this
   * becomes a default rather than a constant.
   */
  money: Object.freeze({
    currency: 'INR',
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

  /**
   * The vendor's permanent auth code (PROJECT_BIBLE.md section 7A.2): exactly
   * this many digits, always handled as a string so a leading zero survives.
   *
   * The one place the length is written. Validation, the input's ceiling, the
   * copy that names the length and the mock's generator all read it from here,
   * so the day the backend issues a different length this is the only edit.
   *
   * ⚠️ Shape only, like `otp`. The backend generates the code and is the only
   * judge of whether one is right (section 7A.4); this stops an entry that
   * cannot be a code from costing a round trip.
   */
  vendorAuthCode: Object.freeze({
    length: 6,
  }),

  image: Object.freeze({
    maxSizeBytes: 5 * 1024 * 1024,
    maxUploadsPerRequest: 5,
    /**
     * Most shop images a vendor keeps on their profile (PROJECT_BIBLE.md
     * section 38). The app's ceiling, not the backend's — section 38 sets none
     * — enforced by the Shop images screen and re-checked by the mock service.
     * Size, type and compression are the rules above, unchanged.
     */
    maxShopImagesPerVendor: 6,
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
