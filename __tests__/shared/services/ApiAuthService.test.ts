/**
 * ApiAuthService is the shared sign-in contract of 17/11/2026, as amended by
 * phase5-contract.md sections 1 and 2 (28/11/2026), from the app's side, so
 * these tests pin the contract rather than the code:
 *
 * - each method's exact path, method and body — the key set, not just the
 *   values, so a field added by accident fails here before the backend's Joi
 *   strips it in silence;
 * - each response read into the app's own types, with nothing the backend adds
 *   (`_id`, the top-level role, `isNewAccount`) getting through;
 * - every error code the contract lists, read as the kind and copy the screens
 *   were built against;
 * - vendors by one-time code only: the retired auth-code routes
 *   (`/auth/vendor/signin`, `/auth/vendor/auth-code/*`,
 *   `/vendors/auth-code/regenerate`) are never called, and no method for them
 *   is left;
 * - every challenge's `deliveryChannel`, read leniently — `WHATSAPP` or `NONE`;
 * - a one-time code in no error and no log, and a refused one never mistaken
 *   for a dead session;
 * - the session's picture read through `toImageUrl` (Phase 4B, 24/11/2026): a
 *   stored `/uploads/...` path becomes an address this phone can load.
 *
 * The backend is a fake axios adapter on the real HttpClient: no network.
 */

import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { AppConfig } from '@/core/config/AppConfig';
import { httpClient, setTokenProvider, setUnauthorizedHandler } from '@/core/http/HttpClient';
import { ApiAuthService } from '@/shared/services/api/ApiAuthService';
import { AppError } from '@/shared/types/error';

interface Reply {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

const sent: InternalAxiosRequestConfig[] = [];
const originalAdapter = httpClient.defaults.adapter;

/** Answers every request with `reply`, recording what was sent. */
function backendAnswers(reply: Reply): void {
  const adapter: AxiosAdapter = async config => {
    sent.push(config);
    const response: AxiosResponse = {
      data: reply.body,
      status: reply.status,
      statusText: '',
      headers: reply.headers ?? {},
      config,
    };
    if (reply.status >= 400) {
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
    }
    return response;
  };
  httpClient.defaults.adapter = adapter;
}

function succeeds(data: unknown): Reply {
  return { status: 200, body: { success: true, message: 'Done.', data, meta: {}, errors: null } };
}

function fails(status: number, code: string): Reply {
  return {
    status,
    body: { success: false, message: `English for ${code}`, code, errors: null, data: null },
  };
}

/** The one request the call made: its method, path and parsed body. */
function onlyRequest(): { method?: string; url?: string; body: Record<string, unknown> } {
  expect(sent).toHaveLength(1);
  const [config] = sent;
  return { method: config.method, url: config.url, body: JSON.parse(config.data as string) };
}

async function rejectionOf(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    expect(caught).toBeInstanceOf(AppError);
    return caught as AppError;
  }
  throw new Error('Expected the call to reject');
}

const CHALLENGE = {
  maskedDestination: '••••••3210',
  expiresAt: '2026-11-17T10:05:00.000Z',
  resendAfterSeconds: 30,
  deliveryChannel: 'NONE',
};

const CUSTOMER_SESSION = {
  token: 'jwt-customer',
  role: 'CUSTOMER',
  isNewAccount: false,
  user: {
    id: '6aec5e3ad1f333d4534faf10',
    _id: '6aec5e3ad1f333d4534faf10',
    firstName: 'Asha',
    lastName: 'Patel',
    email: null,
    phone: '9876543210',
    avatarUrl: null,
    role: 'customer',
    status: 'ACTIVE',
  },
};

const VENDOR_SESSION = {
  token: 'jwt-vendor',
  role: 'VENDOR',
  user: {
    id: '6aec5e3ad1f333d4534faf20',
    firstName: 'Ravi',
    lastName: 'Kumar',
    email: 'ravi@example.com',
    phone: '9000000001',
    avatarUrl: 'https://cdn.example.com/ravi.jpg',
    role: 'vendor',
  },
};

/** A typed one-time code distinct from every other digit run in these fixtures. */
const TYPED_CODE = '482913';
const REGISTRATION_ID = 'reg_6aec5e3ad1f333d4534faf30';

let service: ApiAuthService;
let consoleCalls: unknown[][] = [];
const onUnauthorized = jest.fn();

