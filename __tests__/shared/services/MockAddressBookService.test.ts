/**
 * The mock address book (PROJECT_BIBLE.md section 18, Phase 3D-9).
 *
 * It stands in for a backend, so what is pinned here is the collection's rules,
 * which live in the service and nowhere else:
 *
 * - the first address is the default and a later one never displaces it
 * - exactly one default while any exist, none when none do
 * - deleting the default promotes the most recently added of those remaining
 * - the default is listed first, then the rest in insertion order
 * - editing never moves the default; only `setDefaultAddress` does
 * - it re-checks what it is sent, and refuses with no customer
 * - one customer never sees another's addresses
 *
 * Run against the real AsyncStorage-backed storage (jest.setup.js's in-memory
 * AsyncStorage), so persistence and scoping are tested end to end.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import { MockAddressBookService } from '@/shared/services/mock/MockAddressBookService';
import { AsyncStorageMockSavedAddresses } from '@/shared/services/mock/MockSavedAddressStorage';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import type { SavedAddress, SavedAddressInput } from '@/shared/services/types/AddressBookService';
import { AppError } from '@/shared/types/error';

const HOME: SavedAddressInput = {
  formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
  addressLine: '412, 5th Block',
  locality: 'Koramangala',
  postalCode: '560095',
  placeId: 'place_koramangala_5th',
  latitude: 12.9352,
  longitude: 77.6245,
};

const WORK: SavedAddressInput = { formattedAddress: '9, Sector 2, HSR Layout, Bengaluru 560102' };
const PARENTS: SavedAddressInput = { formattedAddress: '17 MG Road, Indiranagar, Bengaluru 560038' };

let customer: string | null;

function service() {
  return new MockAddressBookService({
    latency: NO_LATENCY,
    storage: new AsyncStorageMockSavedAddresses(),
    currentCustomerId: async () => customer,
  });
}

const texts = (list: SavedAddress[]) => list.map(address => address.formattedAddress);
const defaults = (list: SavedAddress[]) => list.filter(address => address.isDefault);

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
  customer = 'usr_customer_1';
});

describe('MockAddressBookService — an empty book', () => {
  it('lists nothing, and that is not a failure', async () => {
    await expect(service().listAddresses()).resolves.toEqual([]);
  });
});

describe('MockAddressBookService — adding', () => {
  it('makes the first address the default', async () => {
    const list = await service().createAddress(HOME);

    expect(list).toHaveLength(1);
    expect(list[0].isDefault).toBe(true);
  });

  it('keeps the current default when another is added', async () => {
    const book = service();
    await book.createAddress(HOME);

    const list = await book.createAddress(WORK);

    expect(defaults(list).map(address => address.formattedAddress)).toEqual([
      HOME.formattedAddress,
    ]);
  });

  it('keeps everything the source supplied, coordinates and placeId included', async () => {
    const [saved] = await service().createAddress(HOME);

    expect(saved).toMatchObject(HOME);
  });

  it('stores a typed address with nothing it was not told', async () => {
    const [saved] = await service().createAddress(WORK);

    expect(Object.keys(saved).sort()).toEqual(['formattedAddress', 'id', 'isDefault']);
  });

  it('never keeps half a position', async () => {
    const [saved] = await service().createAddress({ ...WORK, latitude: 12.9 });

    expect(saved.latitude).toBeUndefined();
    expect(saved.longitude).toBeUndefined();
  });

  it('refuses an address too short to find anybody by, even though the form checked', async () => {
    expect(await kindOf(() => service().createAddress({ formattedAddress: 'Flat 4' }))).toBe(
      'validation',
    );
  });

  it('issues distinct ids', async () => {
    const book = service();
    await book.createAddress(HOME);
    const list = await book.createAddress(WORK);

    expect(new Set(list.map(address => address.id)).size).toBe(2);
  });
});

describe('MockAddressBookService — ordering', () => {
  it('lists the default first, then the rest in the order they were added', async () => {
    const book = service();
    await book.createAddress(HOME);
    await book.createAddress(WORK);
    const added = await book.createAddress(PARENTS);

    // Make the last one default: it moves to the front; the rest keep their order.
    const parents = added.find(address => address.formattedAddress === PARENTS.formattedAddress)!;
    const list = await book.setDefaultAddress(parents.id);

    expect(texts(list)).toEqual([
      PARENTS.formattedAddress,
      HOME.formattedAddress,
      WORK.formattedAddress,
    ]);
  });
});

describe('MockAddressBookService — the default', () => {
  it('moves the default and clears it from every other', async () => {
    const book = service();
    await book.createAddress(HOME);
    const added = await book.createAddress(WORK);
    const work = added.find(address => address.formattedAddress === WORK.formattedAddress)!;

    const list = await book.setDefaultAddress(work.id);

    expect(defaults(list)).toHaveLength(1);
    expect(defaults(list)[0].id).toBe(work.id);
  });

  it('never has two defaults, however often it is changed', async () => {
    const book = service();
    await book.createAddress(HOME);
    await book.createAddress(WORK);
    const all = await book.createAddress(PARENTS);

    for (const address of [...all, ...all]) {
      const list = await book.setDefaultAddress(address.id);
      expect(defaults(list)).toHaveLength(1);
    }
  });

  it('refuses to make an unknown address the default', async () => {
    expect(await kindOf(() => service().setDefaultAddress('addr_nope'))).toBe('notFound');
  });
});

describe('MockAddressBookService — editing', () => {
  it('replaces the fields and leaves the default where it was', async () => {
    const book = service();
    await book.createAddress(HOME);
    const added = await book.createAddress(WORK);
    const work = added.find(address => address.formattedAddress === WORK.formattedAddress)!;

    const list = await book.updateAddress(work.id, PARENTS);

    const edited = list.find(address => address.id === work.id)!;
    expect(edited.formattedAddress).toBe(PARENTS.formattedAddress);
    expect(edited.isDefault).toBe(false);
    expect(defaults(list)[0].formattedAddress).toBe(HOME.formattedAddress);
  });

  it('keeps the default on the address being edited when it was the default', async () => {
    const book = service();
    const [home] = await book.createAddress(HOME);

    const list = await book.updateAddress(home.id, WORK);

    expect(list[0].isDefault).toBe(true);
  });

  it('drops old source metadata when the address is retyped by hand', async () => {
    const book = service();
    const [home] = await book.createAddress(HOME);

    const [edited] = await book.updateAddress(home.id, WORK);

    // A retyped line with the old coordinates beside it would point at the old place.
    expect(edited.placeId).toBeUndefined();
    expect(edited.latitude).toBeUndefined();
  });

  it('refuses to edit an address that is not there', async () => {
    expect(await kindOf(() => service().updateAddress('addr_nope', WORK))).toBe('notFound');
  });
});

describe('MockAddressBookService — deleting', () => {
  it('leaves the default alone when a different address is deleted', async () => {
    const book = service();
    await book.createAddress(HOME);
    const added = await book.createAddress(WORK);
    const work = added.find(address => address.formattedAddress === WORK.formattedAddress)!;

    const list = await book.deleteAddress(work.id);

    expect(texts(list)).toEqual([HOME.formattedAddress]);
    expect(list[0].isDefault).toBe(true);
  });

  it('promotes the most recently added remaining address when the default goes', async () => {
    const book = service();
    const [home] = await book.createAddress(HOME);
    await book.createAddress(WORK);
    await book.createAddress(PARENTS);

    const list = await book.deleteAddress(home.id);

    // PARENTS was added after WORK, so it is the one promoted.
    expect(defaults(list)).toHaveLength(1);
    expect(defaults(list)[0].formattedAddress).toBe(PARENTS.formattedAddress);
    expect(texts(list)).toEqual([PARENTS.formattedAddress, WORK.formattedAddress]);
  });

  it('leaves an empty book with no default when the last one goes', async () => {
    const book = service();
    const [home] = await book.createAddress(HOME);

    await expect(book.deleteAddress(home.id)).resolves.toEqual([]);
  });

  it('deletes only the address asked for', async () => {
    const book = service();
    await book.createAddress(HOME);
    await book.createAddress(WORK);
    const all = await book.createAddress(PARENTS);
    const work = all.find(address => address.formattedAddress === WORK.formattedAddress)!;

    const list = await book.deleteAddress(work.id);

    expect(texts(list).sort()).toEqual(
      [HOME.formattedAddress, PARENTS.formattedAddress].sort(),
    );
  });

  it('refuses to delete an address that is not there', async () => {
    expect(await kindOf(() => service().deleteAddress('addr_nope'))).toBe('notFound');
  });
});

describe('MockAddressBookService — whose addresses', () => {
  it('refuses every operation when nobody is signed in', async () => {
    customer = null;
    const book = service();

    expect(await kindOf(() => book.listAddresses())).toBe('unauthorized');
    expect(await kindOf(() => book.createAddress(HOME))).toBe('unauthorized');
    expect(await kindOf(() => book.updateAddress('a', HOME))).toBe('unauthorized');
    expect(await kindOf(() => book.deleteAddress('a'))).toBe('unauthorized');
    expect(await kindOf(() => book.setDefaultAddress('a'))).toBe('unauthorized');
  });

  it('never shows one customer another customer’s addresses', async () => {
    const book = service();
    await book.createAddress(HOME);

    customer = 'usr_customer_2';
    await expect(book.listAddresses()).resolves.toEqual([]);
    await book.createAddress(WORK);

    customer = 'usr_customer_1';
    expect(texts(await book.listAddresses())).toEqual([HOME.formattedAddress]);
  });

  it('keeps each customer under their own key', async () => {
    await service().createAddress(HOME);

    const key = `${AppConfig.storage.mockSavedAddressKey}/usr_customer_1`;
    expect(await AsyncStorage.getItem(key)).not.toBeNull();
    expect(await AsyncStorage.getItem(`${AppConfig.storage.mockSavedAddressKey}/usr_customer_2`)).toBeNull();
  });

  it('survives a restart — a fresh service reads what the last one wrote', async () => {
    await service().createAddress(HOME);

    expect(texts(await service().listAddresses())).toEqual([HOME.formattedAddress]);
  });

  it('writes nothing into the draft, request history or reviews', async () => {
    await service().createAddress(HOME);

    expect(await AsyncStorage.getItem(AppConfig.storage.requestDraftKey)).toBeNull();
    expect(
      await AsyncStorage.getItem(`${AppConfig.storage.mockRequestHistoryKey}/usr_customer_1`),
    ).toBeNull();
    expect(
      await AsyncStorage.getItem(`${AppConfig.storage.mockRequestReviewKey}/usr_customer_1`),
    ).toBeNull();
  });
});
