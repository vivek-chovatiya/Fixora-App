/**
 * ApiVendorProfileService reads the vendor's business from `GET /auth/me` and
 * writes it with `POST /vendors/update` (Phase 4A, 17/11/2026;
 * PROJECT_BIBLE.md section 38). Pinned here:
 *
 * - the field table both ways, and each write's exact body — always the
 *   signed-in vendor's own id (the backend checks no ownership);
 * - setup complete derived from the real record, and an empty week where the
 *   backend keeps no hours;
 * - what the backend cannot do refused before anything is written: a new photo
 *   (no upload endpoint), clearing text it cannot clear, saving working hours;
 * - a profile answered for anybody else refused, and `_id` never passing.
 *
 * The backend is a fake axios adapter on the real HttpClient: no network.
 */

import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';

import { AppConfig } from '@/core/config/AppConfig';
import { httpClient } from '@/core/http/HttpClient';
import type { AuthUser } from '@/features/auth/types';
import { ApiVendorProfileService } from '@/shared/services/api/ApiVendorProfileService';
import type { VendorProfileUpdate } from '@/shared/services/types/VendorProfileService';
import { AppError } from '@/shared/types/error';

type Reply = { status: number; body: unknown } | 'network';
type Route = (body: Record<string, unknown> | undefined) => Reply;

const sent: { method: string; url: string; body: Record<string, unknown> | undefined }[] = [];
const unrouted: string[] = [];
const originalAdapter = httpClient.defaults.adapter;

