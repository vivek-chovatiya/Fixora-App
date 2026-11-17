/**
 * Availability and working hours on the mock vendor profile (PROJECT_BIBLE.md
 * section 38, "Working Hours", "Availability" and "Manage Availability").
 *
 * It stands in for a backend, so what is pinned here is the backend's side:
 *
 * - a vendor who has never set either is accepting new requests and works the
 *   default week (Monday to Saturday, nine to seven; Sunday closed) — before
 *   setup as well as after
 * - `setAcceptingRequests` and `updateWorkingHours` answer with the whole
 *   profile, survive a restart, and set exactly what they were sent
 * - they re-check like a server: a flag that is not true or false; a week that
 *   is not the seven days Monday first, an open day without both times, a
 *   time not `HH:mm`, closing at or before opening, a closed day with times —
 *   and a refusal changes nothing
 * - a write that cannot be stored did not happen
 * - saving the profile form never touches either, whatever it is sent, and a
 *   change and a shop-image save in flight both land
 * - whose they are is the session's: no session and a customer are refused, a
 *   vendor not set up has nowhere to keep them, one vendor never sees another's
 *
 * And the store's side: a record written before either existed still reads (as
 * the defaults, under the same schema version), a set record reads back, and a
 * corrupt value makes the record read as none, as any corrupt field does.
 *
 * Run against the real AsyncStorage-backed storage (jest.setup.js's in-memory
 * AsyncStorage), so persistence and scoping are tested end to end.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import type { AuthUser } from '@/features/auth/types';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import {
  AsyncStorageMockVendorProfiles,
  type StoredVendorProfile,
} from '@/shared/services/mock/MockVendorProfileStorage';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import type {
  VendorProfileUpdate,
  VendorWorkingDay,
} from '@/shared/services/types/VendorProfileService';
import { AppError } from '@/shared/types/error';

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

const MEENA: AuthUser = {
  id: 'usr_vendor_2',
  firstName: 'Meena',
  lastName: 'Iyer',
  phone: '9000000002',
  role: 'vendor',
};

const ASHA: AuthUser = {
  id: 'usr_customer_1',
  firstName: 'Asha',
  lastName: 'Patel',
  phone: '9876543210',
  role: 'customer',
};

const KUMAR: VendorProfileUpdate = {
  businessName: 'Kumar Electricals',
  description: 'Wiring, fittings and repairs since 2009.',
  serviceCategoryIds: ['cat_electrician'],
  serviceArea: { description: 'Koramangala and HSR Layout' },
};

const open = (day: string, opensAt: string, closesAt: string): VendorWorkingDay => ({
  day,
  isOpen: true,
  opensAt,
  closesAt,
});
const closed = (day: string): VendorWorkingDay => ({ day, isOpen: false });

/** The week a vendor has before they set their own — the app's stated assumption. */
const DEFAULT_WEEK: VendorWorkingDay[] = [
  open('MON', '09:00', '19:00'),
  open('TUE', '09:00', '19:00'),
  open('WED', '09:00', '19:00'),
  open('THU', '09:00', '19:00'),
  open('FRI', '09:00', '19:00'),
  open('SAT', '09:00', '19:00'),
  closed('SUN'),
];

/** A week of the vendor's own: shorter Saturdays, Wednesday off, Sunday mornings. */
const OWN_WEEK: VendorWorkingDay[] = [
  open('MON', '08:00', '18:00'),
  open('TUE', '08:00', '18:00'),
  closed('WED'),
  open('THU', '08:00', '18:00'),
  open('FRI', '08:00', '18:00'),
  open('SAT', '10:00', '14:30'),
  open('SUN', '07:30', '12:00'),
];

const KEY = `${AppConfig.storage.mockVendorProfileKey}/${RAVI.id}`;

let user: AuthUser | null;
let storage: AsyncStorageMockVendorProfiles;

function service() {
  return new MockVendorProfileService({
    latency: NO_LATENCY,
    storage,
    currentUser: async () => user,
  });
}

async function kindOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (caught) {
    return AppError.from(caught).kind;
  }
  return 'resolved';
}

/** What a fresh service — a restarted app — reads back. */
async function stored() {
  const { acceptingRequests, workingHours } = await service().getProfile();
  return { acceptingRequests, workingHours };
}

