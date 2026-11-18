/**
 * HttpClient is where every backend answer becomes either the data a service
 * asked for or one AppError, so these tests pin the rules that keep the
 * backend out of the interface (Phase 4A, 17/11/2026):
 *
 * - the envelope never reaches a service, and a 2xx that is not one is a fault;
 * - the kind comes from the status, the copy from the `code`, and the backend's
 *   English never becomes `userMessage`;
 * - field names survive, Joi's sentences do not;
 * - a 401 ends the session through the handler — except a refused credential,
 *   and a call that asked not to;
 * - nothing the request carried — a code, the token — reaches the error or the
 *   log.
 *
 * The backend is a fake axios adapter on the real client: the interceptors, the
 * envelope reader and the wrappers all run, and nothing touches a network.
 */

import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import {
  Http,
  httpClient,
  setTokenProvider,
  setUnauthorizedHandler,
} from '@/core/http/HttpClient';
import { AppError } from '@/shared/types/error';

type Reply =
  | { status: number; body?: unknown; headers?: Record<string, string> }
  | 'network'
  | 'timeout';

const sent: InternalAxiosRequestConfig[] = [];
const originalAdapter = httpClient.defaults.adapter;

/** Answers every request with `reply`, recording what was sent. */
function backendAnswers(reply: Reply): void {
  const adapter: AxiosAdapter = async config => {
    sent.push(config);
    if (reply === 'network') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    if (reply === 'timeout') {
      throw new AxiosError('timeout of 30000ms exceeded', AxiosError.ECONNABORTED, config);
    }
    const response: AxiosResponse = {
      data: reply.body,
      status: reply.status,
      statusText: '',
      headers: reply.headers ?? {},
      config,
    };
    if (reply.status >= 400) {
      throw new AxiosError(
        `Request failed with status code ${reply.status}`,
        AxiosError.ERR_BAD_REQUEST,
        config,
        null,
        response,
      );
    }
    return response;
  };
  httpClient.defaults.adapter = adapter;
}

function failure(code: string | undefined, message = 'English for developers', errors: unknown = null) {
  return { success: false, message, code, errors, data: null };
}

/** The rejection of `promise`, as the AppError it must be. */
async function rejectionOf(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    expect(caught).toBeInstanceOf(AppError);
    return caught as AppError;
  }
  throw new Error('Expected the call to reject');
}

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
});

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  setTokenProvider(() => null);
  setUnauthorizedHandler(() => {});
  onUnauthorized.mockReset();
  jest.restoreAllMocks();
});

describe('a successful response', () => {
  it('resolves with the envelope’s data and nothing else', async () => {
    backendAnswers({
      status: 200,
      body: { success: true, message: 'Done.', data: { id: 'a1' }, meta: {}, errors: null },
    });

    await expect(Http.post('/things/detail', { id: 'a1' })).resolves.toEqual({ id: 'a1' });
  });

  it('keeps meta for a list that pages', async () => {
    const meta = { total: 41, page: 2, limit: 20, pages: 3, hasNextPage: true, hasPrevPage: true };
    backendAnswers({ status: 200, body: { success: true, message: 'ok', data: [1, 2], meta } });

    await expect(Http.postEnvelope('/things/list', { page: 2 })).resolves.toEqual({
      data: [1, 2],
      meta,
    });
  });

  it('sends the method, the path and the body it was given', async () => {
    backendAnswers({ status: 200, body: { success: true, data: null } });

    await Http.post('/auth/customer/otp/request', { phone: '9876543210' });

    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/auth/customer/otp/request');
    expect(JSON.parse(sent[0].data as string)).toEqual({ phone: '9876543210' });
  });

  it('adds the bearer token when there is a session, and no header when there is not', async () => {
    backendAnswers({ status: 200, body: { success: true, data: null } });

    await Http.get('/auth/me');
    setTokenProvider(() => 'token-abc');
    await Http.get('/auth/me');

    expect(sent[0].headers.Authorization).toBeUndefined();
    expect(sent[1].headers.Authorization).toBe('Bearer token-abc');
  });

  it.each([
    ['a body that is not an envelope', { id: 'a1' }],
    ['an envelope that says it failed', { success: false, message: 'nope', data: null }],
    ['no body at all', undefined],
  ])('refuses %s as a server fault', async (_case, body) => {
    backendAnswers({ status: 200, body });

    const error = await rejectionOf(Http.get('/things'));

    expect(error.kind).toBe('server');
    expect(error.isRetryable).toBe(true);
    expect(error.userMessage).toBe(AppError.defaultMessage('server'));
  });
});

