/**
 * The mock's request history is what stands between a customer and losing a
 * request they raised when the app closes, so these tests pin what it must get
 * right:
 *
 * - a request saved is a request read back whole — address, photographs, notes,
 *   preference, status — and nothing a screen derives is written at all
 * - each customer has their own history, and it is never the draft's key
 * - a request saved twice is one request
 * - nothing it reads can take the app down: empty, corrupt, half-formed and
 *   other-schema history all read as whatever can be trusted, and a device that
 *   refuses to read or write is survived
 *
 * Run against the in-memory AsyncStorage from jest.setup.js, so what is tested
 * is the real serialisation rather than a stub's idea of it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { AsyncStorageMockRequestHistory } from '@/shared/services/mock/MockRequestHistoryStorage';
import type { CustomerRequestDetails } from '@/shared/services/types/RequestService';

const STATUS = CUSTOMER_COPY.requestStatus;

const CUSTOMER = 'usr_customer_1';
const KEY = `${AppConfig.storage.mockRequestHistoryKey}/${CUSTOMER}`;

/** Every optional field present, so a round trip that drops one is caught. */
const REQUEST: CustomerRequestDetails = {
  id: 'REQ-24083',
  categoryId: 'cat_electrician',
  subCategoryId: 'sub_fan_repair',
  categoryName: 'Electrician',
  serviceName: 'Fan Repair',
  status: 'PENDING_VENDOR',
  priority: 'HIGH',
  createdAt: '2026-09-11T09:30:00.000Z',
  preferredDate: '2026-09-12',
  preferredTime: '18:00',
  notes: 'It rattles, then stops.',
  imageUrls: ['https://cdn.example.test/a.jpg', 'https://cdn.example.test/b.jpg'],
  address: {
    formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
    latitude: 12.9352,
    longitude: 77.6245,
    locality: 'Koramangala, Bengaluru',
    postalCode: '560095',
    placeId: 'place_koramangala_5th',
  },
  preferredVendor: { id: 'ven_sharma_electricals', name: 'Sharma Electricals' },
};

/** Every optional field absent: open dispatch, typed address, nothing extra. */
const PLAIN: CustomerRequestDetails = {
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

let history: AsyncStorageMockRequestHistory;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(AsyncStorage.setItem).mockClear();
  history = new AsyncStorageMockRequestHistory();
});

/** What is on the device under the customer's key, parsed. */
async function stored(): Promise<{ version: number; requests: Record<string, unknown>[] }> {
  const raw = await AsyncStorage.getItem(KEY);
  return JSON.parse(raw ?? 'null');
}

/** Puts raw history on the device, the way an older or broken build might have. */
async function plant(value: unknown): Promise<void> {
  await AsyncStorage.setItem(KEY, typeof value === 'string' ? value : JSON.stringify(value));
}

/** The schema version this build writes, read off a real save rather than repeated here. */
async function currentVersion(): Promise<number> {
  await history.save('usr_probe', PLAIN);
  const raw = await AsyncStorage.getItem(`${AppConfig.storage.mockRequestHistoryKey}/usr_probe`);
  return JSON.parse(raw ?? '{}').version;
}

describe('MockRequestHistoryStorage — keeping requests', () => {
  it('reads back a saved request whole', async () => {
    await expect(history.save(CUSTOMER, REQUEST)).resolves.toBe(true);

    expect(await history.read(CUSTOMER)).toEqual([REQUEST]);
  });

  it('keeps an answer that was never given absent, not empty', async () => {
    await history.save(CUSTOMER, PLAIN);

    const [read] = await history.read(CUSTOMER);

    expect(Object.keys(read).sort()).toEqual(Object.keys(PLAIN).sort());
    // Open dispatch is the absence of a preference, and it stays one.
    expect('preferredVendor' in read).toBe(false);
  });

  it('reads nothing for a customer who has raised nothing', async () => {
    expect(await history.read(CUSTOMER)).toEqual([]);
  });

  it('keeps each customer’s requests apart', async () => {
    await history.save(CUSTOMER, REQUEST);
    await history.save('usr_customer_2', PLAIN);

    expect(await history.read(CUSTOMER)).toEqual([REQUEST]);
    expect(await history.read('usr_customer_2')).toEqual([PLAIN]);
    expect(await history.read('usr_customer_3')).toEqual([]);
  });

  it('writes under its own key, and never the draft’s', async () => {
    await history.save(CUSTOMER, REQUEST);

    const keys = jest.mocked(AsyncStorage.setItem).mock.calls.map(([key]) => key);

    expect(keys).toEqual([KEY]);
    expect(keys).not.toContain(AppConfig.storage.requestDraftKey);
    expect(await AsyncStorage.getItem(AppConfig.storage.requestDraftKey)).toBeNull();
  });

  it('writes the request, and nothing a screen works out from it', async () => {
    await history.save(CUSTOMER, REQUEST);

    const { requests } = await stored();
    const raw = (await AsyncStorage.getItem(KEY)) ?? '';

    expect(Object.keys(requests[0]).sort()).toEqual(Object.keys(REQUEST).sort());
    // The backend's status, never the stage or its wording.
    expect(requests[0].status).toBe('PENDING_VENDOR');
    for (const derived of [
      STATUS.awaiting_vendor.title,
      STATUS.awaiting_vendor.label,
      STATUS.awaiting_vendor.description,
      STATUS.searching.title,
      'tone',
      'progress',
    ]) {
      expect(raw).not.toContain(derived);
    }
  });

  it('marks what it writes with a schema version', async () => {
    await history.save(CUSTOMER, REQUEST);

    expect(Number.isInteger((await stored()).version)).toBe(true);
  });

  it('keeps a status the app does not recognise, for the screen to show as unavailable', async () => {
    await history.save(CUSTOMER, { ...REQUEST, status: 'ESCALATED_TO_REGION' });

    const [read] = await history.read(CUSTOMER);

    expect(read.status).toBe('ESCALATED_TO_REGION');
  });
});