/** A copy of a week with one day replaced. */
function withDay(week: VendorWorkingDay[], index: number, day: unknown): VendorWorkingDay[] {
  return week.map((entry, at) => (at === index ? (day as VendorWorkingDay) : entry));
}

const put = (value: unknown) => AsyncStorage.setItem(KEY, JSON.stringify(value));

beforeEach(async () => {
  await AsyncStorage.clear();
  storage = new AsyncStorageMockVendorProfiles();
  user = RAVI;
  await service().saveProfile(KUMAR);
});

describe('Availability — the defaults', () => {
  it('starts a vendor accepting new requests, on the default week', async () => {
    expect(await stored()).toEqual({ acceptingRequests: true, workingHours: DEFAULT_WEEK });
  });

  it('gives a vendor who has not set up the same — "not set up" is still an answer', async () => {
    user = MEENA;

    const profile = await service().getProfile();
    expect(profile.isSetupComplete).toBe(false);
    expect(profile.acceptingRequests).toBe(true);
    expect(profile.workingHours).toEqual(DEFAULT_WEEK);
  });

  it('carries no times on a closed day — absent, not blank', async () => {
    const sunday = (await service().getProfile()).workingHours[6];

    expect(Object.keys(sunday).sort()).toEqual(['day', 'isOpen']);
  });

  it('hands out copies: changing an answer changes nothing stored, and never the defaults', async () => {
    const answer = await service().getProfile();
    answer.workingHours[0].opensAt = '05:00';
    answer.workingHours.pop();

    expect((await stored()).workingHours).toEqual(DEFAULT_WEEK);
    user = MEENA;
    expect((await service().getProfile()).workingHours).toEqual(DEFAULT_WEEK);
  });
});

describe('Availability — turning new requests on and off', () => {
  it('turns them off, answers with the whole profile, and survives a restart', async () => {
    const saved = await service().setAcceptingRequests(false);

    expect(saved).toMatchObject({ ...KUMAR, vendorId: RAVI.id, isSetupComplete: true });
    expect(saved.acceptingRequests).toBe(false);
    expect((await stored()).acceptingRequests).toBe(false);
  });

  it('turns them back on', async () => {
    await service().setAcceptingRequests(false);

    await expect(service().setAcceptingRequests(true)).resolves.toMatchObject({
      acceptingRequests: true,
    });
    expect((await stored()).acceptingRequests).toBe(true);
  });

  it('asking for what is already stored succeeds and changes nothing', async () => {
    await service().setAcceptingRequests(false);

    await expect(service().setAcceptingRequests(false)).resolves.toMatchObject({
      acceptingRequests: false,
    });
    expect((await stored()).acceptingRequests).toBe(false);
  });

  it('leaves the working hours alone', async () => {
    await service().updateWorkingHours(OWN_WEEK);

    await service().setAcceptingRequests(false);

    expect((await stored()).workingHours).toEqual(OWN_WEEK);
  });

  it.each([
    ['text', 'false'],
    ['a number', 0],
    ['nothing', undefined],
    ['null', null],
  ])('refuses %s, and changes nothing', async (_case, value) => {
    await service().setAcceptingRequests(false);

    expect(await kindOf(() => service().setAcceptingRequests(value as unknown as boolean))).toBe(
      'validation',
    );
    expect((await stored()).acceptingRequests).toBe(false);
  });

  it('changes nothing when it cannot be stored', async () => {
    // One-shot on the existing mock; `spyOn` + `mockRestore` would strip its implementation.
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    expect(await kindOf(() => service().setAcceptingRequests(false))).toBe('unknown');
    expect((await stored()).acceptingRequests).toBe(true);
  });
});

