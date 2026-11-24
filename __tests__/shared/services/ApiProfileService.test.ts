/**
 * ApiProfileService edits the signed-in customer's own record. The backend
 * lets any signed-in account update any customer by id, so these tests pin:
 *
 * - the id sent is the session's own, the body is exactly the editable fields
 *   (never `status`, never `phone`), and an answer for another id is refused;
 * - names trimmed and checked as the mock checks them, before sending;
 * - clearing an email sends `email: null` — only when there was one — and the
 *   backend's `EMAIL_REQUIRED_FOR_SIGN_IN` refusal reads with its own copy
 *   (Phase 4B contract §7, 24/11/2026);
 * - a new photo is sent as the uploaded URL, and the photo read back goes
 *   through `toImageUrl` (contract §1–§2);
 * - the record read back into the session's user field by field;
 * - failures as AppErrors (a taken email is a conflict).
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
import { httpClient } from '@/core/http/HttpClient';
import type { AuthUser } from '@/features/auth/types';
import { ApiProfileService } from '@/shared/services/api/ApiProfileService';
import { AppError } from '@/shared/types/error';

type Reply = { status: number; body: unknown } | 'network';

const sent: InternalAxiosRequestConfig[] = [];
const originalAdapter = httpClient.defaults.adapter;

function backendAnswers(reply: (body: Record<string, unknown>) => Reply): void {
  const adapter: AxiosAdapter = async config => {
    sent.push(config);
    const answer = reply(JSON.parse((config.data as string) ?? '{}'));
    if (answer === 'network') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    const response: AxiosResponse = { data: answer.body, status: answer.status, statusText: '', headers: {}, config };
    if (answer.status >= 400) {
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
    }
    return response;
  };
  httpClient.defaults.adapter = adapter;
}

function ok(data: unknown): Reply {
  return { status: 200, body: { success: true, message: 'Customer profile updated successfully.', data, meta: {}, errors: null } };
}

function bodies(): Record<string, unknown>[] {
  return sent.map(config => JSON.parse((config.data as string) ?? '{}'));
}

const CUSTOMER_ID = '6afc3e5d7c2e50812e44de8f';

/** The API's own origin, where a stored `/uploads/...` path is loaded from. */
const ORIGIN = AppConfig.api.baseUrl.replace(/\/api\/v1\/?$/, '');
const PHOTO_PATH = '/uploads/profile/4a5b6c7d8e9f00112233445566778899.jpg';

const ASHA: AuthUser = { id: CUSTOMER_ID, firstName: 'Asha', lastName: 'Patel', phone: '9876543210', role: 'customer' };

