/**
 * The saved-address store (Phase 3D-9): per customer, versioned, strict, and
 * never a reason for the screen to fall over.
 *
 * Against the in-memory AsyncStorage from jest.setup.js, so the real
 * serialisation is what is tested.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import { AsyncStorageMockSavedAddresses } from '@/shared/services/mock/MockSavedAddressStorage';
import type { SavedAddress } from '@/shared/services/types/AddressBookService';

const ASHA = 'usr_customer_1';
const KEY = `${AppConfig.storage.mockSavedAddressKey}/${ASHA}`;

const HOME: SavedAddress = {
  id: 'addr_1',
  formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
  isDefault: true,
  placeId: 'place_koramangala_5th',
  latitude: 12.9352,
  longitude: 77.6245,
};

const WORK: SavedAddress = {
  id: 'addr_2',
  formattedAddress: '9, Sector 2, HSR Layout, Bengaluru 560102',
  isDefault: false,
};

let storage: AsyncStorageMockSavedAddresses;

beforeEach(async () => {
  await AsyncStorage.clear();
  storage = new AsyncStorageMockSavedAddresses();
});

const put = (value: unknown) =>
  AsyncStorage.setItem(KEY, typeof value === 'string' ? value : JSON.stringify(value));

describe('MockSavedAddressStorage', () => {
  it('reads back exactly what it wrote', async () => {
    await storage.write(ASHA, [HOME, WORK]);

    await expect(storage.read(ASHA)).resolves.toEqual([HOME, WORK]);
  });

  it('records the schema version beside the addresses', async () => {
    await storage.write(ASHA, [HOME]);

    expect(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '')).toMatchObject({
      version: 1,
      addresses: [HOME],
    });
  });

  it('reads nothing for a customer who has saved nothing', async () => {
    await expect(storage.read(ASHA)).resolves.toEqual([]);
  });

  it('treats text that is not JSON as an empty book, without throwing', async () => {
    await put('{not json');

    await expect(storage.read(ASHA)).resolves.toEqual([]);
  });

  it('ignores another schema version rather than guessing at it', async () => {
    await put({ version: 2, addresses: [HOME] });

    await expect(storage.read(ASHA)).resolves.toEqual([]);
  });

  it('ignores a file whose addresses are not a list', async () => {
    await put({ version: 1, addresses: 'lots' });

    await expect(storage.read(ASHA)).resolves.toEqual([]);
  });

  it('drops a record that does not decode and keeps the rest', async () => {
    await put({
      version: 1,
      addresses: [
        HOME,
        { id: 'addr_x', isDefault: false }, // no address
        { id: 'addr_y', formattedAddress: '   ', isDefault: false }, // blank
        { ...WORK, latitude: 'north' }, // a coordinate that is not a number
        WORK,
      ],
    });

    await expect(storage.read(ASHA)).resolves.toEqual([HOME, WORK]);
  });

  it('keeps the first of two records that share an id', async () => {
    await put({ version: 1, addresses: [HOME, { ...HOME, formattedAddress: 'somewhere else' }] });

    const read = await storage.read(ASHA);
    expect(read).toHaveLength(1);
    expect(read[0].formattedAddress).toBe(HOME.formattedAddress);
  });

  it('drops half a position rather than keeping a coordinate with no partner', async () => {
    await put({ version: 1, addresses: [{ ...WORK, isDefault: true, latitude: 12.9 }] });

    const [read] = await storage.read(ASHA);
    expect(read.latitude).toBeUndefined();
  });

  it('repairs a file with two defaults to one', async () => {
    await put({ version: 1, addresses: [HOME, { ...WORK, isDefault: true }] });

    const read = await storage.read(ASHA);
    expect(read.filter(address => address.isDefault)).toHaveLength(1);
    expect(read[0].isDefault).toBe(true);
  });

  it('gives a non-empty book with no default a default', async () => {
    // The default was the record that failed to decode.
    await put({
      version: 1,
      addresses: [{ id: 'addr_x', isDefault: true }, WORK],
    });

    const read = await storage.read(ASHA);
    expect(read).toHaveLength(1);
    expect(read[0].isDefault).toBe(true);
  });

  it('keeps each customer apart', async () => {
    await storage.write(ASHA, [HOME]);

    await expect(storage.read('usr_customer_2')).resolves.toEqual([]);
  });

  it('never throws when the device cannot be read', async () => {
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));

    await expect(storage.read(ASHA)).resolves.toEqual([]);
    spy.mockRestore();
  });

  it('reports a failed write instead of throwing', async () => {
    const spy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'));

    await expect(storage.write(ASHA, [HOME])).resolves.toBe(false);
    spy.mockRestore();
  });
});