describe('Working hours — setting the week', () => {
  it('stores exactly the week sent and answers with the whole profile', async () => {
    const saved = await service().updateWorkingHours(OWN_WEEK);

    expect(saved.workingHours).toEqual(OWN_WEEK);
    expect(saved).toMatchObject({ ...KUMAR, acceptingRequests: true, isSetupComplete: true });
    expect((await stored()).workingHours).toEqual(OWN_WEEK);
  });

  it('accepts every day closed, and every day open', async () => {
    const shut = DEFAULT_WEEK.map(day => closed(day.day));
    await expect(service().updateWorkingHours(shut)).resolves.toMatchObject({ workingHours: shut });

    const always = DEFAULT_WEEK.map(day => open(day.day, '00:00', '23:30'));
    await expect(service().updateWorkingHours(always)).resolves.toMatchObject({
      workingHours: always,
    });
  });

  it('accepts a time off the half hour — the backend has no half-hour rule', async () => {
    const week = withDay(OWN_WEEK, 0, open('MON', '08:15', '17:45'));

    await expect(service().updateWorkingHours(week)).resolves.toMatchObject({ workingHours: week });
  });

  it('keeps only what a day is: anything else sent on it is not stored', async () => {
    const week = withDay(OWN_WEEK, 0, { ...open('MON', '08:00', '18:00'), note: 'lunch at one' });

    const saved = await service().updateWorkingHours(week);

    expect(Object.keys(saved.workingHours[0]).sort()).toEqual([
      'closesAt',
      'day',
      'isOpen',
      'opensAt',
    ]);
    expect(await AsyncStorage.getItem(KEY)).not.toContain('lunch at one');
  });

  it('hands out copies: changing the week sent or the answer changes nothing stored', async () => {
    const sent = OWN_WEEK.map(day => ({ ...day }));
    const saved = await service().updateWorkingHours(sent);

    sent[0].opensAt = '05:00';
    saved.workingHours[1].closesAt = '23:00';

    expect((await stored()).workingHours).toEqual(OWN_WEEK);
  });

  it('leaves availability alone', async () => {
    await service().setAcceptingRequests(false);

    await service().updateWorkingHours(OWN_WEEK);

    expect((await stored()).acceptingRequests).toBe(false);
  });
});

describe('Working hours — what it refuses', () => {
  beforeEach(async () => {
    await service().updateWorkingHours(OWN_WEEK);
  });

  it.each([
    ['six days', OWN_WEEK.slice(0, 6)],
    ['eight days', [...OWN_WEEK, closed('SUN')]],
    ['no days', []],
    ['the days out of order', [OWN_WEEK[1], OWN_WEEK[0], ...OWN_WEEK.slice(2)]],
    ['a day twice', withDay(OWN_WEEK, 1, open('MON', '08:00', '18:00'))],
    ['a day it does not know', withDay(OWN_WEEK, 6, closed('HOLIDAY'))],
    ['a day in lower case', withDay(OWN_WEEK, 0, open('mon', '08:00', '18:00'))],
    ['an open day with no times', withDay(OWN_WEEK, 0, { day: 'MON', isOpen: true })],
    [
      'an open day with only an opening time',
      withDay(OWN_WEEK, 0, { day: 'MON', isOpen: true, opensAt: '08:00' }),
    ],
    [
      'a closed day with times',
      withDay(OWN_WEEK, 2, { ...open('WED', '08:00', '18:00'), isOpen: false }),
    ],
    ['a closed day with a blank time', withDay(OWN_WEEK, 2, { day: 'WED', isOpen: false, opensAt: '' })],
    ['a time without its leading zero', withDay(OWN_WEEK, 0, open('MON', '8:00', '18:00'))],
    ['a twelve-hour time', withDay(OWN_WEEK, 0, open('MON', '08:00', '6:00 PM'))],
    ['24:00', withDay(OWN_WEEK, 0, open('MON', '08:00', '24:00'))],
    ['a minute past 59', withDay(OWN_WEEK, 0, open('MON', '08:00', '18:60'))],
    ['seconds', withDay(OWN_WEEK, 0, open('MON', '08:00:00', '18:00:00'))],
    ['closing at opening', withDay(OWN_WEEK, 0, open('MON', '09:00', '09:00'))],
    ['closing before opening — an overnight shift', withDay(OWN_WEEK, 0, open('MON', '22:00', '06:00'))],
    ['open as text', withDay(OWN_WEEK, 0, { ...open('MON', '08:00', '18:00'), isOpen: 'yes' })],
    ['a day that is not an object', withDay(OWN_WEEK, 3, 'THU')],
    ['a day that is null', withDay(OWN_WEEK, 3, null)],
  ])('refuses %s, and changes nothing', async (_case, week) => {
    expect(await kindOf(() => service().updateWorkingHours(week as VendorWorkingDay[]))).toBe(
      'validation',
    );
    expect((await stored()).workingHours).toEqual(OWN_WEEK);
  });

  it('refuses something that is not a list, and changes nothing', async () => {
    expect(
      await kindOf(() => service().updateWorkingHours(OWN_WEEK[0] as unknown as VendorWorkingDay[])),
    ).toBe('validation');
    expect((await stored()).workingHours).toEqual(OWN_WEEK);
  });

  it('changes nothing when the week cannot be stored', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    expect(await kindOf(() => service().updateWorkingHours(DEFAULT_WEEK))).toBe('unknown');
    expect((await stored()).workingHours).toEqual(OWN_WEEK);
  });

  it('carries on after a refusal: the next change still lands', async () => {
    const profiles = service();

    expect(await kindOf(() => profiles.updateWorkingHours(OWN_WEEK.slice(1)))).toBe('validation');
    await profiles.updateWorkingHours(DEFAULT_WEEK);

    expect((await stored()).workingHours).toEqual(DEFAULT_WEEK);
  });
});

