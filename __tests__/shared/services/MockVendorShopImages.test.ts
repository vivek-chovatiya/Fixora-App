/**
 * Shop images on the mock vendor profile (PROJECT_BIBLE.md section 38, "Shop
 * Images" and "Upload Shop Images").
 *
 * It stands in for a backend, so what is pinned here is the backend's side:
 *
 * - the profile always carries a list — empty, never absent — in the order sent
 * - `updateShopImages` replaces the whole list and answers with the profile
 * - it re-checks like a server: the ceiling, uploaded URLs only, no URL twice,
 *   a list at all — and a refusal changes nothing
 * - a write that cannot be stored did not happen
 * - saving the profile form never touches the shop images, whatever it is sent
 * - changes are applied one at a time, so neither a quick second change nor a
 *   form save in flight can write an old list back
 * - whose images they are is the session's: no session and a customer are
 *   refused, a vendor not set up has nowhere to keep them, and one vendor
 *   never sees another's
 *
 * And the store's side: a record written before shop images existed still
 * reads (as none), a list reads back in order, and a corrupt list is treated
 * the way the store treats any corrupt field — as no record.
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
import type { VendorProfileUpdate } from '@/shared/services/types/VendorProfileService';
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
  imageUrl: 'https://example.com/kumar.jpg',
};

const MAX = AppConfig.image.maxShopImagesPerVendor;

const url = (n: number) => `https://cdn.example.com/shop-${n}.jpg`;

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
async function stored(): Promise<string[]> {
  return (await service().getProfile()).shopImageUrls;
}

const put = (value: unknown) => AsyncStorage.setItem(KEY, JSON.stringify(value));

beforeEach(async () => {
  await AsyncStorage.clear();
  storage = new AsyncStorageMockVendorProfiles();
  user = RAVI;
  await service().saveProfile(KUMAR);
});

describe('Shop images — the contract', () => {
  it('is an empty list, never absent, for a vendor who has added none', async () => {
    const profile = await service().getProfile();

    expect(profile.shopImageUrls).toEqual([]);
    expect('shopImageUrls' in profile).toBe(true);
  });

  it('stores the list in the order sent and answers with the whole profile', async () => {
    const saved = await service().updateShopImages([url(2), url(1), url(3)]);

    expect(saved.shopImageUrls).toEqual([url(2), url(1), url(3)]);
    expect(saved).toMatchObject({ ...KUMAR, vendorId: RAVI.id, isSetupComplete: true });
    expect(await stored()).toEqual([url(2), url(1), url(3)]);
  });

  it('replaces the whole list — removing one is the list without it', async () => {
    await service().updateShopImages([url(1), url(2), url(3)]);

    const saved = await service().updateShopImages([url(1), url(3)]);

    expect(saved.shopImageUrls).toEqual([url(1), url(3)]);
    expect(await stored()).toEqual([url(1), url(3)]);
  });

  it('can be emptied', async () => {
    await service().updateShopImages([url(1)]);

    await service().updateShopImages([]);

    expect(await stored()).toEqual([]);
  });

  it('trims what it is sent, as every other value is', async () => {
    const saved = await service().updateShopImages([`  ${url(1)} `]);

    expect(saved.shopImageUrls).toEqual([url(1)]);
  });

  it('accepts exactly the ceiling', async () => {
    const all = Array.from({ length: MAX }, (_, index) => url(index + 1));

    await expect(service().updateShopImages(all)).resolves.toMatchObject({ shopImageUrls: all });
  });

  it('hands out copies: changing an answer or the list sent changes nothing stored', async () => {
    const sent = [url(1)];
    const saved = await service().updateShopImages(sent);

    sent.push(url(2));
    saved.shopImageUrls.push(url(3));
    (await service().getProfile()).shopImageUrls.push(url(4));

    expect(await stored()).toEqual([url(1)]);
  });

  it('keeps them in memory too, when there is no storage', async () => {
    const memory = new MockVendorProfileService({ latency: NO_LATENCY, currentUser: async () => user });
    await memory.saveProfile(KUMAR);

    await memory.updateShopImages([url(1)]);
    const answer = await memory.getProfile();
    answer.shopImageUrls.push(url(2));

    expect((await memory.getProfile()).shopImageUrls).toEqual([url(1)]);
  });
});

describe('Shop images — what it refuses', () => {
  beforeEach(async () => {
    await service().updateShopImages([url(1)]);
  });

  it.each([
    ['one more than the ceiling', Array.from({ length: MAX + 1 }, (_, index) => url(index + 1))],
    ['the same URL twice', [url(1), url(2), url(1)]],
    ['the same URL twice once trimmed', [url(2), ` ${url(2)}`]],
    ['a local file', ['file:///data/user/0/com.fixora/cache/shop.jpg']],
    ['a blank entry', [url(2), '   ']],
    ['an empty string', ['']],
    ['something that is not a URL', ['shop front']],
    ['a scheme and nothing else', ['https://']],
    ['an entry that is not text', [42]],
  ])('refuses %s, and changes nothing', async (_case, list) => {
    expect(await kindOf(() => service().updateShopImages(list as string[]))).toBe('validation');
    expect(await stored()).toEqual([url(1)]);
  });

  it('refuses something that is not a list, and changes nothing', async () => {
    expect(
      await kindOf(() => service().updateShopImages(url(2) as unknown as string[])),
    ).toBe('validation');
    expect(await stored()).toEqual([url(1)]);
  });

  it('changes nothing when the list cannot be stored', async () => {
    // One-shot on the existing mock; `spyOn` + `mockRestore` would strip its implementation.
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    expect(await kindOf(() => service().updateShopImages([url(1), url(2)]))).toBe('unknown');
    expect(await stored()).toEqual([url(1)]);
  });

  it('carries on after a refusal: the next change still lands', async () => {
    const profiles = service();

    expect(await kindOf(() => profiles.updateShopImages([url(1), url(1)]))).toBe('validation');
    await profiles.updateShopImages([url(1), url(2)]);

    expect(await stored()).toEqual([url(1), url(2)]);
  });
});

describe('Shop images — and the profile form', () => {
  it('survives saving the form, whatever the form sends', async () => {
    await service().updateShopImages([url(1), url(2)]);

    const saved = await service().saveProfile({
      ...KUMAR,
      businessName: 'Kumar & Sons Electricals',
      // Smuggled in: the form has no such field, and the service must not take it.
      shopImageUrls: [],
    } as VendorProfileUpdate);

    expect(saved.businessName).toBe('Kumar & Sons Electricals');
    expect(saved.shopImageUrls).toEqual([url(1), url(2)]);
    expect(await stored()).toEqual([url(1), url(2)]);
  });

  it('survives a form that clears every optional field', async () => {
    await service().updateShopImages([url(1)]);

    await service().saveProfile({
      businessName: KUMAR.businessName,
      serviceCategoryIds: KUMAR.serviceCategoryIds,
    });

    expect(await stored()).toEqual([url(1)]);
  });

  it('does not let a form save in flight write the old list back', async () => {
    const profiles = service();

    const adding = profiles.updateShopImages([url(1)]);
    const saving = profiles.saveProfile({ ...KUMAR, description: 'Now with a van.' });
    await Promise.all([adding, saving]);

    const reloaded = await service().getProfile();
    expect(reloaded.shopImageUrls).toEqual([url(1)]);
    expect(reloaded.description).toBe('Now with a van.');
  });

  it('applies two changes in flight in the order they were sent', async () => {
    const profiles = service();

    const first = profiles.updateShopImages([url(1)]);
    const second = profiles.updateShopImages([url(1), url(2)]);

    await expect(first).resolves.toMatchObject({ shopImageUrls: [url(1)] });
    await expect(second).resolves.toMatchObject({ shopImageUrls: [url(1), url(2)] });
    expect(await stored()).toEqual([url(1), url(2)]);
  });
});

describe('Shop images — whose', () => {
  it('refuses when nobody is signed in', async () => {
    user = null;

    expect(await kindOf(() => service().updateShopImages([url(1)]))).toBe('unauthorized');
    user = RAVI;
    expect(await stored()).toEqual([]);
  });

  it('refuses a customer', async () => {
    user = ASHA;

    expect(await kindOf(() => service().updateShopImages([url(1)]))).toBe('unauthorized');
  });

  it('has nowhere to keep them for a vendor who has not set up — and does not set them up', async () => {
    user = MEENA;

    expect(await kindOf(() => service().updateShopImages([url(1)]))).toBe('notFound');
    const meena = await service().getProfile();
    expect(meena.isSetupComplete).toBe(false);
    expect(meena.shopImageUrls).toEqual([]);
  });

  it('never shows one vendor another vendor’s shop images', async () => {
    await service().updateShopImages([url(1)]);

    user = MEENA;
    await service().saveProfile({ businessName: 'Iyer Interiors', serviceCategoryIds: ['cat_painter'] });
    expect(await stored()).toEqual([]);
    await service().updateShopImages([url(9)]);

    user = RAVI;
    expect(await stored()).toEqual([url(1)]);
  });
});

describe('Shop images — on the device', () => {
  it('reads a record written before shop images existed as having none', async () => {
    // Version 1, exactly as Phase 3E-1 wrote it: no `shopImageUrls` at all.
    await put({ version: 1, profile: KUMAR });

    await expect(storage.read(RAVI.id)).resolves.toEqual(KUMAR);
    const profile = await service().getProfile();
    expect(profile.isSetupComplete).toBe(true);
    expect(profile.businessName).toBe(KUMAR.businessName);
    expect(profile.shopImageUrls).toEqual([]);
  });

  it('adds to such a record without losing the business', async () => {
    await put({ version: 1, profile: KUMAR });

    await service().updateShopImages([url(1)]);

    const profile = await service().getProfile();
    expect(profile).toMatchObject({ ...KUMAR, shopImageUrls: [url(1)] });
  });

  it('reads a list back in order, under the same schema version', async () => {
    const record: StoredVendorProfile = { ...KUMAR, shopImageUrls: [url(3), url(1)] };
    await storage.write(RAVI.id, record);

    await expect(storage.read(RAVI.id)).resolves.toEqual(record);
    expect(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '')).toEqual({ version: 1, profile: record });
  });

  it('reads a repeated URL once, where it first appeared', async () => {
    await put({ version: 1, profile: { ...KUMAR, shopImageUrls: [url(1), url(2), url(1)] } });

    await expect(storage.read(RAVI.id)).resolves.toMatchObject({ shopImageUrls: [url(1), url(2)] });
  });

  it.each([
    ['a list that is not a list', url(1)],
    ['a list holding something that is not text', [url(1), 7]],
    ['a list holding a blank entry', [url(1), '  ']],
    ['a list that is null', null],
  ])('treats a record with %s as no record, as any corrupt field is', async (_case, shopImageUrls) => {
    await put({ version: 1, profile: { ...KUMAR, shopImageUrls } });

    await expect(storage.read(RAVI.id)).resolves.toBeNull();
  });
});
