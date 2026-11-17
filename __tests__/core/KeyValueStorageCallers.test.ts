/**
 * Nothing outside `src/core/storage` reaches AsyncStorage (CLAUDE.md section 4):
 * a feature's own store, and a mock backend's, go through `KeyValueStorage`.
 *
 * Pinned for every store that used to import AsyncStorage itself — the request
 * draft and the five mock backends' stores — by swapping the device for one
 * that records: what each writes must arrive there, under its own key, and it
 * must read back what it wrote, with AsyncStorage never touched. And a device
 * that fails is still survived exactly as before: no store throws, reads come
 * back empty, writes say they failed.
 *
 * Each store's own suite pins its shape, versions and decoding against the
 * in-memory AsyncStorage; this one pins only which door they use.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import {
  getKeyValueStorage,
  setKeyValueStorage,
  type KeyValueStorage,
} from '@/core/storage/KeyValueStorage';
import type { RequestDraft } from '@/features/customer/state/requestDraft';
import { AsyncStorageRequestDraft } from '@/features/customer/state/requestDraftStorage';
import { AsyncStorageMockRequestHistory } from '@/shared/services/mock/MockRequestHistoryStorage';
import { AsyncStorageMockReviewStorage } from '@/shared/services/mock/MockReviewStorage';
import { AsyncStorageMockSavedAddresses } from '@/shared/services/mock/MockSavedAddressStorage';
import {
  AsyncStorageMockVendorProfiles,
  type StoredVendorProfile,
} from '@/shared/services/mock/MockVendorProfileStorage';
import { AsyncStorageMockVendorTeam } from '@/shared/services/mock/MockVendorTeamStorage';
import type { SavedAddress } from '@/shared/services/types/AddressBookService';
import type { CustomerRequestDetails } from '@/shared/services/types/RequestService';
import type { RequestReview } from '@/shared/services/types/ReviewService';
import type { TeamMember } from '@/shared/services/types/VendorTeamService';

const CUSTOMER = 'usr_customer_1';
const VENDOR = 'usr_vendor_1';
const STORAGE = AppConfig.storage;

const DRAFT: RequestDraft = {
  categoryId: 'cat_electrician',
  subCategoryId: 'sub_fan_repair',
  values: { priority: 'HIGH', preferredDate: '', preferredTime: '', notes: 'Fan grinds.' },
  imageUrls: [],
  address: { formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095' },
  vendor: { kind: 'none' },
};

const REQUEST: CustomerRequestDetails = {
  id: 'REQ-24084',
  categoryId: 'cat_carpenter',
  subCategoryId: 'sub_door_repair',
  categoryName: 'Carpenter',
  serviceName: 'Door Repair',
  status: 'CREATED',
  priority: 'LOW',
  createdAt: '2026-09-11T10:00:00.000Z',
  address: { formattedAddress: '17 Cross Lane, Devanahalli, Bengaluru 562110' },
};

const REVIEW: RequestReview = {
  requestId: 'REQ-24048',
  rating: 4,
  comment: 'Quick, tidy, and the switch works.',
  submittedAt: '2026-09-22T10:00:00.000Z',
};

const HOME: SavedAddress = {
  id: 'addr_1',
  formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
  isDefault: true,
};

const KUMAR: StoredVendorProfile = {
  businessName: 'Kumar Electricals',
  serviceCategoryIds: ['cat_electrician'],
};

const SURESH: TeamMember = {
  id: 'tm_1',
  name: 'Suresh Naik',
  role: 'Senior technician',
  status: 'ACTIVE',
};

interface StoreCase {
  store: string;
  /** Where its record must land. */
  key: string;
  /** Writes one record, then reads it back. */
  writeThenRead: () => Promise<unknown>;
  /** What the read must give back. */
  readBack: unknown;
  /** Every call it offers, against a device that fails. */
  againstFailure: () => Promise<unknown[]>;
  /** What each of those must resolve to — never a throw. */
  survived: unknown[];
}