describe('Availability and working hours — and the rest of the profile', () => {
  it('both survive saving the form, whatever the form sends', async () => {
    await service().setAcceptingRequests(false);
    await service().updateWorkingHours(OWN_WEEK);

    const saved = await service().saveProfile({
      ...KUMAR,
      businessName: 'Kumar & Sons Electricals',
      // Smuggled in: the form has no such fields, and the service must not take them.
      acceptingRequests: true,
      workingHours: DEFAULT_WEEK,
    } as VendorProfileUpdate);

    expect(saved.businessName).toBe('Kumar & Sons Electricals');
    expect(saved.acceptingRequests).toBe(false);
    expect(saved.workingHours).toEqual(OWN_WEEK);
    expect(await stored()).toEqual({ acceptingRequests: false, workingHours: OWN_WEEK });
  });

  it('both survive a form that clears every optional field', async () => {
    await service().setAcceptingRequests(false);
    await service().updateWorkingHours(OWN_WEEK);

    await service().saveProfile({
      businessName: KUMAR.businessName,
      serviceCategoryIds: KUMAR.serviceCategoryIds,
    });

    expect(await stored()).toEqual({ acceptingRequests: false, workingHours: OWN_WEEK });
  });

  it('a form save that never knew either still leaves the defaults in place', async () => {
    await service().saveProfile({ ...KUMAR, description: 'Now with a van.' });

    expect(await stored()).toEqual({ acceptingRequests: true, workingHours: DEFAULT_WEEK });
  });

  it('applies a change and a shop-image save in flight one after the other — both land', async () => {
    const profiles = service();

    const photo = profiles.updateShopImages(['https://cdn.example.com/shop-1.jpg']);
    const off = profiles.setAcceptingRequests(false);
    const hours = profiles.updateWorkingHours(OWN_WEEK);
    const form = profiles.saveProfile({ ...KUMAR, description: 'Now with a van.' });
    await Promise.all([photo, off, hours, form]);

    const reloaded = await service().getProfile();
    expect(reloaded.shopImageUrls).toEqual(['https://cdn.example.com/shop-1.jpg']);
    expect(reloaded.acceptingRequests).toBe(false);
    expect(reloaded.workingHours).toEqual(OWN_WEEK);
    expect(reloaded.description).toBe('Now with a van.');
    // Each answer holds everything stored before it.
    await expect(hours).resolves.toMatchObject({ acceptingRequests: false });
  });

  it('a shop-image save keeps both', async () => {
    await service().setAcceptingRequests(false);
    await service().updateWorkingHours(OWN_WEEK);

    await service().updateShopImages(['https://cdn.example.com/shop-1.jpg']);

    expect(await stored()).toEqual({ acceptingRequests: false, workingHours: OWN_WEEK });
  });
});