function backend(routes: Record<string, Route>): void {
  const adapter: AxiosAdapter = async config => {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : undefined;
    const method = (config.method ?? 'get').toUpperCase();
    sent.push({ method, url: config.url ?? '', body });
    const route = routes[`${method} ${config.url}`];
    if (!route) {
      unrouted.push(`${method} ${config.url}`);
      throw new AxiosError('No route in the fake backend', AxiosError.ERR_NETWORK, config);
    }
    const answer = route(body);
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

const ok = (data: unknown): Reply => ({
  status: 200,
  body: { success: true, message: 'Done.', data, meta: {}, errors: null },
});
const fail = (status: number, message: string, code?: string): Reply => ({
  status,
  body: { success: false, message, code, errors: null, data: null },
});

const ME = '6afc3ff63331bf0e0e5835a9';
const ELECTRICAL = '6afc3ff63331bf0e0e583590';
const APPLIANCE = '6afc3ff63331bf0e0e583592';
const LOGO = 'https://cdn.example.com/vendors/kumar.jpg';
const SHOP_A = 'https://cdn.example.com/shops/a.jpg';
const SHOP_B = 'https://cdn.example.com/shops/b.jpg';

/** `GET /auth/me` for a vendor: `vendorMapper` (categories populated) plus the session user's fields. */
function meRow(extra: Record<string, unknown> = {}) {
  return {
    id: ME,
    businessName: 'Kumar Electricals',
    ownerName: 'Ravi Kumar',
    ownerFirstName: 'Ravi',
    ownerLastName: 'Kumar',
    email: 'ravi@example.com',
    phone: '9000000001',
    categoryIds: [
      { _id: ELECTRICAL, name: 'Electrical', slug: 'electrical', __v: 0 },
      { _id: APPLIANCE, name: 'AC & Appliance', slug: 'ac-appliance', __v: 0 },
    ],
    address: 'Koramangala and HSR Layout',
    description: 'Certified electrician.',
    profileImage: LOGO,
    shopImages: [SHOP_A, SHOP_B],
    documents: ['https://cdn.example.com/docs/licence.pdf'],
    averageRating: 4.9,
    totalReviews: 42,
    approvalStatus: 'APPROVED',
    availability: true,
    status: 'ACTIVE',
    createdAt: '2026-11-17T11:52:22.074Z',
    updatedAt: '2026-11-17T11:52:22.074Z',
    firstName: 'Ravi',
    lastName: 'Kumar',
    role: 'vendor',
    avatarUrl: LOGO,
    ...extra,
  };
}

/** What `/vendors/update` answers: `vendorMapper`, categories as bare ids. */
function updatedRow(extra: Record<string, unknown> = {}) {
  const vendor: Record<string, unknown> = { ...meRow(), categoryIds: [ELECTRICAL, APPLIANCE] };
  // No session-user fields: those are `/auth/me`'s additions.
  for (const key of ['firstName', 'lastName', 'role', 'avatarUrl']) {
    delete vendor[key];
  }
  return { ...vendor, ...extra };
}

const vendor: AuthUser = { id: ME, firstName: 'Ravi', lastName: 'Kumar', phone: '9000000001', role: 'vendor' };
let session: AuthUser | null;
let service: ApiVendorProfileService;

const update = (extra: Partial<VendorProfileUpdate> = {}): VendorProfileUpdate => ({
  businessName: 'Kumar Electricals',
  description: 'Certified electrician.',
  serviceCategoryIds: [ELECTRICAL, APPLIANCE],
  serviceArea: { description: 'Koramangala and HSR Layout' },
  imageUrl: LOGO,
  ...extra,
});

async function rejectionOf(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    expect(caught).toBeInstanceOf(AppError);
    return caught as AppError;
  }
  throw new Error('Expected the call to reject');
}

beforeEach(() => {
  sent.length = 0;
  unrouted.length = 0;
  session = vendor;
  for (const method of ['log', 'warn', 'error', 'info', 'debug'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
  service = new ApiVendorProfileService({ currentUser: async () => session });
});

afterEach(() => {
  expect(unrouted).toEqual([]);
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

describe('getProfile', () => {
  it('reads the signed-in vendor’s own record, field by field', async () => {
    backend({ 'GET /auth/me': () => ok(meRow()) });

    const profile = await service.getProfile();

    expect(sent).toEqual([{ method: 'GET', url: '/auth/me', body: undefined }]);
    expect(profile).toEqual({
      vendorId: ME,
      businessName: 'Kumar Electricals',
      description: 'Certified electrician.',
      serviceCategoryIds: [ELECTRICAL, APPLIANCE],
      serviceArea: { description: 'Koramangala and HSR Layout' },
      imageUrl: LOGO,
      shopImageUrls: [SHOP_A, SHOP_B],
      acceptingRequests: true,
      workingHours: [],
      ownerName: 'Ravi Kumar',
      phone: '9000000001',
      email: 'ravi@example.com',
      isSetupComplete: true,
    });
    expect(JSON.stringify(profile)).not.toMatch(
      /_id|slug|documents|averageRating|approvalStatus|licence|createdAt/,
    );
  });

  it('falls back to the full owner name for a vendor registered by email', async () => {
    backend({
      'GET /auth/me': () => ok(meRow({ ownerFirstName: undefined, ownerLastName: undefined, ownerName: 'David Miller' })),
    });

    expect((await service.getProfile()).ownerName).toBe('David Miller');
  });

  it.each([
    ['no business name', { businessName: '' }],
    ['no categories', { categoryIds: [] }],
  ])('answers a record with %s as setup not complete, not as an error', async (_name, extra) => {
    backend({ 'GET /auth/me': () => ok(meRow(extra)) });

    expect((await service.getProfile()).isSetupComplete).toBe(false);
  });

  it('leaves blank fields absent and keeps an empty shop gallery a list', async () => {
    backend({
      'GET /auth/me': () =>
        ok(meRow({ description: '', address: '', profileImage: null, shopImages: [], email: undefined })),
    });

    const profile = await service.getProfile();

    for (const key of ['description', 'serviceArea', 'imageUrl', 'email']) {
      expect(profile).not.toHaveProperty(key);
    }
    expect(profile.shopImageUrls).toEqual([]);
  });

  it.each([
    ['for another vendor', { id: '6afc3ff63331bf0e0e5835ff' }],
    ['for a customer', { role: 'customer' }],
    ['without availability', { availability: undefined }],
    ['without a phone', { phone: '' }],
  ])('refuses a record %s as a server fault', async (_name, extra) => {
    backend({ 'GET /auth/me': () => ok(meRow(extra)) });

    expect((await rejectionOf(service.getProfile())).kind).toBe('server');
  });

  it.each([
    ['an expired session', fail(401, 'Invalid or expired authentication token.', 'UNAUTHORIZED'), 'unauthorized'],
    ['a server fault', fail(500, 'Internal Server Error', 'INTERNAL_ERROR'), 'server'],
    ['a dropped connection', 'network' as const, 'network'],
  ])('rejects %s as its own kind, so the gate shows its error state', async (_name, reply, kind) => {
    backend({ 'GET /auth/me': () => reply });

    expect((await rejectionOf(service.getProfile())).kind).toBe(kind);
  });
});

describe('saveProfile', () => {
  it('reads the record, then writes the business with the vendor’s own id — nothing the backend would not take', async () => {
    backend({ 'GET /auth/me': () => ok(meRow()), 'POST /vendors/update': () => ok(updatedRow()) });

    const saved = await service.saveProfile(
      update({ businessName: '  Kumar Electricals ', serviceCategoryIds: [ELECTRICAL, ELECTRICAL, APPLIANCE] }),
    );

    expect(sent.map(call => `${call.method} ${call.url}`)).toEqual(['GET /auth/me', 'POST /vendors/update']);
    // The photo is unchanged, so it is not sent at all.
    expect(sent[1].body).toEqual({
      id: ME,
      businessName: 'Kumar Electricals',
      categoryIds: [ELECTRICAL, APPLIANCE],
      description: 'Certified electrician.',
      address: 'Koramangala and HSR Layout',
    });
    expect(saved.serviceCategoryIds).toEqual([ELECTRICAL, APPLIANCE]);
    expect(saved.isSetupComplete).toBe(true);
  });

  it('never sends the phone — the sign-in number is identity and the backend refuses a change', async () => {
    backend({ 'GET /auth/me': () => ok(meRow()), 'POST /vendors/update': () => ok(updatedRow()) });

    // A caller that got around the types and slipped a phone in is still not heard.
    await service.saveProfile({ ...update(), phone: '9999999999' } as VendorProfileUpdate);
    await service.setAcceptingRequests(false);

    for (const call of sent.filter(entry => entry.url === '/vendors/update')) {
      expect(call.body).not.toHaveProperty('phone');
    }
    expect(JSON.stringify(sent)).not.toContain('9999999999');
  });

  it('clears a profile picture the vendor removed', async () => {
    backend({
      'GET /auth/me': () => ok(meRow()),
      'POST /vendors/update': () => ok(updatedRow({ profileImage: null })),
    });

    const saved = await service.saveProfile(update({ imageUrl: undefined }));

    expect(sent[1].body).toMatchObject({ profileImage: null });
    expect(saved).not.toHaveProperty('imageUrl');
  });

  it('refuses a new profile picture — there is nowhere to upload it — and writes nothing', async () => {
    backend({ 'GET /auth/me': () => ok(meRow()) });

    const error = await rejectionOf(service.saveProfile(update({ imageUrl: 'https://picsum.photos/seed/x/800/600' })));

    expect(error.kind).toBe('forbidden');
    expect(error.code).toBe('PHOTO_UPLOAD_NOT_SUPPORTED');
    expect(sent.map(call => call.url)).toEqual(['/auth/me']);
  });

  it.each([
    ['the description', { description: undefined }],
    ['the service area', { serviceArea: undefined }],
  ])('refuses clearing %s the backend cannot clear, and writes nothing', async (_name, extra) => {
    backend({ 'GET /auth/me': () => ok(meRow()) });

    const error = await rejectionOf(service.saveProfile(update(extra)));

    expect(error.code).toBe('PROFILE_TEXT_CLEAR_NOT_SUPPORTED');
    expect(error.isRetryable).toBe(false);
    expect(sent.map(call => call.url)).toEqual(['/auth/me']);
  });

  it('leaves out text the record never had, rather than sending an empty one', async () => {
    backend({
      'GET /auth/me': () => ok(meRow({ description: '', address: '', profileImage: null })),
      'POST /vendors/update': () => ok(updatedRow({ description: '', address: '', profileImage: null })),
    });

    await service.saveProfile(update({ description: '  ', serviceArea: undefined, imageUrl: undefined }));

    expect(sent[1].body).toEqual({ id: ME, businessName: 'Kumar Electricals', categoryIds: [ELECTRICAL, APPLIANCE] });
  });

  it.each([
    ['a blank business name', { businessName: '   ' }],
    ['no categories', { serviceCategoryIds: [' '] }],
  ])('refuses %s as validation, before anything is sent', async (_name, extra) => {
    backend({});

    expect((await rejectionOf(service.saveProfile(update(extra)))).kind).toBe('validation');
    expect(sent).toEqual([]);
  });

  it('rejects a backend validation failure as validation', async () => {
    backend({
      'GET /auth/me': () => ok(meRow()),
      'POST /vendors/update': () => fail(400, 'Validation Failed', 'VALIDATION_FAILED'),
    });

    expect((await rejectionOf(service.saveProfile(update()))).kind).toBe('validation');
  });
});

describe('setAcceptingRequests', () => {
  it.each([true, false])('sends availability %p alone, with the vendor’s own id', async accepting => {
    backend({ 'POST /vendors/update': () => ok(updatedRow({ availability: accepting })) });

    const profile = await service.setAcceptingRequests(accepting);

    expect(sent).toEqual([{ method: 'POST', url: '/vendors/update', body: { id: ME, availability: accepting } }]);
    expect(profile.acceptingRequests).toBe(accepting);
  });

  it('refuses anything but true or false, before anything is sent', async () => {
    backend({});

    expect((await rejectionOf(service.setAcceptingRequests('yes' as never))).kind).toBe('validation');
    expect(sent).toEqual([]);
  });
});

describe('updateShopImages', () => {
  it('saves a removal or a new order of photos the backend already has', async () => {
    backend({
      'GET /auth/me': () => ok(meRow()),
      'POST /vendors/update': () => ok(updatedRow({ shopImages: [SHOP_B] })),
    });

    const profile = await service.updateShopImages([SHOP_B]);

    expect(sent[1]).toEqual({ method: 'POST', url: '/vendors/update', body: { id: ME, shopImages: [SHOP_B] } });
    expect(profile.shopImageUrls).toEqual([SHOP_B]);
  });

  it('refuses a photo the backend does not have — there is nowhere to upload it — and writes nothing', async () => {
    backend({ 'GET /auth/me': () => ok(meRow()) });

    const error = await rejectionOf(service.updateShopImages([SHOP_A, 'https://picsum.photos/seed/new/800/600']));

    expect(error.code).toBe('PHOTO_UPLOAD_NOT_SUPPORTED');
    expect(sent.map(call => call.url)).toEqual(['/auth/me']);
  });

  it.each([
    ['the same photo twice', [SHOP_A, SHOP_A]],
    ['more than the ceiling', Array.from({ length: AppConfig.image.maxShopImagesPerVendor + 1 }, (_, i) => `${SHOP_A}?${i}`)],
    ['a blank entry', [' ']],
  ])('refuses %s as validation, before anything is sent', async (_name, urls) => {
    backend({});

    expect((await rejectionOf(service.updateShopImages(urls))).kind).toBe('validation');
    expect(sent).toEqual([]);
  });
});

describe('updateWorkingHours', () => {
  it('refuses clearly — the backend keeps no hours — and sends nothing', async () => {
    backend({});

    const error = await rejectionOf(service.updateWorkingHours([]));

    expect(error.kind).toBe('forbidden');
    expect(error.code).toBe('WORKING_HOURS_NOT_SUPPORTED');
    expect(error.userMessage).toBe('Saving working hours is not available in the app yet.');
    expect(sent).toEqual([]);
  });
});

describe('the session', () => {
  it.each([
    ['nobody', null],
    ['a customer', { ...vendor, role: 'customer' as const }],
  ])('refuses %s as unauthorized on every call, sending nothing', async (_name, who) => {
    session = who;
    backend({});

    for (const call of [
      () => service.getProfile(),
      () => service.saveProfile(update()),
      () => service.updateShopImages([]),
      () => service.setAcceptingRequests(true),
      () => service.updateWorkingHours([]),
    ]) {
      expect((await rejectionOf(call())).kind).toBe('unauthorized');
    }
    expect(sent).toEqual([]);
  });
});
