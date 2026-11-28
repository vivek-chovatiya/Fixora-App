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
 * The backend services that talk to the real API (Phase 4A, 17/11/2026). Every
 * backend service not named here runs on its mock, so the phone app keeps
 * working while services are connected one at a time.
 *
 * This replaced the single all-or-nothing `useMockServices` switch. Flipping a
 * service is adding or removing its key here and nothing else: `ServiceRegistry`
 * registers the Api implementation for a named key and the mock for the rest,
 * and refuses at startup a key that has no Api implementation yet — failing
 * loudly beats a build that believes it is live quietly running a mock. A typo
 * is a type error there, not a silent mock.
 *
 * ⚠️ `auth` and `category` move together. Vendor registration sends the ids of
 * the categories it listed, and the real backend accepts only ids it issued; a
 * live `auth` beside a mock `category` would register every vendor with ids the
 * server rejects.
 *
 * ⚠️ `category`, `vendor`, `request` and `review` move together too. The
 * request mock names a request from the mock catalogue and the vendor mock is
 * keyed by mock service ids, so both refuse the backend's ids; the review mock
 * reviews the request mock's table, so it would review requests the backend
 * never had.
 *
 * `addressBook` saves to the backend since `state` became optional there; an
 * address with no town or PIN code is still refused, never filled in
 * (`ApiAddressBookService`).
 *
 * ⚠️ `vendorRequests` and `vendorDashboard` move together: both read the
 * vendor's `/requests/list` through `vendorWork.ts`, and their mocks share one
 * book of answers — one of each would count work the other does not show.
 * `vendorProfile` and `vendorTeam` stand alone. `vendorReports` goes with
 * the backend too: the period reports and the dashboard's Today's requests are
 * both the backend's `/vendors/report` (`ApiVendorReportService`, Phase 4B).
 * Off, it is the mock's fixture figures — which a real vendor must never see
 * beside live work.
 *
 * ⚠️ `image` goes with every service that keeps a picture — `request`,
 * `profile`, `vendorProfile` and `vendorTeam` (Phase 4B, 24/11/2026). It takes
 * photos with the phone's camera and library and uploads them to `/uploads`,
 * and the backend attaches only a picture it stored itself (contract §2): the
 * mock's placeholder URLs are refused by each of those live, as 400 on the
 * picture's field.
 *
 * ⚠️ The web views (`App.web.tsx`) do not read this: they call `FixoraApiClient`
 * directly, against `api.baseUrl` below.
 */
const liveServices = Object.freeze([
  'auth',
  'category',
  'vendor',
  'request',
  'review',
  'profile',
  'notification',
  'addressBook',
  'vendorRequests',
  'vendorDashboard',
  'vendorTeam',
  'vendorProfile',
  'vendorReports',
  'image',
] as const);

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
    /**
     * Backend API endpoint.
     *
     * `localhost` on the phone is the phone, so a device or emulator reaches the
     * development backend on this machine through `adb reverse tcp:5000
     * tcp:5000` (WORKING_NOTES section 5) — the same way it reaches Metro.
     * Plain HTTP is allowed in debug builds only: the React Native Gradle plugin
     * sets `usesCleartextTraffic` true for debug and false for release.
     *
     * ⚠️ There is no deployed backend yet, so a release build points here too
     * and cannot reach it (release builds refuse cleartext as well). The production
     * address belongs here, per environment, the day one exists.
     */
    baseUrl: 'http://localhost:5000/api/v1',
    /** Milliseconds before an in-flight request is aborted. */
    timeoutMs: 30000,
    /**
     * The same, for a file upload alone (`Http.postForm`): a 5 MB photo on slow
     * mobile data outlasts 30 s, and a timed-out upload's retry starts from zero.
     */
    uploadTimeoutMs: 120000,
    /** Retry attempts for idempotent requests that fail on transport errors. */
    maxRetries: 2,
    /**
     * Page size for reading a whole short list in one go — the service
     * catalogue. The backend's own ceiling for one page (`getPagination` caps
     * `limit` at 100), so a catalogue normally arrives in a single request.
     */
    fullListPageSize: 100,
    /**
     * Most pages one such read will follow before it stops and shows what it
     * has. A guard against a server that always says there is more, not an
     * expected limit: ten pages is a thousand categories.
     */
    fullListMaxPages: 10,
  }),

  services: Object.freeze({
    live: liveServices,
  }),

  /**
   * Push notifications (phase5-contract.md section 6, owner-approved
   * 28/11/2026). Whether push is on is not configured here: it is on when the
   * build carries Firebase's config file, and `FirebasePushService` finds that
   * out for itself.
   */
  push: Object.freeze({
    /**
     * Longest a sign-out waits for this device to be unregistered before it
     * carries on to `/auth/logout` without it. Signing out must never be held
     * hostage by a slow network: the person asked to leave, and a token left
     * registered is moved by the next account that signs in on this phone.
     */
    unregisterTimeoutMs: 5000,
  }),

  /** The app's language (phase5-contract.md section 7). */
  locale: Object.freeze({
    /**
     * Longest the start of the app waits for the saved language to be read.
     * Nothing is drawn until it is (`AppRoot`), so a read that never answers
     * would leave a blank screen for ever; past this the app starts in English
     * with the chooser, exactly as on a first launch. A device read normally
     * answers in a few milliseconds, so this only ever ends a stuck one.
     */
    restoreTimeoutMs: 1500,
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
     * The language chosen on this device — `en`, `hi` or `gu` (phase5-contract.md
     * section 7). Its own key, like onboarding's: signing out does not forget it,
     * and nobody should have to choose their language again to sign back in.
     */
    localeKey: '@fixora/locale',
    /**
     * The phone number of the last vendor to sign in on this device, so the
     * next vendor sign in only has to ask for a code to be sent to it.
     *
     * ⚠️ The phone and nothing else — never a one-time code, which must not be
     * persisted (PROJECT_BIBLE.md section 7A). Separate from the session because
     * it outlives it: signing out keeps it, which is the point of it.
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
     * Records that this device has asked for permission to show notifications —
     * from onboarding or after a sign in — so it is asked once and a refusal is
     * never met with a second dialog (phase5-contract.md section 6.3). Device-wide
     * and outliving the session, like onboarding's: signing out and back in is
     * not a reason to ask again.
     */
    notificationPermissionAskedKey: '@fixora/notification-permission-asked',
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
     * Keys whose values Logger must never emit, so a credential or a code never
     * reaches logs or crash reports. `authCode` and `vendorCode` outlived the
     * vendor auth code (retired 28/11/2026) on purpose: a stale field from an
     * old backend response must still be masked if one is ever logged.
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
