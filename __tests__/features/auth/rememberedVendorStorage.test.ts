/**
 * The remembered vendor is a phone number kept on the device after a vendor
 * signs in. The rule that matters most is one no screen can show: the vendor
 * auth code is a standing credential and must never be persisted (PROJECT_BIBLE.md
 * section 7A.2). So everything this module hands to the device is recorded and
 * searched, and a code handed to it by mistake is shown to be turned away.
 *
 * The rest pins what makes it safe to depend on: it stores digits only, under
 * its own versioned shape, treats anything it cannot use as nothing, and never
 * throws or logs the number.
 */

import { AppConfig } from '@/core/config/AppConfig';
import {
  getKeyValueStorage,
  setKeyValueStorage,
  type KeyValueStorage,
} from '@/core/storage/KeyValueStorage';
import { DeviceRememberedVendorStorage } from '@/features/auth/state/rememberedVendorStorage';

const KEY = AppConfig.storage.rememberedVendorKey;
const PHONE = '9000000001';
const CODE = '482913';

/** An in-memory device that records every call made to it. */
function recordingDevice(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const calls: unknown[][] = [];

  const device: KeyValueStorage = {
    getItem: jest.fn(async (key: string) => {
      calls.push(['getItem', key]);
      return store.get(key) ?? null;
    }),
    setItem: jest.fn(async (key: string, value: string) => {
      calls.push(['setItem', key, value]);
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      calls.push(['removeItem', key]);
      store.delete(key);
    }),
  };

  return { device, store, calls };
}

function captureLogs() {
  const spies = [
    jest.spyOn(console, 'log').mockImplementation(() => {}),
    jest.spyOn(console, 'warn').mockImplementation(() => {}),
    jest.spyOn(console, 'error').mockImplementation(() => {}),
  ];

  return () =>
    spies
      .flatMap(spy => spy.mock.calls)
      .flat()
      .map(entry => JSON.stringify(entry))
      .join(' ');
}

const original = getKeyValueStorage();

afterEach(() => {
  setKeyValueStorage(original);
  jest.restoreAllMocks();
});

describe('RememberedVendorStorage — remembering', () => {
  it('keeps the phone as digits, under its own key and version', async () => {
    const { device, store } = recordingDevice();
    setKeyValueStorage(device);
    const storage = new DeviceRememberedVendorStorage();

    await expect(storage.remember('+91 90000-00001')).resolves.toBe(true);

    expect(KEY.startsWith(`${AppConfig.storage.keyPrefix}/`)).toBe(true);
    expect(JSON.parse(store.get(KEY) ?? 'null')).toEqual({ version: 1, phone: '919000000001' });
  });

  it('reads back exactly what it remembered', async () => {
    setKeyValueStorage(recordingDevice().device);
    const storage = new DeviceRememberedVendorStorage();

    await storage.remember(PHONE);

    await expect(storage.read()).resolves.toBe(PHONE);
  });

  it('replaces one vendor with the next', async () => {
    setKeyValueStorage(recordingDevice().device);
    const storage = new DeviceRememberedVendorStorage();

    await storage.remember(PHONE);
    await storage.remember('9000000002');

    await expect(storage.read()).resolves.toBe('9000000002');
  });

  it('forgets', async () => {
    const { device, store } = recordingDevice();
    setKeyValueStorage(device);
    const storage = new DeviceRememberedVendorStorage();

    await storage.remember(PHONE);
    await storage.forget();

    expect(store.has(KEY)).toBe(false);
    await expect(storage.read()).resolves.toBeNull();
  });

  it('reads nothing when nothing was remembered', async () => {
    setKeyValueStorage(recordingDevice().device);

    await expect(new DeviceRememberedVendorStorage().read()).resolves.toBeNull();
  });
});

