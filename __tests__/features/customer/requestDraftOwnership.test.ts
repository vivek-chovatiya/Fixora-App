/**
 * A saved draft belongs to the customer who was filling it in (Phase 3D-7).
 *
 * Logging out clears it, but a clear can fail; these pin the guarantee that does
 * not depend on the clear: a draft is restored only for its owner, and one
 * written by anybody else — or by a build that did not record an owner — is
 * discarded and removed rather than resumed.
 *
 * Against the in-memory AsyncStorage from jest.setup.js, so the real
 * serialisation is what is tested.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import type { RequestDraft } from '@/features/customer/state/requestDraft';
import { AsyncStorageRequestDraft } from '@/features/customer/state/requestDraftStorage';

const KEY = AppConfig.storage.requestDraftKey;

const DRAFT: RequestDraft = {
  categoryId: 'cat_electrician',
  subCategoryId: 'sub_fan_repair',
  values: { priority: 'HIGH', preferredDate: '', preferredTime: '', notes: 'Fan grinds.' },
  imageUrls: [],
  address: { formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095' },
  vendor: { kind: 'none' },
};

let storage: AsyncStorageRequestDraft;

beforeEach(async () => {
  await AsyncStorage.clear();
  storage = new AsyncStorageRequestDraft();
});

describe('RequestDraftStorage — whose draft it is', () => {
  it('restores a draft for the customer who wrote it', async () => {
    await storage.write(DRAFT, 'usr_customer_1');

    expect((await storage.read('usr_customer_1'))?.draft).toEqual(DRAFT);
  });

  it('records the owner beside the draft', async () => {
    await storage.write(DRAFT, 'usr_customer_1');

    expect(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '')).toMatchObject({
      version: 3,
      ownerId: 'usr_customer_1',
      draft: DRAFT,
    });
  });

  it('never gives one customer another customer’s draft, and removes it', async () => {
    await storage.write(DRAFT, 'usr_customer_1');

    expect(await storage.read('usr_customer_2')).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    // Gone for its owner too: signing out is where it was meant to end.
    expect(await storage.read('usr_customer_1')).toBeNull();
  });

  it('keeps an ownerless draft apart from any signed-in customer', async () => {
    await storage.write(DRAFT);

    expect(await storage.read('usr_customer_1')).toBeNull();
  });

  it('still works with no owner on either side', async () => {
    await storage.write(DRAFT);

    expect((await storage.read())?.draft).toEqual(DRAFT);
  });

  it('drops a draft saved before owners were recorded', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ version: 2, savedAt: '2026-09-20T10:00:00.000Z', draft: DRAFT }),
    );

    expect(await storage.read('usr_customer_1')).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});
