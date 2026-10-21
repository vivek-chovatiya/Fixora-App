/**
 * The vendor profile store (Phase 3E-1): per vendor, versioned, strict, and
 * never a reason for the app to fall over.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import {
  AsyncStorageMockVendorProfiles,
  type StoredVendorProfile,
} from '@/shared/services/mock/MockVendorProfileStorage';

const RAVI = 'usr_vendor_1';
const KEY = `${AppConfig.storage.mockVendorProfileKey}/${RAVI}`;

const KUMAR: StoredVendorProfile = {
  businessName: 'Kumar Electricals',
  description: 'Wiring and repairs.',
  serviceCategoryIds: ['cat_electrician', 'cat_plumber'],
  serviceArea: { description: 'Koramangala' },
  imageUrl: 'https://example.com/kumar.jpg',
};

let storage: AsyncStorageMockVendorProfiles;

beforeEach(async () => {
  await AsyncStorage.clear();
  storage = new AsyncStorageMockVendorProfiles();
});

const put = (value: unknown) =>
  AsyncStorage.setItem(KEY, typeof value === 'string' ? value : JSON.stringify(value));

describe('MockVendorProfileStorage', () => {
  it('reads back exactly what it wrote', async () => {
    await storage.write(RAVI, KUMAR);

    await expect(storage.read(RAVI)).resolves.toEqual(KUMAR);
  });

  it('records the schema version beside the profile', async () => {
    await storage.write(RAVI, KUMAR);

    expect(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '')).toEqual({
      version: 1,
      profile: KUMAR,
    });
  });

  it('reads nothing for a vendor who has saved nothing', async () => {
    await expect(storage.read(RAVI)).resolves.toBeNull();
  });

  it('treats text that is not JSON as no profile, without throwing', async () => {
    await put('{not json');

    await expect(storage.read(RAVI)).resolves.toBeNull();
  });

  it('ignores another schema version rather than guessing at it', async () => {
    await put({ version: 2, profile: KUMAR });

    await expect(storage.read(RAVI)).resolves.toBeNull();
  });

  it.each([
    ['no business name', { ...KUMAR, businessName: '  ' }],
    ['categories that are not a list', { ...KUMAR, serviceCategoryIds: 'cat_electrician' }],
    ['a blank category id', { ...KUMAR, serviceCategoryIds: [''] }],
    ['an area with no description', { ...KUMAR, serviceArea: {} }],
    ['a picture that is not text', { ...KUMAR, imageUrl: 42 }],
  ])('treats a record with %s as no profile', async (_case, profile) => {
    await put({ version: 1, profile });

    await expect(storage.read(RAVI)).resolves.toBeNull();
  });

  it('keeps each vendor apart', async () => {
    await storage.write(RAVI, KUMAR);

    await expect(storage.read('usr_vendor_2')).resolves.toBeNull();
  });

  it('never throws when the device cannot be read', async () => {
    // One-shot on the existing mock; `spyOn` + `mockRestore` would strip its implementation.
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    await expect(storage.read(RAVI)).resolves.toBeNull();
  });

  it('reports a failed write instead of throwing', async () => {
    // One-shot on the existing mock; `spyOn` + `mockRestore` would strip its implementation.
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    await expect(storage.write(RAVI, KUMAR)).resolves.toBe(false);
  });
});
