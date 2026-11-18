/**
 * The session's two wires to the HTTP client, as bootstrap connects them, with
 * the real store, the real registry and the live ApiAuthService (Phase 4A):
 *
 * - the token of whoever is signed in rides on the next request;
 * - a 401 on a protected call signs them out through the unauthorized handler,
 *   which tells the server once — even when the server answers that sign out
 *   with a 401 of its own, which before `skipUnauthorizedHandler` started a
 *   second sign out beside the first;
 * - a refused vendor auth code signs nobody out.
 *
 * The backend is a fake axios adapter: no network.
 */

import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { bootstrapApp } from '@/app/bootstrap';
import { store } from '@/app/store';
import { Http, httpClient } from '@/core/http/HttpClient';
import { signedIn } from '@/features/auth/state/authSlice';
import { signOut } from '@/features/auth/state/authThunks';
import type { SessionPayload } from '@/features/auth/types';
import { ApiAuthService } from '@/shared/services/api/ApiAuthService';
import { getService, resetServices } from '@/shared/services/ServiceRegistry';
import { AppError } from '@/shared/types/error';

type Answer = { status: number; body: unknown };

const sent: InternalAxiosRequestConfig[] = [];
const originalAdapter = httpClient.defaults.adapter;
const originalHandler = ErrorUtils.getGlobalHandler();

/** Answers each request by its path. */
function backendAnswers(byPath: Record<string, Answer>): void {
  const adapter: AxiosAdapter = async config => {
    sent.push(config);
    const answer = byPath[config.url ?? ''] ?? { status: 404, body: null };
    const response: AxiosResponse = {
      data: answer.body,
      status: answer.status,
      statusText: '',
      headers: {},
      config,
    };
    if (answer.status >= 400) {
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
    }
    return response;
  };
  httpClient.defaults.adapter = adapter;
}

const OK: Answer = { status: 200, body: { success: true, message: 'ok', data: null } };

function refused(code: string): Answer {
  return { status: 401, body: { success: false, message: 'English', code, data: null, errors: null } };
}

const SESSION: SessionPayload = {
  token: 'jwt-customer',
  user: { id: 'u1', firstName: 'Asha', lastName: 'Patel', phone: '9876543210', role: 'customer' },
};

const NEXT_SESSION: SessionPayload = {
  token: 'jwt-vendor',
  user: { id: 'u2', firstName: 'Ravi', lastName: 'Kumar', phone: '9000000001', role: 'vendor' },
};

/** Lets the sign out the handler started (not awaited by anyone) run to its end. */
async function settle(): Promise<void> {
  for (let tick = 0; tick < 20; tick += 1) {
    await new Promise<void>(resolve => setImmediate(resolve));
  }
}

function sentTo(url: string): InternalAxiosRequestConfig[] {
  return sent.filter(config => config.url === url);
}

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  bootstrapApp();
});

afterAll(() => {
  httpClient.defaults.adapter = originalAdapter;
  ErrorUtils.setGlobalHandler(originalHandler);
  resetServices();
  jest.restoreAllMocks();
});

beforeEach(() => {
  sent.length = 0;
  store.dispatch(signedIn(SESSION));
});

it('uses the live auth service by default', () => {
  expect(getService('auth')).toBeInstanceOf(ApiAuthService);
});

it('sends the signed-in token with the next request', async () => {
  backendAnswers({ '/addresses': OK });

  await Http.get('/addresses');

  expect(sentTo('/addresses')[0].headers.Authorization).toBe('Bearer jwt-customer');
});

it('signs out on a 401 from a protected call, telling the server once', async () => {
  backendAnswers({ '/addresses': refused('UNAUTHORIZED'), '/auth/logout': OK });

  await expect(Http.get('/addresses')).rejects.toBeInstanceOf(AppError);
  await settle();

  expect(store.getState().auth.status).toBe('unauthenticated');
  expect(store.getState().auth.token).toBeNull();
  expect(sentTo('/auth/logout')).toHaveLength(1);
  expect(sentTo('/auth/logout')[0].headers.Authorization).toBe('Bearer jwt-customer');
});

it('signs out once when the server answers the sign out with a 401 as well', async () => {
  backendAnswers({ '/addresses': refused('UNAUTHORIZED'), '/auth/logout': refused('UNAUTHORIZED') });

  await expect(Http.get('/addresses')).rejects.toBeInstanceOf(AppError);
  await settle();

  expect(store.getState().auth.status).toBe('unauthenticated');
  expect(sentTo('/auth/logout')).toHaveLength(1);
});

it('ends the session once when several requests are refused together', async () => {
  backendAnswers({
    '/addresses': refused('UNAUTHORIZED'),
    '/requests/list': refused('UNAUTHORIZED'),
    '/notifications/list': refused('UNAUTHORIZED'),
    '/auth/logout': OK,
  });

  const results = await Promise.allSettled([
    Http.get('/addresses'),
    Http.post('/requests/list', {}),
    Http.post('/notifications/list', {}),
  ]);
  await settle();

  expect(results.every(result => result.status === 'rejected')).toBe(true);
  expect(store.getState().auth.status).toBe('unauthenticated');
  expect(sentTo('/auth/logout')).toHaveLength(1);
});

it('joins a sign out the person asked for while a 401 starts another', async () => {
  backendAnswers({ '/addresses': refused('UNAUTHORIZED'), '/auth/logout': OK });

  const asked = signOut(store.dispatch);
  await expect(Http.get('/addresses')).rejects.toBeInstanceOf(AppError);
  await asked;
  await settle();

  expect(store.getState().auth.status).toBe('unauthenticated');
  expect(sentTo('/auth/logout')).toHaveLength(1);
});

it('leaves the next account signed in when the last one’s request is refused late', async () => {
  // A's request is in flight when A signs out and B signs in; its 401 lands after.
  const adapter: AxiosAdapter = async config => {
    sent.push(config);
    if (config.url === '/addresses') {
      store.dispatch(signedIn(NEXT_SESSION));
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, {
        data: refused('UNAUTHORIZED').body,
        status: 401,
        statusText: '',
        headers: {},
        config,
      });
    }
    return { data: OK.body, status: 200, statusText: '', headers: {}, config };
  };
  httpClient.defaults.adapter = adapter;

  await expect(Http.get('/addresses')).rejects.toBeInstanceOf(AppError);
  await settle();

  expect(sentTo('/addresses')[0].headers.Authorization).toBe('Bearer jwt-customer');
  expect(store.getState().auth.status).toBe('authenticated');
  expect(store.getState().auth.token).toBe('jwt-vendor');
  expect(sentTo('/auth/logout')).toHaveLength(0);
});

it('signs nobody out over a refused vendor auth code', async () => {
  backendAnswers({ '/auth/vendor/signin': refused('AUTH_CODE_INVALID') });

  await expect(getService('auth').signInVendor('9000000001', '111111')).rejects.toBeInstanceOf(
    AppError,
  );
  await settle();

  expect(store.getState().auth.status).toBe('authenticated');
  expect(sentTo('/auth/logout')).toHaveLength(0);
});