describe('RememberedVendorStorage — the auth code never reaches the device', () => {
  it('refuses a code handed to it in place of a phone number', async () => {
    const { device, calls } = recordingDevice();
    setKeyValueStorage(device);
    const storage = new DeviceRememberedVendorStorage();

    await expect(storage.remember(CODE)).resolves.toBe(false);
    await expect(storage.remember('482 913')).resolves.toBe(false);

    expect(device.setItem).not.toHaveBeenCalled();
    expect(JSON.stringify(calls)).not.toContain(CODE);
  });

  it('refuses anything that is not a phone number by the shared rule', async () => {
    const { device } = recordingDevice();
    setKeyValueStorage(device);
    const storage = new DeviceRememberedVendorStorage();

    for (const value of ['', '12345', 'Ravi Kumar', '1234567890123456']) {
      await expect(storage.remember(value)).resolves.toBe(false);
    }
    expect(device.setItem).not.toHaveBeenCalled();
  });

  it('hands the device nothing but the phone, version and key', async () => {
    const { device, calls } = recordingDevice();
    setKeyValueStorage(device);
    const storage = new DeviceRememberedVendorStorage();

    await storage.remember(PHONE);
    await storage.read();
    await storage.forget();

    const writes = calls.filter(([method]) => method === 'setItem');
    expect(writes).toEqual([['setItem', KEY, JSON.stringify({ version: 1, phone: PHONE })]]);
    expect(JSON.stringify(calls)).not.toContain(CODE);
  });
});

describe('RememberedVendorStorage — what it cannot use is nothing', () => {
  it.each([
    ['an older version', JSON.stringify({ version: 0, phone: PHONE })],
    ['a newer version', JSON.stringify({ version: 2, phone: PHONE })],
    ['no version', JSON.stringify({ phone: PHONE })],
    ['no phone', JSON.stringify({ version: 1 })],
    ['a phone that is not digits only', JSON.stringify({ version: 1, phone: '+91 90000 00001' })],
    ['a value too short to be a phone', JSON.stringify({ version: 1, phone: CODE })],
    ['a phone that is not a string', JSON.stringify({ version: 1, phone: 9000000001 })],
    ['not JSON', 'not json'],
    ['JSON null', 'null'],
    ['a bare number', '9000000001'],
  ])('discards %s and reads nothing', async (_label, raw) => {
    const { device, store } = recordingDevice({ [KEY]: raw });
    setKeyValueStorage(device);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(new DeviceRememberedVendorStorage().read()).resolves.toBeNull();

    // Removed, so it is not re-read and re-discarded on every visit.
    expect(store.has(KEY)).toBe(false);
  });
});

describe('RememberedVendorStorage — failures', () => {
  function failingDevice(): KeyValueStorage {
    return {
      getItem: jest.fn(async () => {
        throw new Error('device unavailable');
      }),
      setItem: jest.fn(async () => {
        throw new Error('device unavailable');
      }),
      removeItem: jest.fn(async () => {
        throw new Error('device unavailable');
      }),
    };
  }

  it('never throws, and reports a failed write as not remembered', async () => {
    setKeyValueStorage(failingDevice());
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const storage = new DeviceRememberedVendorStorage();

    await expect(storage.read()).resolves.toBeNull();
    await expect(storage.remember(PHONE)).resolves.toBe(false);
    await expect(storage.forget()).resolves.toBeUndefined();
  });

  it('logs failures without the phone number', async () => {
    const readLogs = captureLogs();
    setKeyValueStorage(failingDevice());
    const storage = new DeviceRememberedVendorStorage();

    await storage.read();
    await storage.remember(PHONE);
    await storage.forget();

    const logged = readLogs();
    expect(logged).toContain('Failed to remember the vendor');
    expect(logged).not.toContain(PHONE);
  });

  it('discards an unparseable value without logging the text it choked on', async () => {
    // A parse error can quote its input, and the input here is a phone number.
    const readLogs = captureLogs();
    setKeyValueStorage(recordingDevice({ [KEY]: `{"version":1,"phone":"${PHONE}"` }).device);

    await expect(new DeviceRememberedVendorStorage().read()).resolves.toBeNull();

    const logged = readLogs();
    expect(logged).toContain('Discarding a remembered vendor');
    expect(logged).not.toContain(PHONE);
  });

  it('logs a refusal without the value it refused', async () => {
    const readLogs = captureLogs();
    setKeyValueStorage(recordingDevice().device);

    await new DeviceRememberedVendorStorage().remember(CODE);

    expect(readLogs()).not.toContain(CODE);
  });
});
