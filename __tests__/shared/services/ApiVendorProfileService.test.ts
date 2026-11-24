/**
 * ApiVendorProfileService reads the vendor's business from `GET /auth/me` and
 * writes it with `POST /vendors/update` (Phase 4A, 17/11/2026;
 * PROJECT_BIBLE.md section 38). Pinned here:
 *
 * - the field table both ways, and each write's exact body — always the
 *   signed-in vendor's own id (the backend checks no ownership);
 * - setup complete derived from the real record, and the working week read
 *   as stored — `[]` when never set — and saved alone (Phase 4B contract §6);
 * - photos as the image service gave them, sent as they are, read back through
 *   `toImageUrl`; a local file refused before anything is written (contract §2);
 * - cleared text sent as `""`, text the record never had not sent at all;
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

/** Where a host-free `/uploads/...` path loads from: the API's own origin (`uploadUrls.ts`). */
const API_ORIGIN = AppConfig.api.baseUrl.replace(/\/api\/v\d+\/?$/, '');
const UPLOADED_LOGO = '/uploads/profile/0123456789abcdef0123456789abcdef.jpg';
const UPLOADED_SHOP = '/uploads/shop/fedcba9876543210fedcba9876543210.webp';

/** A week as the backend stores one (contract §6): Monday first, Sunday closed with no times. */
const WEEK = [
  ...['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => ({
    day,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '19:00',
  })),
  { day: 'SUN', isOpen: false },
];

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
    workingHours: [],
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

  it('reads uploaded pictures as the API’s own address, and a seeded URL as it is', async () => {
    backend({
      'GET /auth/me': () =>
        ok(meRow({ profileImage: UPLOADED_LOGO, shopImages: [UPLOADED_SHOP, SHOP_A, 'shops/relative.jpg'] })),
    });

    const profile = await service.getProfile();

    expect(profile.imageUrl).toBe(`${API_ORIGIN}${UPLOADED_LOGO}`);
    // One that cannot load anywhere is left out rather than drawn broken.
    expect(profile.shopImageUrls).toEqual([`${API_ORIGIN}${UPLOADED_SHOP}`, SHOP_A]);
  });

  it('reads a stored week day by day, a closed day with no times', async () => {
    backend({ 'GET /auth/me': () => ok(meRow({ workingHours: WEEK })) });

    const profile = await service.getProfile();

    expect(profile.workingHours).toEqual(WEEK);
    expect(profile.workingHours[6]).not.toHaveProperty('opensAt');
  });

  it.each([
    ['never set', []],
    ['missing', undefined],
  ])('reads a week %s as the empty week, never an invented one', async (_name, workingHours) => {
    backend({ 'GET /auth/me': () => ok(meRow({ workingHours })) });

    expect((await service.getProfile()).workingHours).toEqual([]);
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

  it('sends a new profile picture exactly as the image service gave it — the backend keeps its path', async () => {
    const uploaded = `${API_ORIGIN}${UPLOADED_LOGO}`;
    backend({
      'GET /auth/me': () => ok(meRow()),
      'POST /vendors/update': () => ok(updatedRow({ profileImage: UPLOADED_LOGO })),
    });

    const saved = await service.saveProfile(update({ imageUrl: uploaded }));

    expect(sent[1].body).toMatchObject({ profileImage: uploaded });
    expect(saved.imageUrl).toBe(uploaded);
  });

  it('never clears a stored profile picture the app cannot show when other fields are saved (code review)', async () => {
    backend({
      'GET /auth/me': () => ok(meRow({ profileImage: 'kumar-logo.png' })),
      'POST /vendors/update': () => ok(updatedRow({ profileImage: 'kumar-logo.png' })),
    });

    // Shown as no picture, so the form sends none — that is "unchanged", not "removed".
    const profile = await service.getProfile();
    expect(profile).not.toHaveProperty('imageUrl');
    await service.saveProfile(update({ imageUrl: profile.imageUrl, description: 'Licensed electrician.' }));

    const write = sent.find(call => call.url === '/vendors/update');
    expect(write?.body).toMatchObject({ description: 'Licensed electrician.' });
    expect(write?.body).not.toHaveProperty('profileImage');
  });

  it('does not send an uploaded picture that is unchanged', async () => {
    backend({
      'GET /auth/me': () => ok(meRow({ profileImage: UPLOADED_LOGO })),
      'POST /vendors/update': () => ok(updatedRow({ profileImage: UPLOADED_LOGO })),
    });

    await service.saveProfile(update({ imageUrl: `${API_ORIGIN}${UPLOADED_LOGO}` }));

    expect(sent[1].body).not.toHaveProperty('profileImage');
  });

  it('refuses a picture that is not an uploaded image — a phone’s own file — and writes nothing', async () => {
    backend({});

    const error = await rejectionOf(service.saveProfile(update({ imageUrl: 'file:///data/user/0/com.fixora/cache/x.jpg' })));

    expect(error.kind).toBe('validation');
    expect(sent).toEqual([]);
  });

  it.each([
    ['the description', { description: undefined }, 'description'],
    ['the service area', { serviceArea: undefined }, 'address'],
  ])('clears %s the vendor removed by sending "" (contract §6)', async (_name, extra, key) => {
    backend({
      'GET /auth/me': () => ok(meRow()),
      'POST /vendors/update': () => ok(updatedRow({ [key]: '' })),
    });

    const saved = await service.saveProfile(update(extra));

    expect(sent[1].body?.[key]).toBe('');
    expect(saved).not.toHaveProperty(key === 'address' ? 'serviceArea' : 'description');
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
  it('reads the record, then saves a removal or a new order alone, with the vendor’s own id', async () => {
    backend({
      'GET /auth/me': () => ok(meRow()),
      'POST /vendors/update': () => ok(updatedRow({ shopImages: [SHOP_B] })),
    });

    const profile = await service.updateShopImages([SHOP_B]);

    expect(sent.map(call => `${call.method} ${call.url}`)).toEqual(['GET /auth/me', 'POST /vendors/update']);
    expect(sent[1].body).toEqual({ id: ME, shopImages: [SHOP_B] });
    expect(profile.shopImageUrls).toEqual([SHOP_B]);
  });

  it('sends a new photo beside the kept ones, in order, exactly as the image service gave it', async () => {
    const uploaded = `${API_ORIGIN}${UPLOADED_SHOP}`;
    backend({
      'GET /auth/me': () => ok(meRow()),
      'POST /vendors/update': () => ok(updatedRow({ shopImages: [SHOP_A, SHOP_B, UPLOADED_SHOP] })),
    });

    const profile = await service.updateShopImages([SHOP_A, SHOP_B, uploaded]);

    expect(sent[1].body).toEqual({ id: ME, shopImages: [SHOP_A, SHOP_B, uploaded] });
    expect(profile.shopImageUrls).toEqual([SHOP_A, SHOP_B, uploaded]);
  });

  it('never deletes a stored photo the app cannot show — it survives a photo added and another removed (code review)', async () => {
    const uploaded = `${API_ORIGIN}${UPLOADED_SHOP}`;
    // A seeded, web-view value: not a path the app can load, but the vendor's all the same.
    const stored = [SHOP_A, 'shop1.jpg', SHOP_B];
    backend({
      'GET /auth/me': () => ok(meRow({ shopImages: stored })),
      'POST /vendors/update': body => ok(updatedRow({ shopImages: body?.shopImages })),
    });

    const shown = (await service.getProfile()).shopImageUrls;
    expect(shown).toEqual([SHOP_A, SHOP_B]);

    // Remove SHOP_A, add a new one — the list the screen sends is only what it can see.
    await service.updateShopImages([SHOP_B, uploaded]);

    expect(sent[2].body).toEqual({ id: ME, shopImages: [SHOP_B, uploaded, 'shop1.jpg'] });
  });

  it('refuses to change the photos when the record read first is not this vendor’s, and writes nothing', async () => {
    backend({ 'GET /auth/me': () => ok(meRow({ id: '6afc3ff63331bf0e0e5835ff' })) });

    expect((await rejectionOf(service.updateShopImages([SHOP_A]))).kind).toBe('server');
    expect(sent.map(call => call.url)).toEqual(['/auth/me']);
  });

  it('rejects the backend’s refusal of a photo that is not this vendor’s upload as validation', async () => {
    backend({
      'GET /auth/me': () => ok(meRow()),
      'POST /vendors/update': () => fail(400, 'Validation Failed', 'VALIDATION_FAILED'),
    });

    expect((await rejectionOf(service.updateShopImages([SHOP_A]))).kind).toBe('validation');
  });

  it.each([
    ['a phone’s own file', ['file:///data/user/0/com.fixora/cache/x.jpg']],
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
  it('saves the week alone, with the vendor’s own id, and answers with the stored profile', async () => {
    backend({ 'POST /vendors/update': () => ok(updatedRow({ workingHours: WEEK })) });

    const profile = await service.updateWorkingHours(WEEK);

    expect(sent).toEqual([{ method: 'POST', url: '/vendors/update', body: { id: ME, workingHours: WEEK } }]);
    expect(profile.workingHours).toEqual(WEEK);
  });

  it('sends a closed day without times, and each day with the contract’s keys only', async () => {
    backend({ 'POST /vendors/update': () => ok(updatedRow({ workingHours: WEEK })) });
    const days = WEEK.map(day => ({ ...day, note: 'stray' }));
    // A closed day carrying times the form kept behind the switch.
    days[6] = { day: 'SUN', isOpen: false, opensAt: '10:00', closesAt: '14:00', note: 'stray' } as never;

    await service.updateWorkingHours(days);

    const sentWeek = sent[0].body?.workingHours as Record<string, unknown>[];
    expect(Object.keys(sentWeek[0]).sort()).toEqual(['closesAt', 'day', 'isOpen', 'opensAt']);
    expect(sentWeek[6]).toEqual({ day: 'SUN', isOpen: false });
  });

  it('rejects the backend’s refusal of a week — closing before opening, six days — as validation', async () => {
    backend({ 'POST /vendors/update': () => fail(400, 'Validation Failed', 'VALIDATION_FAILED') });

    expect((await rejectionOf(service.updateWorkingHours(WEEK.slice(0, 6)))).kind).toBe('validation');
  });

  it('refuses something that is not a list of days as validation, before anything is sent', async () => {
    backend({});

    expect((await rejectionOf(service.updateWorkingHours('every day' as never))).kind).toBe('validation');
    expect((await rejectionOf(service.updateWorkingHours([null] as never))).kind).toBe('validation');
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
