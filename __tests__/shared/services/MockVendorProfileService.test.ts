/**
 * The mock vendor profile (PROJECT_BIBLE.md section 38, Phase 3E-1).
 *
 * It stands in for a backend, so what is pinned here is the backend's side:
 *
 * - a vendor who has saved nothing gets a profile, not an error, and is not set up
 * - saving re-checks, normalises and answers with what it stored
 * - contact details come from the account and cannot be written through here
 * - it survives a restart, and one vendor never sees another's business
 * - it refuses without a vendor, and a customer is not a vendor
 *
 * Run against the real AsyncStorage-backed storage (jest.setup.js's in-memory
 * AsyncStorage), so persistence and scoping are tested end to end.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import type { AuthUser } from '@/features/auth/types';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { AsyncStorageMockVendorProfiles } from '@/shared/services/mock/MockVendorProfileStorage';
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
  email: 'meena.iyer@example.com',
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

let user: AuthUser | null;

function service() {
  return new MockVendorProfileService({
    latency: NO_LATENCY,
    storage: new AsyncStorageMockVendorProfiles(),
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

beforeEach(async () => {
  await AsyncStorage.clear();
  user = RAVI;
});

describe('MockVendorProfileService — before setup', () => {
  it('answers with an empty business and the account’s contact details', async () => {
    await expect(service().getProfile()).resolves.toEqual({
      vendorId: 'usr_vendor_1',
      businessName: '',
      serviceCategoryIds: [],
      shopImageUrls: [],
      // Never set: accepting, and the default week (MockVendorAvailability.test.ts pins both).
      acceptingRequests: true,
      workingHours: expect.any(Array),
      ownerName: 'Ravi Kumar',
      phone: '9000000001',
      isSetupComplete: false,
    });
  });

  it('carries the account email when there is one', async () => {
    user = MEENA;

    expect((await service().getProfile()).email).toBe('meena.iyer@example.com');
  });
});

describe('MockVendorProfileService — saving', () => {
  it('stores a valid profile, marks setup complete and answers with it', async () => {
    const saved = await service().saveProfile(KUMAR);

    expect(saved).toMatchObject({ ...KUMAR, vendorId: 'usr_vendor_1', isSetupComplete: true });
    expect(saved.ownerName).toBe('Ravi Kumar');
  });

  it('trims, drops blank optional fields and repeated categories', async () => {
    const saved = await service().saveProfile({
      businessName: '  Kumar Electricals  ',
      description: '   ',
      serviceCategoryIds: ['cat_electrician', 'cat_electrician', ' cat_plumber '],
      serviceArea: { description: '  ' },
    });

    expect(saved.businessName).toBe('Kumar Electricals');
    expect(saved.description).toBeUndefined();
    expect(saved.serviceArea).toBeUndefined();
    expect(saved.serviceCategoryIds).toEqual(['cat_electrician', 'cat_plumber']);
  });

  it('refuses a blank business name, even though the form checked', async () => {
    expect(await kindOf(() => service().saveProfile({ ...KUMAR, businessName: '   ' }))).toBe(
      'validation',
    );
    expect((await service().getProfile()).isSetupComplete).toBe(false);
  });

  it('refuses a profile with no services', async () => {
    expect(await kindOf(() => service().saveProfile({ ...KUMAR, serviceCategoryIds: [] }))).toBe(
      'validation',
    );
  });

  it('refuses a name longer than registration allows', async () => {
    expect(
      await kindOf(() => service().saveProfile({ ...KUMAR, businessName: 'x'.repeat(81) })),
    ).toBe('validation');
  });

  it('refuses a local file as the picture', async () => {
    expect(
      await kindOf(() => service().saveProfile({ ...KUMAR, imageUrl: 'file:///tmp/shop.jpg' })),
    ).toBe('validation');
  });

  it('clears a field the vendor emptied', async () => {
    const profiles = service();
    await profiles.saveProfile(KUMAR);

    const saved = await profiles.saveProfile({
      businessName: KUMAR.businessName,
      serviceCategoryIds: KUMAR.serviceCategoryIds,
    });

    expect(saved.description).toBeUndefined();
    expect(saved.serviceArea).toBeUndefined();
    expect(saved.imageUrl).toBeUndefined();
  });

  it('never stores contact details, whatever it is sent', async () => {
    await service().saveProfile({ ...KUMAR, phone: '1111111111' } as VendorProfileUpdate);

    const raw = await AsyncStorage.getItem(`${AppConfig.storage.mockVendorProfileKey}/usr_vendor_1`);
    expect(raw).not.toContain('1111111111');
    expect((await service().getProfile()).phone).toBe('9000000001');
  });

  it('fails the save when the profile cannot be stored', async () => {
    // One-shot on the existing mock; `spyOn` + `mockRestore` would strip its implementation.
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    expect(await kindOf(() => service().saveProfile(KUMAR))).toBe('unknown');
  });
});

describe('MockVendorProfileService — whose profile', () => {
  it('survives a restart — a fresh service reads what the last one wrote', async () => {
    await service().saveProfile(KUMAR);

    const reloaded = await service().getProfile();
    expect(reloaded).toMatchObject({ ...KUMAR, isSetupComplete: true });
  });

  it('never shows one vendor another vendor’s business', async () => {
    await service().saveProfile(KUMAR);

    user = MEENA;
    const meena = await service().getProfile();
    expect(meena.businessName).toBe('');
    expect(meena.isSetupComplete).toBe(false);

    user = RAVI;
    expect((await service().getProfile()).businessName).toBe('Kumar Electricals');
  });

  it('keeps each vendor under their own key', async () => {
    await service().saveProfile(KUMAR);

    const prefix = AppConfig.storage.mockVendorProfileKey;
    expect(await AsyncStorage.getItem(`${prefix}/usr_vendor_1`)).not.toBeNull();
    expect(await AsyncStorage.getItem(`${prefix}/usr_vendor_2`)).toBeNull();
  });

  it('refuses when nobody is signed in', async () => {
    user = null;

    expect(await kindOf(() => service().getProfile())).toBe('unauthorized');
    expect(await kindOf(() => service().saveProfile(KUMAR))).toBe('unauthorized');
  });

  it('refuses a customer', async () => {
    user = ASHA;

    expect(await kindOf(() => service().getProfile())).toBe('unauthorized');
    expect(await kindOf(() => service().saveProfile(KUMAR))).toBe('unauthorized');
  });
});