describe('Availability and working hours — whose', () => {
  it('refuses when nobody is signed in', async () => {
    user = null;

    expect(await kindOf(() => service().setAcceptingRequests(false))).toBe('unauthorized');
    expect(await kindOf(() => service().updateWorkingHours(OWN_WEEK))).toBe('unauthorized');
    user = RAVI;
    expect(await stored()).toEqual({ acceptingRequests: true, workingHours: DEFAULT_WEEK });
  });

  it('refuses a customer', async () => {
    user = ASHA;

    expect(await kindOf(() => service().setAcceptingRequests(false))).toBe('unauthorized');
    expect(await kindOf(() => service().updateWorkingHours(OWN_WEEK))).toBe('unauthorized');
  });

  it('has nowhere to keep them for a vendor who has not set up — and does not set them up', async () => {
    user = MEENA;

    expect(await kindOf(() => service().setAcceptingRequests(false))).toBe('notFound');
    expect(await kindOf(() => service().updateWorkingHours(OWN_WEEK))).toBe('notFound');
    const meena = await service().getProfile();
    expect(meena.isSetupComplete).toBe(false);
    expect(meena.acceptingRequests).toBe(true);
    expect(meena.workingHours).toEqual(DEFAULT_WEEK);
  });

  it('refuses a bad week before asking whether the vendor is set up', async () => {
    user = MEENA;

    expect(await kindOf(() => service().updateWorkingHours([]))).toBe('validation');
  });

  it('never shows one vendor another vendor’s availability or week', async () => {
    await service().setAcceptingRequests(false);
    await service().updateWorkingHours(OWN_WEEK);

    user = MEENA;
    await service().saveProfile({ businessName: 'Iyer Interiors', serviceCategoryIds: ['cat_painter'] });
    expect(await stored()).toEqual({ acceptingRequests: true, workingHours: DEFAULT_WEEK });
    await service().updateWorkingHours(DEFAULT_WEEK.map(day => closed(day.day)));

    user = RAVI;
    expect(await stored()).toEqual({ acceptingRequests: false, workingHours: OWN_WEEK });
  });
});

describe('Availability and working hours — on the device', () => {
  it('reads a record written before either existed as the defaults, still setup complete', async () => {
    // Version 1, exactly as Phase 3E-10 wrote it: neither field at all.
    await put({ version: 1, profile: { ...KUMAR, shopImageUrls: ['https://cdn.example.com/a.jpg'] } });

    const profile = await service().getProfile();
    expect(profile.isSetupComplete).toBe(true);
    expect(profile.businessName).toBe(KUMAR.businessName);
    expect(profile.shopImageUrls).toEqual(['https://cdn.example.com/a.jpg']);
    expect(profile.acceptingRequests).toBe(true);
    expect(profile.workingHours).toEqual(DEFAULT_WEEK);
  });

  it('changes such a record without losing the business or its photos', async () => {
    await put({ version: 1, profile: { ...KUMAR, shopImageUrls: ['https://cdn.example.com/a.jpg'] } });

    await service().setAcceptingRequests(false);
    await service().updateWorkingHours(OWN_WEEK);

    const profile = await service().getProfile();
    expect(profile).toMatchObject({
      ...KUMAR,
      shopImageUrls: ['https://cdn.example.com/a.jpg'],
      acceptingRequests: false,
      workingHours: OWN_WEEK,
    });
  });

  it('reads both back under the same schema version', async () => {
    const record: StoredVendorProfile = { ...KUMAR, acceptingRequests: false, workingHours: OWN_WEEK };
    await storage.write(RAVI.id, record);

    await expect(storage.read(RAVI.id)).resolves.toEqual(record);
    expect(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '')).toEqual({ version: 1, profile: record });
  });

  it.each([
    ['availability as text', { acceptingRequests: 'false' }],
    ['availability as a number', { acceptingRequests: 0 }],
    ['availability that is null', { acceptingRequests: null }],
    ['a week that is not a list', { workingHours: 'Mon–Sat 9–7' }],
    ['a week that is null', { workingHours: null }],
    ['a week of six days', { workingHours: OWN_WEEK.slice(0, 6) }],
    ['a week out of order', { workingHours: [OWN_WEEK[6], ...OWN_WEEK.slice(0, 6)] }],
    ['a week with a bad time', { workingHours: withDay(OWN_WEEK, 0, open('MON', '8am', '18:00')) }],
    ['a week closing before it opens', { workingHours: withDay(OWN_WEEK, 0, open('MON', '18:00', '08:00')) }],
    [
      'a week with a closed day holding times',
      { workingHours: withDay(OWN_WEEK, 2, { ...open('WED', '08:00', '18:00'), isOpen: false }) },
    ],
  ])('treats a record with %s as no record, as any corrupt field is', async (_case, fields) => {
    await put({ version: 1, profile: { ...KUMAR, ...fields } });

    await expect(storage.read(RAVI.id)).resolves.toBeNull();
  });
});
