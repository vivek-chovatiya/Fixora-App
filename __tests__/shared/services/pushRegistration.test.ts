/**
 * pushRegistration against the rules of phase5-contract.md section 6.3:
 *
 * - push off (no Firebase config) means nothing at all — no permission asked,
 *   no token read, no request sent;
 * - the permission is asked straight after a sign in and only then — never for
 *   a session restored at start-up — and once per device: a second sign in, a
 *   refusal, or onboarding having asked already means no second dialog;
 * - the register call carries exactly `{ token, platform }`, again for every
 *   refreshed token while the session lasts, and not after it;
 * - unregistering waits for a registration already in the air, uses the token
 *   that was sent, and never rejects or outlasts its time limit.
 */

import { AppConfig } from '@/core/config/AppConfig';
import {
  getKeyValueStorage,
  setKeyValueStorage,
  type KeyValueStorage,
} from '@/core/storage/KeyValueStorage';
import {
  noteNotificationPermissionAsked,
  registerPushDevice,
  resetPushRegistration,
  unregisterPushDevice,
} from '@/shared/services/pushRegistration';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type {
  NotificationService,
  PushDeviceRegistration,
} from '@/shared/services/types/NotificationService';
import type {
  PermissionService,
  PermissionStatus,
} from '@/shared/services/types/PermissionService';
import type { PushPlatform, PushService } from '@/shared/services/types/PushService';
import { AppError } from '@/shared/types/error';

/** The device's push, under the test's control. */
class FakePush implements PushService {
  available = true;
  token: string | null = 'device-token-1';
  readonly getToken = jest.fn(async () => this.token);
  private readonly refreshListeners = new Set<(token: string) => void>();

  isAvailable(): boolean {
    return this.available;
  }

  platform(): PushPlatform {
    return 'android';
  }

  onTokenRefresh(listener: (token: string) => void): () => void {
    this.refreshListeners.add(listener);
    return () => {
      this.refreshListeners.delete(listener);
    };
  }

  onForegroundMessage(): () => void {
    return () => undefined;
  }

  onMessageOpened(): () => void {
    return () => undefined;
  }

  async getInitialMessage() {
    return null;
  }

  handleBackgroundMessages(): void {}

  /** The platform issues a new token. */
  refresh(token: string): void {
    [...this.refreshListeners].forEach(listener => listener(token));
  }

  get listening(): number {
    return this.refreshListeners.size;
  }
}

/** The backend's two device calls; anything else on the service would be a mistake here. */
function createDevices() {
  const registerDevice = jest.fn<Promise<void>, [PushDeviceRegistration]>(async () => undefined);
  const unregisterDevice = jest.fn<Promise<void>, [string]>(async () => undefined);
  const service = { registerDevice, unregisterDevice } as unknown as NotificationService;
  return { service, registerDevice, unregisterDevice };
}

function createPermission(status: PermissionStatus = 'denied') {
  const check = jest.fn(async () => status);
  const request = jest.fn(async (): Promise<PermissionStatus> => 'granted');
  const service: PermissionService = { check, request, openSettings: async () => undefined };
  return { service, check, request };
}

/** A device's storage in memory, so each test starts with nothing asked. */
function createMemoryStorage(): KeyValueStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async key => {
      values.delete(key);
    },
  };
}

const originalStorage = getKeyValueStorage();
let push: FakePush;
let devices: ReturnType<typeof createDevices>;
let permission: ReturnType<typeof createPermission>;
let storage: ReturnType<typeof createMemoryStorage>;