const CASES: StoreCase[] = [
  {
    store: 'the request draft',
    key: STORAGE.requestDraftKey,
    writeThenRead: async () => {
      const storage = new AsyncStorageRequestDraft();
      await storage.write(DRAFT, CUSTOMER);
      return (await storage.read(CUSTOMER))?.draft;
    },
    readBack: DRAFT,
    againstFailure: async () => {
      const storage = new AsyncStorageRequestDraft();
      return [await storage.read(CUSTOMER), await storage.write(DRAFT, CUSTOMER), await storage.clear()];
    },
    survived: [null, false, undefined],
  },
  {
    store: 'the mock request history',
    key: `${STORAGE.mockRequestHistoryKey}/${CUSTOMER}`,
    writeThenRead: async () => {
      const storage = new AsyncStorageMockRequestHistory();
      await storage.save(CUSTOMER, REQUEST);
      return storage.read(CUSTOMER);
    },
    readBack: [REQUEST],
    againstFailure: async () => {
      const storage = new AsyncStorageMockRequestHistory();
      return [await storage.read(CUSTOMER), await storage.save(CUSTOMER, REQUEST)];
    },
    survived: [[], false],
  },
  {
    store: 'the mock reviews',
    key: `${STORAGE.mockRequestReviewKey}/${CUSTOMER}`,
    writeThenRead: async () => {
      const storage = new AsyncStorageMockReviewStorage();
      await storage.save(CUSTOMER, REVIEW);
      return storage.read(CUSTOMER);
    },
    readBack: [REVIEW],
    againstFailure: async () => {
      const storage = new AsyncStorageMockReviewStorage();
      return [await storage.read(CUSTOMER), await storage.save(CUSTOMER, REVIEW)];
    },
    survived: [[], false],
  },
  {
    store: 'the mock saved addresses',
    key: `${STORAGE.mockSavedAddressKey}/${CUSTOMER}`,
    writeThenRead: async () => {
      const storage = new AsyncStorageMockSavedAddresses();
      await storage.write(CUSTOMER, [HOME]);
      return storage.read(CUSTOMER);
    },
    readBack: [HOME],
    againstFailure: async () => {
      const storage = new AsyncStorageMockSavedAddresses();
      return [await storage.read(CUSTOMER), await storage.write(CUSTOMER, [HOME])];
    },
    survived: [[], false],
  },
  {
    store: 'the mock vendor profiles',
    key: `${STORAGE.mockVendorProfileKey}/${VENDOR}`,
    writeThenRead: async () => {
      const storage = new AsyncStorageMockVendorProfiles();
      await storage.write(VENDOR, KUMAR);
      return storage.read(VENDOR);
    },
    readBack: KUMAR,
    againstFailure: async () => {
      const storage = new AsyncStorageMockVendorProfiles();
      return [await storage.read(VENDOR), await storage.write(VENDOR, KUMAR)];
    },
    survived: [null, false],
  },
  {
    store: 'the mock vendor team',
    key: `${STORAGE.mockVendorTeamKey}/${VENDOR}`,
    writeThenRead: async () => {
      const storage = new AsyncStorageMockVendorTeam();
      await storage.write(VENDOR, [SURESH]);
      return storage.read(VENDOR);
    },
    readBack: [SURESH],
    againstFailure: async () => {
      const storage = new AsyncStorageMockVendorTeam();
      return [await storage.read(VENDOR), await storage.write(VENDOR, [SURESH])];
    },
    survived: [null, false],
  },
];

/** An in-memory device that keeps what it is given. */
function recordingDevice() {
  const store = new Map<string, string>();
  const device: KeyValueStorage = {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
  return { device, store };
}

function failingDevice(): KeyValueStorage {
  const fail = async (): Promise<never> => {
    throw new Error('device unavailable');
  };
  return { getItem: jest.fn(fail), setItem: jest.fn(fail), removeItem: jest.fn(fail) };
}

const original = getKeyValueStorage();

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(AsyncStorage.getItem).mockClear();
  jest.mocked(AsyncStorage.setItem).mockClear();
  jest.mocked(AsyncStorage.removeItem).mockClear();
});

afterEach(() => {
  setKeyValueStorage(original);
  jest.restoreAllMocks();
});

function expectAsyncStorageUntouched() {
  expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
}

describe('Stores outside core reach the device only through KeyValueStorage', () => {
  it.each(CASES)('$store writes and reads under its own key, and never touches AsyncStorage', async ({
    key,
    writeThenRead,
    readBack,
  }) => {
    const { device, store } = recordingDevice();
    setKeyValueStorage(device);

    await expect(writeThenRead()).resolves.toEqual(readBack);

    expect(key.startsWith(`${STORAGE.keyPrefix}/`)).toBe(true);
    expect([...store.keys()]).toEqual([key]);
    expectAsyncStorageUntouched();
  });

  it.each(CASES)('$store still survives a device that fails', async ({ againstFailure, survived }) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    setKeyValueStorage(failingDevice());

    await expect(againstFailure()).resolves.toEqual(survived);
    expectAsyncStorageUntouched();
  });

  it('removes the request draft through it too', async () => {
    const { device, store } = recordingDevice();
    setKeyValueStorage(device);
    const storage = new AsyncStorageRequestDraft();
    await storage.write(DRAFT, CUSTOMER);

    await storage.clear();

    expect(device.removeItem).toHaveBeenCalledWith(STORAGE.requestDraftKey);
    expect(store.size).toBe(0);
    expectAsyncStorageUntouched();
  });
});
