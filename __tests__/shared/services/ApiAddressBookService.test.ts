/**
 * ApiAddressBookService against the backend's saved addresses, live since only
 * the address line is required there (`requests-contract.md` §7). These tests pin:
 *
 * - saving sends only what the app holds — the street (or the whole line), the
 *   town as `city` and the PIN code when the app has them, a point only as a
 *   pair — and never a `state`, a title or a made-up town; a line typed by hand
 *   saves as just that line;
 * - an edit replaces rather than merges: every part the new address lacks is
 *   sent as `null` (cleared), a stale state included;
 * - the interface's rules the backend does not keep: the first address (or one
 *   saved while none is default) becomes the default, deleting the default
 *   promotes the most recently added;
 * - reading: the shown line built from the parts (no "undefined" state), the
 *   default first then insertion order, one default at most, and `title`,
 *   `customerId` and `_id` left behind.
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
import { ApiAddressBookService } from '@/shared/services/api/ApiAddressBookService';
import { AppError } from '@/shared/types/error';

type Reply = { status: number; body: unknown } | 'network';

const sent: InternalAxiosRequestConfig[] = [];
const originalAdapter = httpClient.defaults.adapter;

function backendAnswers(reply: (config: InternalAxiosRequestConfig) => Reply): void {
  const adapter: AxiosAdapter = async config => {
    sent.push(config);
    const answer = reply(config);
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
  return { status: 200, body: { success: true, message: 'OK', data, meta: {}, errors: null } };
}

function bodyOf(config: InternalAxiosRequestConfig): unknown {
  return config.data === undefined ? undefined : JSON.parse(config.data as string);
}

function calls(): Array<[string | undefined, string | undefined]> {
  return sent.map(config => [config.method, config.url]);
}

const CUSTOMER_ID = '6afc3e5d7c2e50812e44de8f';
const A = '6afc3e5d7c2e50812e44de91';
const B = '6afc3e5d7c2e50812e44de92';
const C = '6afc3e5d7c2e50812e44de93';

/** `addressMapper`'s row — an address saved by this app, so no state. */
function addressRow(id: string, createdAt: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    customerId: CUSTOMER_ID,
    title: 'Home',
    addressLine1: '12 MG Road',
    addressLine2: '',
    city: 'Ashok Nagar, Bengaluru',
    state: undefined,
    pincode: '560001',
    latitude: null,
    longitude: null,
    isDefault: false,
    fullAddress: '12 MG Road, Ashok Nagar, Bengaluru, undefined - 560001',
    createdAt,
    updatedAt: createdAt,
    ...extra,
  };
}

const SUGGESTED = {
  formattedAddress: '12 MG Road, Ashok Nagar, Bengaluru 560001',
  addressLine: '12 MG Road',
  locality: 'Ashok Nagar, Bengaluru',
  postalCode: '560001',
  placeId: 'place_mg_road',
  latitude: 12.9757,
  longitude: 77.6052,
};

async function rejectionOf(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    expect(caught).toBeInstanceOf(AppError);
    return caught as AppError;
  }
  throw new Error('Expected the call to reject');
}

let service: ApiAddressBookService;