describe('MockRequestHistoryStorage — one request, once', () => {
  it('replaces a request saved again under the same reference', async () => {
    await history.save(CUSTOMER, REQUEST);
    await history.save(CUSTOMER, { ...REQUEST, status: 'ACCEPTED', vendorName: 'Sharma Electricals' });

    const read = await history.read(CUSTOMER);

    expect(read).toHaveLength(1);
    expect(read[0].status).toBe('ACCEPTED');
    expect(read[0].vendorName).toBe('Sharma Electricals');
  });

  it('leaves every other request alone when one is replaced', async () => {
    await history.save(CUSTOMER, REQUEST);
    await history.save(CUSTOMER, PLAIN);
    await history.save(CUSTOMER, REQUEST);

    const read = await history.read(CUSTOMER);

    expect(read.map(request => request.id).sort()).toEqual([REQUEST.id, PLAIN.id]);
  });

  it('reads a reference stored twice once, the last one written winning', async () => {
    await plant({
      version: await currentVersion(),
      requests: [REQUEST, { ...REQUEST, status: 'IN_PROGRESS' }],
    });

    const read = await history.read(CUSTOMER);

    expect(read).toHaveLength(1);
    expect(read[0].status).toBe('IN_PROGRESS');
  });
});

describe('MockRequestHistoryStorage — what cannot be trusted', () => {
  it('reads corrupt history as none, without throwing', async () => {
    await plant('{"version": 1, "requests": [ this is not json');

    await expect(history.read(CUSTOMER)).resolves.toEqual([]);
  });

  it('replaces corrupt history on the next save rather than failing it', async () => {
    await plant('not json at all');

    await expect(history.save(CUSTOMER, REQUEST)).resolves.toBe(true);
    expect(await history.read(CUSTOMER)).toEqual([REQUEST]);
  });

  it('ignores history written for another schema', async () => {
    await plant({ version: (await currentVersion()) + 1, requests: [REQUEST] });

    expect(await history.read(CUSTOMER)).toEqual([]);
  });

  it('ignores history that is not a list of requests', async () => {
    const version = await currentVersion();

    for (const value of [
      { version, requests: 'REQ-24083' },
      { version },
      [REQUEST],
      42,
      null,
    ]) {
      await plant(value);
      expect(await history.read(CUSTOMER)).toEqual([]);
    }
  });

  it('drops the entries that do not decode and keeps the ones that do', async () => {
    await plant({
      version: await currentVersion(),
      requests: [
        REQUEST,
        'REQ-24090',
        null,
        { ...REQUEST, id: '' },
        { ...REQUEST, id: 'REQ-24091', address: undefined },
        { ...REQUEST, id: 'REQ-24092', address: { formattedAddress: '   ' } },
        { ...REQUEST, id: 'REQ-24093', address: { ...REQUEST.address, latitude: 'north' } },
        { ...REQUEST, id: 'REQ-24094', createdAt: 'yesterday' },
        { ...REQUEST, id: 'REQ-24095', status: 7 },
        { ...REQUEST, id: 'REQ-24096', imageUrls: [42] },
        { ...REQUEST, id: 'REQ-24097', preferredVendor: { name: 'Nobody in particular' } },
        { ...REQUEST, id: 'REQ-24098', notes: { text: 'not a note' } },
      ],
    });

    expect(await history.read(CUSTOMER)).toEqual([REQUEST]);
  });

  it('reads back only the fields a request has, whatever else was stored beside them', async () => {
    await plant({
      version: await currentVersion(),
      requests: [{ ...PLAIN, statusTitle: 'Request submitted', tone: 'neutral' }],
    });

    const [read] = await history.read(CUSTOMER);

    expect(read).toEqual(PLAIN);
  });
});

describe('MockRequestHistoryStorage — a device that refuses', () => {
  it('reads as none when the device cannot be read', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(history.read(CUSTOMER)).resolves.toEqual([]);
  });

  it('says so when a request cannot be written, without throwing', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));

    await expect(history.save(CUSTOMER, REQUEST)).resolves.toBe(false);
    expect(await history.read(CUSTOMER)).toEqual([]);
  });

  it('never overwrites history it only failed to read', async () => {
    await history.save(CUSTOMER, REQUEST);

    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(history.save(CUSTOMER, PLAIN)).resolves.toBe(false);
    // The request that was already there is still there.
    expect(await history.read(CUSTOMER)).toEqual([REQUEST]);
  });
});