beforeEach(() => {
  sent.length = 0;
  consoleCalls = [];
  for (const method of ['log', 'warn', 'error'] as const) {
    jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      consoleCalls.push(args);
    });
  }
  setTokenProvider(() => null);
  setUnauthorizedHandler(onUnauthorized);
  service = new ApiAuthService();
});

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  setTokenProvider(() => null);
  setUnauthorizedHandler(() => {});
  onUnauthorized.mockReset();
  jest.restoreAllMocks();
});

describe('what each method sends', () => {
  const cases: [string, () => Promise<unknown>, unknown, string, Record<string, unknown>][] = [
    [
      'requestCustomerOtp',
      () => service.requestCustomerOtp('98765 43210'),
      CHALLENGE,
      '/auth/customer/otp/request',
      { phone: '9876543210' },
    ],
    [
      'verifyCustomerOtp',
      () => service.verifyCustomerOtp('+91 98765-43210', '123456'),
      CUSTOMER_SESSION,
      '/auth/customer/otp/verify',
      { phone: '919876543210', code: '123456' },
    ],
    [
      'requestVendorOtp',
      () => service.requestVendorOtp(REGISTRATION_ID),
      CHALLENGE,
      '/auth/vendor/otp/request',
      { registrationId: REGISTRATION_ID },
    ],
    [
      'verifyVendorOtp',
      () => service.verifyVendorOtp(REGISTRATION_ID, ' 123456 '),
      VENDOR_SESSION,
      '/auth/vendor/otp/verify',
      { registrationId: REGISTRATION_ID, code: '123456' },
    ],
    [
      'requestVendorSignInOtp',
      () => service.requestVendorSignInOtp('90000 00001'),
      CHALLENGE,
      '/auth/vendor/signin/otp/request',
      { phone: '9000000001' },
    ],
    [
      'verifyVendorSignInOtp',
      () => service.verifyVendorSignInOtp('90000-00001', ' 123456 '),
      VENDOR_SESSION,
      '/auth/vendor/signin/otp/verify',
      { phone: '9000000001', code: '123456' },
    ],
    ['signOut', () => service.signOut(), null, '/auth/logout', {}],
  ];

  it.each(cases)('%s posts exactly its contract body', async (_name, call, data, url, body) => {
    backendAnswers(succeeds(data));

    await call();

    const request = onlyRequest();
    expect(request.method).toBe('post');
    expect(request.url).toBe(url);
    expect(Object.keys(request.body).sort()).toEqual(Object.keys(body).sort());
    expect(request.body).toEqual(body);
  });

  describe('registerVendor', () => {
    const DETAILS = {
      businessName: 'Kumar Electricals',
      ownerFirstName: 'Ravi',
      ownerLastName: 'Kumar',
      phone: '90000 00001',
      serviceCategoryIds: ['6aec5e3ad1f333d4534faf51', '6aec5e3ad1f333d4534faf52'],
    };
    const REGISTRATION = { registrationId: REGISTRATION_ID, challenge: CHALLENGE };

    it('posts the contract body, with the phone normalised', async () => {
      backendAnswers(succeeds(REGISTRATION));

      await service.registerVendor({ ...DETAILS, email: 'ravi@example.com' });

      const request = onlyRequest();
      expect(request.url).toBe('/auth/vendor/register');
      expect(Object.keys(request.body).sort()).toEqual(
        ['businessName', 'email', 'ownerFirstName', 'ownerLastName', 'phone', 'serviceCategoryIds'],
      );
      expect(request.body).toEqual({ ...DETAILS, phone: '9000000001', email: 'ravi@example.com' });
    });

    it.each([
      ['undefined', undefined],
      ['blank', '  '],
    ])('leaves an email that is %s out entirely', async (_case, email) => {
      backendAnswers(succeeds(REGISTRATION));

      await service.registerVendor({ ...DETAILS, email });

      expect(onlyRequest().body).not.toHaveProperty('email');
    });

    it('answers with the registration handle and its challenge', async () => {
      backendAnswers(succeeds({ ...REGISTRATION, _id: 'leak', vendorId: 'leak' }));

      await expect(service.registerVendor(DETAILS)).resolves.toEqual(REGISTRATION);
    });
  });

  it('never calls a retired auth-code route, from any method', async () => {
    backendAnswers(succeeds(VENDOR_SESSION));
    const calls: (() => Promise<unknown>)[] = [
      () => service.verifyVendorOtp(REGISTRATION_ID, '123456'),
      () => service.verifyVendorSignInOtp('9000000001', '123456'),
    ];
    for (const call of calls) {
      await call();
    }
    backendAnswers(succeeds(CHALLENGE));
    await service.requestVendorSignInOtp('9000000001');
    await service.requestVendorOtp(REGISTRATION_ID);
    await service.requestCustomerOtp('9876543210');

    const urls = sent.map(config => config.url);
    expect(urls).toHaveLength(5);
    for (const url of urls) {
      expect(url).not.toMatch(/auth-code/);
      expect(url).not.toBe('/auth/vendor/signin');
    }
    // No body carries an auth code under any name.
    expect(sent.map(config => String(config.data)).join(' ')).not.toMatch(/authCode/);
  });

  it('has no method left for the retired auth code', () => {
    const methods = service as unknown as Record<string, unknown>;

    for (const retired of ['verifyVendorAuthCode', 'regenerateVendorAuthCode', 'signInVendor']) {
      expect(methods[retired]).toBeUndefined();
    }
  });

  it('signs out with the session’s bearer token', async () => {
    setTokenProvider(() => 'jwt-customer');
    backendAnswers(succeeds(null));

    await expect(service.signOut()).resolves.toBeUndefined();

    expect(sent[0].headers.Authorization).toBe('Bearer jwt-customer');
  });
});