describe('a failed response', () => {
  it.each([
    [400, 'validation'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'notFound'],
    [409, 'conflict'],
    [422, 'validation'],
    [429, 'unknown'],
    [500, 'server'],
    [503, 'server'],
  ] as const)('maps status %i to %s', async (status, kind) => {
    backendAnswers({ status, body: failure(undefined) });

    const error = await rejectionOf(Http.get('/things'));

    expect(error.kind).toBe(kind);
    expect(error.statusCode).toBe(status);
  });

  /** Every code in the shared sign-in contract, with its status and the app's sentence. */
  const CONTRACT: [string, number, string, string][] = [
    ['VALIDATION_FAILED', 400, 'validation', 'Please check the details you entered.'],
    ['OTP_INVALID', 400, 'validation', 'That code is not correct. Please check and try again.'],
    ['OTP_EXPIRED', 400, 'validation', 'That code has expired. Request a new one.'],
    [
      'OTP_TOO_MANY_ATTEMPTS',
      429,
      'unknown',
      'Too many incorrect attempts. Request a new code to try again.',
    ],
    ['OTP_RESEND_TOO_SOON', 429, 'unknown', 'Please wait a moment before requesting another code.'],
    [
      'REGISTRATION_NOT_FOUND',
      404,
      'notFound',
      'That registration is no longer available. Please start again.',
    ],
    [
      'PHONE_ALREADY_REGISTERED',
      409,
      'conflict',
      'An account already exists for this number. Try signing in instead.',
    ],
    ['AUTH_CODE_INVALID', 401, 'unauthorized', 'Those sign-in details were not recognised.'],
    // At `/auth/vendor/auth-code/confirm` (ApiAuthService rewords it there).
    ['AUTH_CODE_INVALID', 400, 'validation', 'Those sign-in details were not recognised.'],
    ['SIGNIN_TOO_MANY_ATTEMPTS', 429, 'unknown', 'Too many attempts. Try again in 15 minutes.'],
    [
      'ACCOUNT_SUSPENDED',
      403,
      'forbidden',
      'This account is not active right now, so you cannot sign in with it.',
    ],
    ['UNAUTHORIZED', 401, 'unauthorized', 'Your session has expired. Please sign in again.'],
  ];

  it.each(CONTRACT)('turns %s (%i) into %s with the app’s sentence', async (code, status, kind, copy) => {
    backendAnswers({ status, body: failure(code, `Backend says ${code} in English`) });

    const error = await rejectionOf(Http.post('/auth/anything', {}));

    expect(error.kind).toBe(kind);
    expect(error.code).toBe(code);
    expect(error.userMessage).toBe(copy);
    expect(error.userMessage).not.toContain('English');
  });

  describe('a wait the backend asks for (Retry-After)', () => {
    it.each([
      ['840', 840, 'Too many attempts. Try again in 14 minutes.'],
      ['900', 900, 'Too many attempts. Try again in 15 minutes.'],
      // Rounded up, so the app never says "try again" before the backend allows it.
      ['61', 61, 'Too many attempts. Try again in 2 minutes.'],
      ['30', 30, 'Too many attempts. Try again in 1 minute.'],
      ['0', 0, 'Too many attempts. Try again in 1 minute.'],
    ])('words %s seconds as the time left', async (header, seconds, copy) => {
      backendAnswers({
        status: 429,
        body: failure('SIGNIN_TOO_MANY_ATTEMPTS'),
        headers: { 'retry-after': header },
      });

      const error = await rejectionOf(Http.post('/auth/vendor/signin', {}));

      expect(error.retryAfterSeconds).toBe(seconds);
      expect(error.userMessage).toBe(copy);
    });

    it.each([
      ['120', 'Too many attempts. Try again in 2 minutes.'],
      ['3600', 'Too many attempts. Try again in 1 hour.'],
      // A day's code limit runs to hours; rounded up, never early.
      ['3601', 'Too many attempts. Try again in 2 hours.'],
      ['36000', 'Too many attempts. Try again in 10 hours.'],
    ])('words RATE_LIMITED with %s seconds left', async (header, copy) => {
      backendAnswers({ status: 429, body: failure('RATE_LIMITED'), headers: { 'retry-after': header } });

      const error = await rejectionOf(Http.post('/auth/customer/otp/request', {}));

      expect(error.code).toBe('RATE_LIMITED');
      expect(error.kind).toBe('unknown');
      expect(error.userMessage).toBe(copy);
    });

    it('words RATE_LIMITED without a header calmly, with no time it cannot know', async () => {
      backendAnswers({ status: 429, body: failure('RATE_LIMITED') });

      const error = await rejectionOf(Http.post('/auth/customer/otp/request', {}));

      expect(error.userMessage).toBe('Too many attempts. Please wait a little and try again.');
      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('reads the header whatever its case', async () => {
      backendAnswers({
        status: 429,
        body: failure('SIGNIN_TOO_MANY_ATTEMPTS'),
        headers: { 'Retry-After': '300' },
      });

      const error = await rejectionOf(Http.post('/auth/vendor/signin', {}));

      expect(error.userMessage).toBe('Too many attempts. Try again in 5 minutes.');
    });

    it.each([
      ['an HTTP date', 'Wed, 18 Nov 2026 07:28:00 GMT'],
      ['a negative number', '-5'],
      ['nonsense', 'soon'],
    ])('falls back to the fixed sentence for %s', async (_case, header) => {
      backendAnswers({
        status: 429,
        body: failure('SIGNIN_TOO_MANY_ATTEMPTS'),
        headers: { 'retry-after': header },
      });

      const error = await rejectionOf(Http.post('/auth/vendor/signin', {}));

      expect(error.retryAfterSeconds).toBeUndefined();
      expect(error.userMessage).toBe('Too many attempts. Try again in 15 minutes.');
    });

    it('leaves the copy of a code with no worded wait alone', async () => {
      backendAnswers({
        status: 429,
        body: failure('OTP_RESEND_TOO_SOON'),
        headers: { 'retry-after': '20' },
      });

      const error = await rejectionOf(Http.post('/auth/customer/otp/request', {}));

      expect(error.retryAfterSeconds).toBe(20);
      expect(error.userMessage).toBe('Please wait a moment before requesting another code.');
    });
  });

  it('has the app’s sentence for a review that does not exist yet', async () => {
    backendAnswers({ status: 404, body: failure('REVIEW_NOT_FOUND') });

    const error = await rejectionOf(Http.post('/reviews/detail', { requestId: 'r1' }));

    expect(error.kind).toBe('notFound');
    expect(error.userMessage).toBe('We could not find a review for this request.');
  });

  it('reads a code it has no sentence for as its kind', async () => {
    backendAnswers({ status: 409, body: failure('SOMETHING_NEW') });

    const error = await rejectionOf(Http.get('/things'));

    expect(error.code).toBe('SOMETHING_NEW');
    expect(error.userMessage).toBe(AppError.defaultMessage('conflict'));
  });

  it('never shows the backend’s message, even with no code beside it', async () => {
    backendAnswers({ status: 404, body: failure(undefined, 'Endpoint /api/v1/x not found.') });

    const error = await rejectionOf(Http.get('/x'));

    expect(error.code).toBeUndefined();
    expect(error.userMessage).toBe(AppError.defaultMessage('notFound'));
    // Developer detail is where it belongs.
    expect(error.message).toBe('Endpoint /api/v1/x not found.');
  });

  it('keeps Joi’s field names and drops its sentences', async () => {
    backendAnswers({
      status: 400,
      body: failure('VALIDATION_FAILED', 'Validation Failed', [
        { field: 'phone', message: '"phone" length must be at least 7 characters long' },
        { field: 'authCode', message: '"authCode" with value "482913" fails to match the pattern' },
        { message: 'no field, so nothing to attach it to' },
      ]),
    });

    const error = await rejectionOf(Http.post('/auth/vendor/signin', {}));

    expect(error.fieldErrors).toEqual({
      phone: AppError.defaultMessage('validation'),
      authCode: AppError.defaultMessage('validation'),
    });
    expect(JSON.stringify(error.fieldErrors)).not.toContain('482913');
  });

  it('has no field errors when the backend lists none', async () => {
    backendAnswers({ status: 400, body: failure('OTP_INVALID') });

    const error = await rejectionOf(Http.post('/auth/customer/otp/verify', {}));

    expect(error.fieldErrors).toBeUndefined();
  });

  it('copes with a failure that has no envelope at all', async () => {
    backendAnswers({ status: 502, body: '<html>Bad gateway</html>' });

    const error = await rejectionOf(Http.get('/things'));

    expect(error.kind).toBe('server');
    expect(error.code).toBeUndefined();
    expect(error.userMessage).toBe(AppError.defaultMessage('server'));
  });

  it.each([
    ['network', 'network'],
    ['timeout', 'timeout'],
  ] as const)('maps a %s failure to %s, retryable', async (reply, kind) => {
    backendAnswers(reply);

    const error = await rejectionOf(Http.get('/things'));

    expect(error.kind).toBe(kind);
    expect(error.isRetryable).toBe(true);
  });
});

describe('the unauthorized handler', () => {
  it('runs on a 401 for a dead session', async () => {
    setTokenProvider(() => 'token-current');
    backendAnswers({ status: 401, body: failure('UNAUTHORIZED') });

    await rejectionOf(Http.get('/addresses'));

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('runs on a 401 with no code, as the backend sends today', async () => {
    setTokenProvider(() => 'token-current');
    backendAnswers({ status: 401, body: failure(undefined, 'Invalid or expired authentication token.') });

    await rejectionOf(Http.get('/addresses'));

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('runs for a revoked session — the token is still the one signed in', async () => {
    // The backend's token version: the account was suspended, or an admin
    // regenerated the vendor's code. Same token, now refused.
    setTokenProvider(() => 'token-revoked');
    backendAnswers({ status: 401, body: failure('UNAUTHORIZED', 'Session revoked') });

    await rejectionOf(Http.get('/requests/list'));

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not run for a late 401 sent for an account that has since been replaced', async () => {
    // Account A's request is in flight; A signs out and B signs in before it is answered.
    let current = 'token-A';
    setTokenProvider(() => current);
    const adapter: AxiosAdapter = async config => {
      sent.push(config);
      current = 'token-B';
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, {
        data: failure('UNAUTHORIZED'),
        status: 401,
        statusText: '',
        headers: {},
        config,
      });
    };
    httpClient.defaults.adapter = adapter;

    await rejectionOf(Http.get('/addresses'));

    expect(sent[0].headers.Authorization).toBe('Bearer token-A');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not run for a late 401 that arrives after signing out', async () => {
    let current: string | null = 'token-A';
    setTokenProvider(() => current);
    const adapter: AxiosAdapter = async config => {
      current = null;
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, {
        data: failure('UNAUTHORIZED'),
        status: 401,
        statusText: '',
        headers: {},
        config,
      });
    };
    httpClient.defaults.adapter = adapter;

    await rejectionOf(Http.get('/addresses'));

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not run for a 401 on a request that carried no token', async () => {
    backendAnswers({ status: 401, body: failure('UNAUTHORIZED') });

    await rejectionOf(Http.get('/addresses'));

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not run for a refused vendor auth code — there is no session to end', async () => {
    setTokenProvider(() => 'token-current');
    backendAnswers({ status: 401, body: failure('AUTH_CODE_INVALID') });

    await rejectionOf(Http.post('/auth/vendor/signin', {}));

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not run for a locked vendor sign in', async () => {
    setTokenProvider(() => 'token-current');
    backendAnswers({
      status: 429,
      body: failure('SIGNIN_TOO_MANY_ATTEMPTS'),
      headers: { 'retry-after': '900' },
    });

    await rejectionOf(Http.post('/auth/vendor/signin', {}));

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not run for a call that asked not to', async () => {
    setTokenProvider(() => 'token-current');
    backendAnswers({ status: 401, body: failure('UNAUTHORIZED') });

    await rejectionOf(Http.post('/auth/logout', {}, { skipUnauthorizedHandler: true }));

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it.each([403, 404, 500])('does not run on a %i', async status => {
    setTokenProvider(() => 'token-current');
    backendAnswers({ status, body: failure(undefined) });

    await rejectionOf(Http.get('/things'));

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('what an error may carry', () => {
  const AUTH_CODE = '482913';
  const TOKEN = 'secret-session-token';

  it.each([
    ['a refusal', { status: 401, body: failure('AUTH_CODE_INVALID') }],
    ['a network failure', 'network'],
    ['a timeout', 'timeout'],
  ] as [string, Reply][])('holds neither the request body nor the token after %s', async (_case, reply) => {
    setTokenProvider(() => TOKEN);
    backendAnswers(reply);

    const error = await rejectionOf(
      Http.post('/auth/vendor/signin', { phone: '9000000001', authCode: AUTH_CODE }),
    );

    // Everything the error holds, the cause included.
    const everything = JSON.stringify({ ...error, message: error.message, cause: error.cause });
    expect(everything).not.toContain(AUTH_CODE);
    expect(everything).not.toContain(TOKEN);
    expect(error.cause).not.toBeInstanceOf(Error);
    expect(error.cause).toEqual(expect.objectContaining({ method: 'post', url: '/auth/vendor/signin' }));
  });

  it('logs neither the request body nor the token', async () => {
    setTokenProvider(() => TOKEN);
    backendAnswers({ status: 401, body: failure('AUTH_CODE_INVALID') });

    await rejectionOf(Http.post('/auth/vendor/signin', { phone: '9000000001', authCode: AUTH_CODE }));

    const logged = JSON.stringify(consoleCalls);
    // The failure was logged — so the search below is looking at something.
    expect(logged).toContain('AUTH_CODE_INVALID');
    expect(logged).not.toContain(AUTH_CODE);
    expect(logged).not.toContain(TOKEN);
  });
});