beforeEach(() => {
  for (const method of ['log', 'warn', 'error', 'info', 'debug'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
  resetPushRegistration();
  push = new FakePush();
  devices = createDevices();
  permission = createPermission();
  storage = createMemoryStorage();
  setKeyValueStorage(storage);
  registerService('push', push);
  registerService('notification', devices.service);
  registerService('permission', permission.service);
});

afterEach(() => {
  resetPushRegistration();
  resetServices();
  setKeyValueStorage(originalStorage);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** A whole session: signed in (or restored), then signed out. */
async function session(mayAskPermission: boolean): Promise<void> {
  await registerPushDevice({ mayAskPermission });
  await unregisterPushDevice();
}

describe('with push off', () => {
  it('asks nothing, reads nothing and sends nothing', async () => {
    push.available = false;

    await session(true);

    expect(permission.check).not.toHaveBeenCalled();
    expect(permission.request).not.toHaveBeenCalled();
    expect(push.getToken).not.toHaveBeenCalled();
    expect(devices.registerDevice).not.toHaveBeenCalled();
    expect(devices.unregisterDevice).not.toHaveBeenCalled();
    expect(storage.values.size).toBe(0);
  });

  it('does nothing when push is not registered at all', async () => {
    resetServices();

    await expect(session(true)).resolves.toBeUndefined();
  });
});

describe('asking to show notifications', () => {
  it('asks straight after a sign in, once, and never again on a later sign in', async () => {
    await session(true);
    expect(permission.request).toHaveBeenCalledTimes(1);
    expect(permission.request).toHaveBeenCalledWith('notifications');
    expect(storage.values.get(AppConfig.storage.notificationPermissionAskedKey)).toBe('asked');

    await session(true);
    expect(permission.request).toHaveBeenCalledTimes(1);
  });

  it('never asks for a session restored at start-up', async () => {
    await session(false);

    expect(permission.check).not.toHaveBeenCalled();
    expect(permission.request).not.toHaveBeenCalled();
    // …but the device is still paired with the restored session.
    expect(devices.registerDevice).toHaveBeenCalledTimes(1);
  });

  it('respects a refusal: the next sign in does not ask again', async () => {
    permission.request.mockImplementation(async () => 'denied');

    await session(true);
    await session(true);

    expect(permission.request).toHaveBeenCalledTimes(1);
  });

  it('does not ask after onboarding already asked', async () => {
    await noteNotificationPermissionAsked();

    await session(true);

    expect(permission.request).not.toHaveBeenCalled();
  });

  it('shows no dialog when there is nothing to ask — granted, blocked, or Android before 13', async () => {
    for (const status of ['granted', 'blocked', 'unavailable'] as const) {
      storage.values.clear();
      permission.check.mockImplementation(async () => status);

      await session(true);
    }

    expect(permission.request).not.toHaveBeenCalled();
  });

  it('does not ask when it cannot note that it asked', async () => {
    storage.setItem = async () => {
      throw new AppError({ kind: 'unknown', message: 'disk full' });
    };

    await session(true);

    expect(permission.request).not.toHaveBeenCalled();
    // Pairing does not depend on the permission.
    expect(devices.registerDevice).toHaveBeenCalledTimes(1);
  });
});

describe('registering the device', () => {
  it('sends exactly { token, platform }', async () => {
    await registerPushDevice({ mayAskPermission: false });

    expect(devices.registerDevice).toHaveBeenCalledTimes(1);
    const [sent] = devices.registerDevice.mock.calls[0];
    expect(Object.keys(sent).sort()).toEqual(['platform', 'token']);
    expect(sent).toEqual({ token: 'device-token-1', platform: 'android' });
  });

  it('registers every refreshed token while the session lasts, and none after it', async () => {
    await registerPushDevice({ mayAskPermission: false });

    push.refresh('device-token-2');
    await Promise.resolve();
    expect(devices.registerDevice).toHaveBeenLastCalledWith({
      token: 'device-token-2',
      platform: 'android',
    });

    await unregisterPushDevice();
    expect(push.listening).toBe(0);
    push.refresh('device-token-3');
    expect(devices.registerDevice).toHaveBeenCalledTimes(2);
  });

  it('listens for refreshed tokens once, however many times a session is registered', async () => {
    await registerPushDevice({ mayAskPermission: false });
    await registerPushDevice({ mayAskPermission: false });

    expect(push.listening).toBe(1);
  });

  it('sends nothing when the device has no token', async () => {
    push.token = null;

    await registerPushDevice({ mayAskPermission: false });

    expect(devices.registerDevice).not.toHaveBeenCalled();
  });

  it('never rejects when the backend refuses', async () => {
    devices.registerDevice.mockImplementation(async () => {
      throw new AppError({ kind: 'network' });
    });

    await expect(registerPushDevice({ mayAskPermission: false })).resolves.toBeUndefined();
  });
});

describe('unregistering the device', () => {
  it('unregisters the token this session sent', async () => {
    await registerPushDevice({ mayAskPermission: false });
    push.refresh('device-token-2');
    await Promise.resolve();

    await unregisterPushDevice();

    expect(devices.unregisterDevice).toHaveBeenCalledTimes(1);
    expect(devices.unregisterDevice).toHaveBeenCalledWith('device-token-2');
  });

  it("falls back to the device's own token when this start registered none", async () => {
    await unregisterPushDevice();

    expect(devices.unregisterDevice).toHaveBeenCalledWith('device-token-1');
  });

  it('lets a registration already in the air land first', async () => {
    const order: string[] = [];
    let land!: () => void;
    devices.registerDevice.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          land = () => {
            order.push('register');
            resolve();
          };
        }),
    );
    devices.unregisterDevice.mockImplementation(async () => {
      order.push('unregister');
    });

    const registering = registerPushDevice({ mayAskPermission: false });
    // The token has been read and the register call is out.
    for (let tick = 0; tick < 20 && devices.registerDevice.mock.calls.length === 0; tick += 1) {
      await Promise.resolve();
    }
    expect(devices.registerDevice).toHaveBeenCalledTimes(1);
    const unregistering = unregisterPushDevice();
    land();
    await Promise.all([registering, unregistering]);

    expect(order).toEqual(['register', 'unregister']);
    // The session was over by the time the registration landed: no listener left behind.
    expect(push.listening).toBe(0);
  });

  it('never rejects when the backend refuses', async () => {
    devices.unregisterDevice.mockImplementation(async () => {
      throw new AppError({ kind: 'unauthorized' });
    });

    await expect(unregisterPushDevice()).resolves.toBeUndefined();
  });

  it('gives up after its time limit rather than hold the sign out', async () => {
    jest.useFakeTimers();
    devices.unregisterDevice.mockImplementation(() => new Promise<void>(() => undefined));

    let finished = false;
    const unregistering = unregisterPushDevice().then(() => {
      finished = true;
    });

    await jest.advanceTimersByTimeAsync(AppConfig.push.unregisterTimeoutMs - 1);
    expect(finished).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await unregistering;
    expect(finished).toBe(true);
  });
});