describe('what each method answers with', () => {
  it('reads a challenge field by field', async () => {
    backendAnswers(succeeds({ ...CHALLENGE, code: '123456', _id: 'x' }));

    const challenge = await service.requestCustomerOtp('9876543210');

    expect(challenge).toEqual(CHALLENGE);
    expect(Object.keys(challenge).sort()).toEqual(
      ['deliveryChannel', 'expiresAt', 'maskedDestination', 'resendAfterSeconds'],
    );
  });

  it.each([
    ['requestCustomerOtp', () => service.requestCustomerOtp('9876543210')],
    ['requestVendorSignInOtp', () => service.requestVendorSignInOtp('9000000001')],
    ['requestVendorOtp', () => service.requestVendorOtp(REGISTRATION_ID)],
  ])('%s reads a code sent on WhatsApp as WHATSAPP', async (_name, call) => {
    backendAnswers(succeeds({ ...CHALLENGE, deliveryChannel: 'WHATSAPP' }));

    await expect(call()).resolves.toEqual({ ...CHALLENGE, deliveryChannel: 'WHATSAPP' });
  });

  it('reads the registration challenge’s channel too', async () => {
    backendAnswers(
      succeeds({
        registrationId: REGISTRATION_ID,
        challenge: { ...CHALLENGE, deliveryChannel: 'WHATSAPP' },
      }),
    );

    const registration = await service.registerVendor({
      businessName: 'B',
      ownerFirstName: 'F',
      ownerLastName: 'L',
      phone: '9000000001',
      serviceCategoryIds: ['c'],
    });

    expect(registration.challenge.deliveryChannel).toBe('WHATSAPP');
  });

  it.each([
    ['missing (a backend not yet on the contract)', undefined],
    ['NONE', 'NONE'],
    ['a channel the app does not know', 'SMS'],
    ['the right word in the wrong case', 'whatsapp'],
    ['not a string', 1],
    ['null', null],
  ])('reads a channel that is %s as NONE, and still answers', async (_case, deliveryChannel) => {
    backendAnswers(succeeds({ ...CHALLENGE, deliveryChannel }));

    const challenge = await service.requestVendorSignInOtp('9000000001');

    expect(challenge.deliveryChannel).toBe('NONE');
  });

  it('reads a customer session as the app’s, with nothing else getting through', async () => {
    backendAnswers(succeeds(CUSTOMER_SESSION));

    const session = await service.verifyCustomerOtp('9876543210', '123456');

    expect(session).toEqual({
      token: 'jwt-customer',
      user: {
        id: '6aec5e3ad1f333d4534faf10',
        firstName: 'Asha',
        lastName: 'Patel',
        phone: '9876543210',
        role: 'customer',
      },
    });
    // Absent — not null, not undefined — so a stored session holds no empty keys.
    expect(session.user).not.toHaveProperty('email');
    expect(session.user).not.toHaveProperty('avatarUrl');
    expect(JSON.stringify(session)).not.toContain('_id');
    expect(session).not.toHaveProperty('isNewAccount');
    expect(session).not.toHaveProperty('role');
  });

  it('keeps a vendor’s email and picture when they are there', async () => {
    backendAnswers(succeeds(VENDOR_SESSION));

    const session = await service.verifyVendorSignInOtp('9000000001', '123456');

    expect(session).toEqual({ token: 'jwt-vendor', user: VENDOR_SESSION.user });
  });

  it('puts a stored picture path on the API’s own origin', async () => {
    const path = '/uploads/profile/0123456789abcdef0123456789abcdef.jpg';
    backendAnswers(succeeds({ ...VENDOR_SESSION, user: { ...VENDOR_SESSION.user, avatarUrl: path } }));

    const session = await service.verifyVendorSignInOtp('9000000001', '123456');

    expect(session.user.avatarUrl).toBe(`${AppConfig.api.baseUrl.replace(/\/api\/v1\/?$/, '')}${path}`);
  });

  it('reads a picture that is neither a path nor a URL as none', async () => {
    backendAnswers(succeeds({ ...VENDOR_SESSION, user: { ...VENDOR_SESSION.user, avatarUrl: 'ravi.jpg' } }));

    const session = await service.verifyVendorSignInOtp('9000000001', '123456');

    expect(session.user).not.toHaveProperty('avatarUrl');
  });

  it('accepts a brand-new customer with no name yet', async () => {
    const user = { ...CUSTOMER_SESSION.user, firstName: '', lastName: undefined };
    backendAnswers(succeeds({ ...CUSTOMER_SESSION, isNewAccount: true, user }));

    const session = await service.verifyCustomerOtp('9876543210', '123456');

    expect(session.user.firstName).toBe('');
    expect(session.user.lastName).toBe('');
  });

  it('falls back to the top-level role when the user carries none', async () => {
    backendAnswers(succeeds({ ...VENDOR_SESSION, user: { ...VENDOR_SESSION.user, role: undefined } }));

    await expect(service.verifyVendorSignInOtp('9000000001', '123456')).resolves.toEqual(
      expect.objectContaining({ user: expect.objectContaining({ role: 'vendor' }) }),
    );
  });

  it.each([
    ['a vendor session from the customer’s verification', () => service.verifyCustomerOtp('9876543210', '123456'), VENDOR_SESSION],
    ['a customer session from a vendor sign in', () => service.verifyVendorSignInOtp('9000000001', '123456'), CUSTOMER_SESSION],
    ['a customer session from a vendor registration', () => service.verifyVendorOtp(REGISTRATION_ID, '123456'), CUSTOMER_SESSION],
    ['an admin session', () => service.verifyVendorSignInOtp('9000000001', '123456'), { ...VENDOR_SESSION, role: 'ADMIN', user: { ...VENDOR_SESSION.user, role: 'admin' } }],
  ])('refuses %s', async (_case, call, data) => {
    backendAnswers(succeeds(data));

    const error = await rejectionOf(call());

    expect(error.kind).toBe('server');
  });

  it.each([
    ['no token', { ...VENDOR_SESSION, token: '' }],
    ['no user', { ...VENDOR_SESSION, user: null }],
    ['a user with no id', { ...VENDOR_SESSION, user: { ...VENDOR_SESSION.user, id: undefined } }],
    ['a user with no phone', { ...VENDOR_SESSION, user: { ...VENDOR_SESSION.user, phone: '' } }],
  ])('refuses a session with %s', async (_case, data) => {
    backendAnswers(succeeds(data));

    const error = await rejectionOf(service.verifyVendorSignInOtp('9000000001', '123456'));

    expect(error.kind).toBe('server');
  });

  it('reads the registration code’s answer as the new vendor’s session', async () => {
    backendAnswers(succeeds(VENDOR_SESSION));

    await expect(service.verifyVendorOtp(REGISTRATION_ID, '123456')).resolves.toEqual({
      token: 'jwt-vendor',
      user: VENDOR_SESSION.user,
    });
  });

  it('refuses the retired auth-code answer from the registration code', async () => {
    // What `/auth/vendor/otp/verify` answered before 28/11/2026. A backend
    // still sending it has no session to give, and the app must not invent one.
    backendAnswers(succeeds({ code: TYPED_CODE, issuedAt: '2026-11-17T10:00:00.000Z' }));

    const error = await rejectionOf(service.verifyVendorOtp(REGISTRATION_ID, '123456'));

    expect(error.kind).toBe('server');
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain(TYPED_CODE);
  });

  it.each([
    ['no masked destination', { ...CHALLENGE, maskedDestination: '' }],
    ['an expiry that is not a date', { ...CHALLENGE, expiresAt: 'soon' }],
    ['a resend wait that is not a number', { ...CHALLENGE, resendAfterSeconds: '30' }],
    ['a negative resend wait', { ...CHALLENGE, resendAfterSeconds: -1 }],
  ])('refuses a challenge with %s', async (_case, data) => {
    backendAnswers(succeeds(data));

    const error = await rejectionOf(service.requestVendorOtp(REGISTRATION_ID));

    expect(error.kind).toBe('server');
  });
});