beforeEach(() => {
  sent.length = 0;
  for (const method of ['log', 'warn', 'error'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
  service = new ApiAddressBookService();
});

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

it('is live', () => {
  expect(AppConfig.services.live).toContain('addressBook');
});

describe('createAddress', () => {
  it('sends only what the app holds, never a state, and answers with the list read again', async () => {
    backendAnswers(config => (config.method === 'post' ? ok(addressRow(A, '2026-11-17T12:00:00.000Z')) : ok([])));

    await service.createAddress(SUGGESTED);

    expect(calls()).toEqual([
      ['get', '/addresses'],
      ['post', '/addresses'],
      ['get', '/addresses'],
    ]);
    expect(bodyOf(sent[1])).toEqual({
      addressLine1: '12 MG Road',
      city: 'Ashok Nagar, Bengaluru',
      pincode: '560001',
      latitude: 12.9757,
      longitude: 77.6052,
      // The first one becomes the default.
      isDefault: true,
    });
    expect(JSON.stringify(bodyOf(sent[1]))).not.toMatch(/state|title|place_mg_road/);
  });

  it('does not take the default from an address that already has it', async () => {
    backendAnswers(config =>
      config.method === 'post' ? ok(addressRow(B, '2026-11-17T12:00:00.000Z')) : ok([addressRow(A, '2026-11-16T12:00:00.000Z', { isDefault: true })]),
    );

    await service.createAddress({ ...SUGGESTED, latitude: undefined, longitude: undefined });

    expect(bodyOf(sent[1])).toEqual({
      addressLine1: '12 MG Road',
      city: 'Ashok Nagar, Bengaluru',
      pincode: '560001',
      isDefault: false,
    });
  });

  it('uses the whole line as the first line when the source did not separate a street out', async () => {
    backendAnswers(config => (config.method === 'post' ? ok(addressRow(A, '2026-11-17T12:00:00.000Z')) : ok([])));

    await service.createAddress({ formattedAddress: 'Plot 7, Jayanagar', locality: 'Bengaluru', postalCode: '560011' });

    expect(bodyOf(sent[1])).toMatchObject({ addressLine1: 'Plot 7, Jayanagar', city: 'Bengaluru', pincode: '560011' });
  });

  it.each([
    ['a line typed by hand', { formattedAddress: '12 MG Road, Bengaluru' }, { addressLine1: '12 MG Road, Bengaluru' }],
    ['no PIN code', { formattedAddress: '12 MG Road', locality: 'Bengaluru' }, { addressLine1: '12 MG Road', city: 'Bengaluru' }],
    ['no town', { formattedAddress: '12 MG Road', postalCode: '560001' }, { addressLine1: '12 MG Road', pincode: '560001' }],
  ])('saves %s with exactly the parts it has — no town or PIN code is made up', async (_case, input, expected) => {
    backendAnswers(config => (config.method === 'post' ? ok(addressRow(A, '2026-11-17T12:00:00.000Z')) : ok([])));

    await service.createAddress(input);

    expect(bodyOf(sent[1])).toEqual({ ...expected, isDefault: true });
  });

  it('refuses an address with no line at all before sending', async () => {
    backendAnswers(() => ok([]));

    const error = await rejectionOf(service.createAddress({ formattedAddress: '   ' }));

    expect(sent).toHaveLength(0);
    expect(error.kind).toBe('validation');
  });

  it('reads the backend refusing the address as a validation error in the app’s words', async () => {
    backendAnswers(config =>
      config.method === 'post'
        ? { status: 400, body: { success: false, message: '"city" x', code: 'VALIDATION_FAILED', data: null, errors: [{ field: 'city', message: 'x' }] } }
        : ok([]),
    );

    const error = await rejectionOf(service.createAddress(SUGGESTED));

    expect(error.kind).toBe('validation');
    expect(error.userMessage).not.toContain('"city"');
  });
});

describe('updateAddress', () => {
  it('replaces the address by id — what it lacks cleared — then reads the list again', async () => {
    backendAnswers(config => (config.method === 'post' ? ok(addressRow(A, '2026-11-15T12:00:00.000Z')) : ok([])));

    await service.updateAddress(A, { ...SUGGESTED, latitude: undefined, longitude: undefined });

    expect(calls()).toEqual([
      ['post', '/addresses/update'],
      ['get', '/addresses'],
    ]);
    expect(bodyOf(sent[0])).toEqual({
      id: A,
      addressLine1: '12 MG Road',
      addressLine2: null,
      city: 'Ashok Nagar, Bengaluru',
      state: null,
      pincode: '560001',
      latitude: null,
      longitude: null,
    });
    // Which address is default is never changed by an edit.
    expect(bodyOf(sent[0])).not.toHaveProperty('isDefault');
  });

  it('clears the old town, PIN code and state when the new address is a typed line', async () => {
    backendAnswers(config => (config.method === 'post' ? ok(addressRow(A, '2026-11-15T12:00:00.000Z')) : ok([])));

    await service.updateAddress(A, { formattedAddress: 'Flat 2, 4th Cross, Bengaluru' });

    expect(bodyOf(sent[0])).toEqual({
      id: A,
      addressLine1: 'Flat 2, 4th Cross, Bengaluru',
      addressLine2: null,
      city: null,
      state: null,
      pincode: null,
      latitude: null,
      longitude: null,
    });
  });

  it('reads an address that is not the customer’s as not found', async () => {
    backendAnswers(() => ({ status: 404, body: { success: false, message: 'Address not found.', code: 'NOT_FOUND', data: null, errors: null } }));

    const error = await rejectionOf(service.updateAddress(A, SUGGESTED));

    expect(error.kind).toBe('notFound');
  });
});

describe('listAddresses', () => {
  it('reads each address field by field, the default first, then the order they were added', async () => {
    backendAnswers(() =>
      ok([
        // Newest first, as the backend sorts.
        addressRow(C, '2026-11-17T12:00:00.000Z', { latitude: 12.97, longitude: 77.59 }),
        addressRow(B, '2026-11-16T12:00:00.000Z', { isDefault: true, addressLine2: 'Flat 4' }),
        // Written elsewhere, with a state.
        addressRow(A, '2026-11-15T12:00:00.000Z', {
          addressLine1: '742 Evergreen Terrace',
          city: 'Springfield',
          state: 'IL',
          pincode: '62704',
        }),
        // A typed line, saved alone: the backend stores the cleared parts as ''.
        addressRow('6afc3e5d7c2e50812e44de94', '2026-11-14T12:00:00.000Z', {
          addressLine1: 'Flat 2, 4th Cross, Bengaluru',
          city: '',
          state: '',
          pincode: '',
        }),
      ]),
    );

    const addresses = await service.listAddresses();

    expect(sent[0].method).toBe('get');
    expect(sent[0].url).toBe('/addresses');
    expect(addresses.map(address => address.id)).toEqual([B, '6afc3e5d7c2e50812e44de94', A, C]);
    expect(addresses[1]).toEqual({
      id: '6afc3e5d7c2e50812e44de94',
      formattedAddress: 'Flat 2, 4th Cross, Bengaluru',
      addressLine: 'Flat 2, 4th Cross, Bengaluru',
      isDefault: false,
    });
    expect(addresses[0]).toEqual({
      id: B,
      formattedAddress: '12 MG Road, Flat 4, Ashok Nagar, Bengaluru 560001',
      addressLine: '12 MG Road, Flat 4',
      locality: 'Ashok Nagar, Bengaluru',
      postalCode: '560001',
      isDefault: true,
    });
    expect(addresses[2].formattedAddress).toBe('742 Evergreen Terrace, Springfield, IL 62704');
    expect(addresses[3]).toMatchObject({ formattedAddress: '12 MG Road, Ashok Nagar, Bengaluru 560001', latitude: 12.97, longitude: 77.59 });
    const serialised = JSON.stringify(addresses);
    expect(serialised).not.toContain('undefined');
    expect(serialised).not.toMatch(/customerId|"title"|_id|createdAt/);
  });

  it('keeps one default when the backend flags two', async () => {
    backendAnswers(() =>
      ok([
        addressRow(B, '2026-11-16T12:00:00.000Z', { isDefault: true }),
        addressRow(A, '2026-11-15T12:00:00.000Z', { isDefault: true }),
      ]),
    );

    const addresses = await service.listAddresses();

    expect(addresses.filter(address => address.isDefault)).toHaveLength(1);
  });

  it('answers a customer with none with an empty list', async () => {
    backendAnswers(() => ok([]));

    await expect(service.listAddresses()).resolves.toEqual([]);
  });

  it('refuses an address with no line at all as a server fault', async () => {
    backendAnswers(() => ok([addressRow(A, '2026-11-15T12:00:00.000Z', { addressLine1: '' })]));

    const error = await rejectionOf(service.listAddresses());

    expect(error.kind).toBe('server');
  });
});

describe('default and delete', () => {
  it('makes one the default by id, then answers with the whole list read again', async () => {
    backendAnswers(config =>
      config.method === 'post' ? ok(addressRow(A, '2026-11-15T12:00:00.000Z')) : ok([addressRow(A, '2026-11-15T12:00:00.000Z', { isDefault: true })]),
    );

    const addresses = await service.setDefaultAddress(A);

    expect(calls()).toEqual([
      ['post', '/addresses/default'],
      ['get', '/addresses'],
    ]);
    expect(bodyOf(sent[0])).toEqual({ id: A });
    expect(addresses[0].isDefault).toBe(true);
  });

  it('deletes with the id in the body of a DELETE, then reads the list again', async () => {
    backendAnswers(config =>
      config.method === 'delete' ? ok(null) : ok([addressRow(B, '2026-11-16T12:00:00.000Z', { isDefault: true })]),
    );

    await service.deleteAddress(A);

    expect(calls()).toEqual([
      ['delete', '/addresses/delete'],
      ['get', '/addresses'],
    ]);
    expect(bodyOf(sent[0])).toEqual({ id: A });
  });

  it('gives the default to the most recently added when the default is deleted', async () => {
    let promoted = false;
    backendAnswers(config => {
      if (config.method === 'delete') {
        return ok(null);
      }
      if (config.method === 'post') {
        promoted = true;
        return ok(addressRow(C, '2026-11-17T12:00:00.000Z', { isDefault: true }));
      }
      return ok([
        addressRow(C, '2026-11-17T12:00:00.000Z', { isDefault: promoted }),
        addressRow(B, '2026-11-16T12:00:00.000Z'),
      ]);
    });

    const addresses = await service.deleteAddress(A);

    expect(calls()).toEqual([
      ['delete', '/addresses/delete'],
      ['get', '/addresses'],
      ['post', '/addresses/default'],
      ['get', '/addresses'],
    ]);
    expect(bodyOf(sent[2])).toEqual({ id: C });
    expect(addresses.map(address => [address.id, address.isDefault])).toEqual([
      [C, true],
      [B, false],
    ]);
  });

  it('leaves an empty book empty, with no default to promote', async () => {
    backendAnswers(config => (config.method === 'delete' ? ok(null) : ok([])));

    await expect(service.deleteAddress(A)).resolves.toEqual([]);
    expect(sent).toHaveLength(2);
  });
});