/** `customerMapper`'s record, as `/customers/update` answers. */
function customerRecord(extra: Record<string, unknown> = {}) {
  return {
    id: CUSTOMER_ID,
    firstName: 'Asha',
    lastName: 'Patel',
    fullName: 'Asha Patel',
    email: undefined,
    phone: '9876543210',
    profileImage: null,
    defaultAddress: { _id: '6afc3e5d7c2e50812e44de91', addressLine1: '742 Evergreen Terrace' },
    isVerified: true,
    lastLogin: null,
    status: 'ACTIVE',
    createdAt: '2026-11-17T11:45:33.690Z',
    updatedAt: '2026-11-17T11:45:33.697Z',
    ...extra,
  };
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

let user: AuthUser | null;
let service: ApiProfileService;

beforeEach(() => {
  sent.length = 0;
  user = ASHA;
  for (const method of ['log', 'warn', 'error', 'info'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
  service = new ApiProfileService({ currentUser: async () => user });
});

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

describe('updateProfile', () => {
  it('sends the session’s own id and the three editable fields, trimmed, and nothing else', async () => {
    backendAnswers(() => ok(customerRecord({ firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com' })));

    const updated = await service.updateProfile({ firstName: '  Asha ', lastName: ' Rao ', email: ' Asha@Example.com ' });

    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/customers/update');
    expect(bodies()[0]).toEqual({ id: CUSTOMER_ID, firstName: 'Asha', lastName: 'Rao', email: 'Asha@Example.com' });
    expect(Object.keys(bodies()[0])).not.toContain('status');
    expect(Object.keys(bodies()[0])).not.toContain('phone');
    // The backend's own normalisation is what the session adopts.
    expect(updated).toEqual({
      id: CUSTOMER_ID,
      firstName: 'Asha',
      lastName: 'Rao',
      phone: '9876543210',
      role: 'customer',
      email: 'asha@example.com',
    });
    expect(JSON.stringify(updated)).not.toMatch(/_id|Evergreen|status|fullName|isVerified/);
  });

  it('sends no email key for a customer who has none and gave none', async () => {
    backendAnswers(() => ok(customerRecord({ lastName: '' })));

    const updated = await service.updateProfile({ firstName: 'Asha', lastName: '' });

    expect(Object.keys(bodies()[0]).sort()).toEqual(['firstName', 'id', 'lastName']);
    expect(updated).not.toHaveProperty('email');
    expect(updated.lastName).toBe('');
  });

  it('removes a cleared email by sending email: null, and adopts the record without one', async () => {
    user = { ...ASHA, email: 'asha@example.com' };
    backendAnswers(() => ok(customerRecord()));

    const updated = await service.updateProfile({ firstName: 'Asha', lastName: 'Patel' });

    expect(bodies()[0]).toEqual({ id: CUSTOMER_ID, firstName: 'Asha', lastName: 'Patel', email: null });
    expect(updated).not.toHaveProperty('email');
  });

  it('reads EMAIL_REQUIRED_FOR_SIGN_IN with its own words: the email is how they sign in', async () => {
    user = { ...ASHA, email: 'asha@example.com' };
    backendAnswers(() => ({
      status: 400,
      body: {
        success: false,
        message: 'Backend English',
        code: 'EMAIL_REQUIRED_FOR_SIGN_IN',
        errors: [{ field: 'email', message: 'x' }],
        data: null,
      },
    }));

    const error = await rejectionOf(service.updateProfile({ firstName: 'Asha', lastName: 'Patel' }));

    expect(bodies()[0].email).toBeNull();
    expect(error.kind).toBe('validation');
    expect(error.code).toBe('EMAIL_REQUIRED_FOR_SIGN_IN');
    expect(error.userMessage).toBe('Your email address can’t be removed: it is how you sign in to this account.');
    expect(error.fieldErrors).toHaveProperty('email');
  });

  it.each([
    ['no first name', { firstName: '   ', lastName: 'Patel' }],
    ['a name too long', { firstName: 'A'.repeat(51), lastName: '' }],
  ])('refuses %s before sending', async (_case, input) => {
    backendAnswers(() => ok(customerRecord()));

    const error = await rejectionOf(service.updateProfile(input));

    expect(error.kind).toBe('validation');
    expect(sent).toHaveLength(0);
  });

  it('refuses an answer for any other customer as a server fault', async () => {
    backendAnswers(() => ok(customerRecord({ id: '6afc3e5d7c2e50812e44de90' })));

    const error = await rejectionOf(service.updateProfile({ firstName: 'Asha', lastName: 'Patel' }));

    expect(error.kind).toBe('server');
  });

  it.each([
    ['nobody', null],
    ['a vendor', { ...ASHA, role: 'vendor' as const }],
  ])('refuses %s signed in, asking the backend nothing', async (_case, signedIn) => {
    user = signedIn;
    backendAnswers(() => ok(customerRecord()));

    const error = await rejectionOf(service.updateProfile({ firstName: 'Asha', lastName: 'Patel' }));

    expect(error.kind).toBe('unauthorized');
    expect(sent).toHaveLength(0);
  });

  it.each([
    ['an email another account holds', 409, 'CONFLICT', 'conflict'],
    ['a refused email', 400, 'VALIDATION_FAILED', 'validation'],
    ['a server fault', 500, 'INTERNAL_ERROR', 'server'],
  ])('reads %s as %s', async (_case, status, code, kind) => {
    backendAnswers(() => ({ status, body: { success: false, message: 'Backend English', code, errors: null, data: null } }));

    const error = await rejectionOf(service.updateProfile({ firstName: 'Asha', lastName: 'Patel', email: 'a@b.co' }));

    expect(error.kind).toBe(kind);
    expect(error.userMessage).not.toContain('Backend English');
  });
});

describe('profile photo', () => {
  it('sets a new photo with exactly the id and the uploaded URL, and reads it back loadable', async () => {
    backendAnswers(() => ok(customerRecord({ profileImage: PHOTO_PATH })));

    const updated = await service.setProfileImage(`${ORIGIN}${PHOTO_PATH}`);

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/customers/update');
    // The URL as `ImageService` handed it over: the backend takes it back as its path.
    expect(bodies()[0]).toEqual({ id: CUSTOMER_ID, profileImage: `${ORIGIN}${PHOTO_PATH}` });
    expect(updated.avatarUrl).toBe(`${ORIGIN}${PHOTO_PATH}`);
  });

  it('refuses a blank photo before sending: blank is the backend’s "clear"', async () => {
    backendAnswers(() => ok(customerRecord()));

    const error = await rejectionOf(service.setProfileImage('  '));

    expect(error.kind).toBe('validation');
    expect(sent).toHaveLength(0);
  });

  it('reads a photo that is neither a path nor a URL as no photo', async () => {
    backendAnswers(() => ok(customerRecord({ profileImage: 'uploads/profile/a.jpg' })));

    const updated = await service.updateProfile({ firstName: 'Asha', lastName: 'Patel' });

    expect(updated).not.toHaveProperty('avatarUrl');
  });

  it('removes the photo with exactly the id and an empty image', async () => {
    user = { ...ASHA, avatarUrl: 'https://cdn.example/asha.jpg' };
    backendAnswers(() => ok(customerRecord({ profileImage: null })));

    const updated = await service.removeProfileImage();

    expect(bodies()[0]).toEqual({ id: CUSTOMER_ID, profileImage: null });
    expect(updated).not.toHaveProperty('avatarUrl');
  });

  it('keeps a photo the backend still holds', async () => {
    backendAnswers(() => ok(customerRecord({ profileImage: 'https://cdn.example/asha.jpg' })));

    const updated = await service.updateProfile({ firstName: 'Asha', lastName: 'Patel' });

    expect(updated.avatarUrl).toBe('https://cdn.example/asha.jpg');
  });
});