describe('every error code the contract lists', () => {
  const cases: [string, () => Promise<unknown>, number, string, string][] = [
    ['requestCustomerOtp', () => service.requestCustomerOtp('9876543210'), 400, 'VALIDATION_FAILED', 'validation'],
    ['requestCustomerOtp', () => service.requestCustomerOtp('9876543210'), 429, 'OTP_RESEND_TOO_SOON', 'unknown'],
    ['verifyCustomerOtp', () => service.verifyCustomerOtp('9876543210', '000000'), 400, 'OTP_INVALID', 'validation'],
    ['verifyCustomerOtp', () => service.verifyCustomerOtp('9876543210', '123456'), 400, 'OTP_EXPIRED', 'validation'],
    ['verifyCustomerOtp', () => service.verifyCustomerOtp('9876543210', '000000'), 429, 'OTP_TOO_MANY_ATTEMPTS', 'unknown'],
    ['verifyCustomerOtp', () => service.verifyCustomerOtp('9876543210', '123456'), 403, 'ACCOUNT_SUSPENDED', 'forbidden'],
    ['registerVendor', () => service.registerVendor({ businessName: 'B', ownerFirstName: 'F', ownerLastName: 'L', phone: '9000000001', serviceCategoryIds: ['c'] }), 409, 'PHONE_ALREADY_REGISTERED', 'conflict'],
    ['registerVendor', () => service.registerVendor({ businessName: '', ownerFirstName: 'F', ownerLastName: 'L', phone: '9000000001', serviceCategoryIds: [] }), 400, 'VALIDATION_FAILED', 'validation'],
    ['requestVendorOtp', () => service.requestVendorOtp(REGISTRATION_ID), 404, 'REGISTRATION_NOT_FOUND', 'notFound'],
    ['requestVendorOtp', () => service.requestVendorOtp(REGISTRATION_ID), 429, 'OTP_RESEND_TOO_SOON', 'unknown'],
    ['verifyVendorOtp', () => service.verifyVendorOtp(REGISTRATION_ID, '000000'), 400, 'OTP_INVALID', 'validation'],
    ['verifyVendorOtp', () => service.verifyVendorOtp(REGISTRATION_ID, '123456'), 400, 'OTP_EXPIRED', 'validation'],
    ['verifyVendorOtp', () => service.verifyVendorOtp(REGISTRATION_ID, '000000'), 429, 'OTP_TOO_MANY_ATTEMPTS', 'unknown'],
    ['verifyVendorOtp', () => service.verifyVendorOtp(REGISTRATION_ID, '123456'), 404, 'REGISTRATION_NOT_FOUND', 'notFound'],
    ['requestVendorSignInOtp', () => service.requestVendorSignInOtp('9000000001'), 400, 'VALIDATION_FAILED', 'validation'],
    ['requestVendorSignInOtp', () => service.requestVendorSignInOtp('9000000001'), 429, 'OTP_RESEND_TOO_SOON', 'unknown'],
    ['requestVendorSignInOtp', () => service.requestVendorSignInOtp('9000000001'), 429, 'RATE_LIMITED', 'unknown'],
    ['verifyVendorSignInOtp', () => service.verifyVendorSignInOtp('9000000001', '000000'), 400, 'OTP_INVALID', 'validation'],
    ['verifyVendorSignInOtp', () => service.verifyVendorSignInOtp('9000000001', '123456'), 400, 'OTP_EXPIRED', 'validation'],
    ['verifyVendorSignInOtp', () => service.verifyVendorSignInOtp('9000000001', '000000'), 429, 'OTP_TOO_MANY_ATTEMPTS', 'unknown'],
    ['verifyVendorSignInOtp', () => service.verifyVendorSignInOtp('9000000001', '123456'), 403, 'ACCOUNT_SUSPENDED', 'forbidden'],
    // phase5-contract.md section 2: the provider refused or timed out.
    ['requestCustomerOtp', () => service.requestCustomerOtp('9876543210'), 503, 'OTP_DELIVERY_FAILED', 'server'],
    ['requestVendorSignInOtp', () => service.requestVendorSignInOtp('9000000001'), 503, 'OTP_DELIVERY_FAILED', 'server'],
    ['requestVendorOtp', () => service.requestVendorOtp(REGISTRATION_ID), 503, 'OTP_DELIVERY_FAILED', 'server'],
    ['registerVendor', () => service.registerVendor({ businessName: 'B', ownerFirstName: 'F', ownerLastName: 'L', phone: '9000000001', serviceCategoryIds: ['c'] }), 503, 'OTP_DELIVERY_FAILED', 'server'],
  ];

  it.each(cases)('%s reads %i %s as %s, in the app’s words', async (_name, call, status, code, kind) => {
    backendAnswers(fails(status, code));

    const error = await rejectionOf(call());

    expect(error.kind).toBe(kind);
    expect(error.code).toBe(code);
    expect(error.userMessage).toBe(AppError.messageForCode(code));
    expect(error.userMessage).not.toContain('English');
  });

  it('says a code that could not be sent can be asked for again at once', async () => {
    backendAnswers(fails(503, 'OTP_DELIVERY_FAILED'));

    const error = await rejectionOf(service.requestVendorSignInOtp('9000000001'));

    expect(error.userMessage).toBe('We could not send your code just now. Please try again.');
    expect(error.isRetryable).toBe(true);
    // Names no channel: the next attempt may not go the same way.
    expect(error.userMessage).not.toMatch(/whatsapp/i);
  });

  it.each([
    ['AUTH_CODE_INVALID', 401, 'unauthorized'],
    ['SIGNIN_TOO_MANY_ATTEMPTS', 429, 'unknown'],
  ] as const)('reads the retired %s as its kind, with no sentence of its own', async (code, status, kind) => {
    backendAnswers(fails(status, code));

    const error = await rejectionOf(service.verifyVendorSignInOtp('9000000001', '123456'));

    expect(AppError.messageForCode(code)).toBeUndefined();
    expect(error.userMessage).toBe(AppError.defaultMessage(kind));
  });

  it('tells a rate-limited vendor how long is left, and signs nobody out', async () => {
    backendAnswers({ ...fails(429, 'RATE_LIMITED'), headers: { 'retry-after': '600' } });

    const error = await rejectionOf(service.requestVendorSignInOtp('9000000001'));

    expect(error.kind).toBe('unknown');
    expect(error.retryAfterSeconds).toBe(600);
    expect(error.userMessage).toBe('Too many attempts. Try again in 10 minutes.');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('never treats a refused code as a dead session', async () => {
    setTokenProvider(() => 'jwt-somebody');
    backendAnswers(fails(400, 'OTP_INVALID'));

    await rejectionOf(service.verifyVendorSignInOtp('9000000001', TYPED_CODE));
    await rejectionOf(service.verifyVendorOtp(REGISTRATION_ID, TYPED_CODE));
    await rejectionOf(service.verifyCustomerOtp('9876543210', TYPED_CODE));

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('signs out without starting a second sign out when the server already ended the session', async () => {
    setTokenProvider(() => 'jwt-expired');
    backendAnswers(fails(401, 'UNAUTHORIZED'));

    const error = await rejectionOf(service.signOut());

    expect(error.kind).toBe('unauthorized');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('puts the typed code in no error and no log line', async () => {
    backendAnswers(fails(400, 'OTP_INVALID'));

    const signIn = await rejectionOf(service.verifyVendorSignInOtp('9000000001', TYPED_CODE));
    const register = await rejectionOf(service.verifyVendorOtp(REGISTRATION_ID, TYPED_CODE));

    for (const error of [signIn, register]) {
      expect(JSON.stringify({ ...error, message: error.message, cause: error.cause })).not.toContain(
        TYPED_CODE,
      );
    }
    const logged = JSON.stringify(consoleCalls);
    expect(logged).toContain('OTP_INVALID');
    expect(logged).not.toContain(TYPED_CODE);
  });
});
