/**
 * The thunks are the only writers of session state, so these tests pin the
 * invariant that matters: storage and Redux must never disagree about who is
 * signed in — including when the network fails during sign out.
 *
 * A stub AuthService is used rather than MockAuthService so these assert the
 * thunks' own behaviour, not the mock's.
 *
 * Since 28/11/2026 (phase5-contract.md section 1) both vendor thunks end a
 * one-time code: `signInVendor` calls `verifyVendorSignInOtp`, and
 * `completeVendorRegistration` calls `verifyVendorOtp`, which now answers with
 * the session. There is no auth-code step left to test.
 */

import { configureStore } from '@reduxjs/toolkit';

import {
  setSessionStorage,
  type PersistedSession,
  type SessionStorage,
} from '@/core/storage/SessionStorage';
import { authReducer } from '@/features/auth/state/authSlice';
import {
  completeVendorRegistration,
  restoreSession,
  signInCustomer,
  signInVendor,
  signOut,
} from '@/features/auth/state/authThunks';
import {
  setRememberedVendorStorage,
  type RememberedVendorStorage,
} from '@/features/auth/state/rememberedVendorStorage';
import type { SessionPayload } from '@/features/auth/types';
import {
  configureServices,
  getService,
  registerService,
  resetServices,
} from '@/shared/services/ServiceRegistry';
import { resetPushRegistration } from '@/shared/services/pushRegistration';
import type { AuthService } from '@/shared/services/types/AuthService';
import type { NotificationService } from '@/shared/services/types/NotificationService';
import type { PushService } from '@/shared/services/types/PushService';
import { duration } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

/**
 * Lets a scheduled publish fire.
 *
 * The flows that end in an animation resolve before they dispatch, so that the
 * screen showing the verified state is still mounted when it learns it
 * succeeded. Waiting the hold out is what the user does by watching it.
 */
const settlePublish = () =>
  new Promise<void>(resolve => setTimeout(resolve, duration.verifiedHold + 50));

const CUSTOMER_SESSION: SessionPayload = {
  token: 'token_customer',
  user: {
    id: 'usr_1',
    firstName: 'Asha',
    lastName: 'Patel',
    phone: '9876543210',
    role: 'customer',
  },
};

const VENDOR_SESSION: SessionPayload = {
  token: 'token_vendor',
  user: {
    id: 'usr_2',
    firstName: 'Ravi',
    lastName: 'Kumar',
    phone: '9000000001',
    role: 'vendor',
  },
};

/** A one-time code distinct from every other digit run in these fixtures. */
const VENDOR_OTP = '482913';

/** The number a vendor typed at registration, normalised as it was sent. */
const REGISTERED_PHONE = '9000000001';

/**
 * A remembered-vendor store that records every value it is handed, and the
 * order it was handed them in relative to the session write.
 */
function createRememberedStorage(initial: string | null = null) {
  let phone = initial;
  const given: unknown[] = [];
  const storage: RememberedVendorStorage = {
    read: jest.fn(async () => phone),
    remember: jest.fn(async (value: string) => {
      given.push(value);
      phone = value;
      return true;
    }),
    forget: jest.fn(async () => {
      phone = null;
    }),
  };
  return { storage, given, peek: () => phone };
}

function createMemoryStorage(initial: PersistedSession | null = null) {
  let value = initial;
  const storage: SessionStorage = {
    read: jest.fn(async () => value),
    write: jest.fn(async session => {
      value = session;
    }),
    clear: jest.fn(async () => {
      value = null;
    }),
  };
  return { storage, peek: () => value };
}

function createStore() {
  return configureStore({ reducer: { auth: authReducer } });
}

function createStubAuthService(overrides: Partial<AuthService> = {}): AuthService {
  const challenge = {
    maskedDestination: '••••••3210',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    resendAfterSeconds: 30,
    deliveryChannel: 'NONE' as const,
  };

  return {
    requestCustomerOtp: jest.fn(async () => challenge),
    verifyCustomerOtp: jest.fn(async () => CUSTOMER_SESSION),
    registerVendor: jest.fn(async () => ({ registrationId: 'reg_1', challenge })),
    requestVendorOtp: jest.fn(async () => challenge),
    verifyVendorOtp: jest.fn(async () => VENDOR_SESSION),
    requestVendorSignInOtp: jest.fn(async () => challenge),
    verifyVendorSignInOtp: jest.fn(async () => VENDOR_SESSION),
    signOut: jest.fn(async () => undefined),
    ...overrides,
  };
}

beforeEach(() => {
  // Kept off the device for every test; the block that is about it installs
  // its own and reads it.
  setRememberedVendorStorage(createRememberedStorage().storage);
});

afterEach(() => {
  resetServices();
});

describe('restoreSession', () => {
  it('authenticates from a stored session', async () => {
    const { storage } = createMemoryStorage(CUSTOMER_SESSION);
    setSessionStorage(storage);
    const store = createStore();

    await restoreSession(store.dispatch);

    expect(store.getState().auth.status).toBe('authenticated');
    expect(store.getState().auth.user?.role).toBe('customer');
    expect(store.getState().auth.token).toBe('token_customer');
  });

  it('resolves to unauthenticated when nothing is stored', async () => {
    const { storage } = createMemoryStorage(null);
    setSessionStorage(storage);
    const store = createStore();

    await restoreSession(store.dispatch);

    expect(store.getState().auth.status).toBe('unauthenticated');
    expect(store.getState().auth.user).toBeNull();
  });

  it('leaves the app usable when storage fails to read', async () => {
    setSessionStorage({
      read: jest.fn(async () => null),
      write: jest.fn(async () => undefined),
      clear: jest.fn(async () => undefined),
    });
    const store = createStore();

    await restoreSession(store.dispatch);

    expect(store.getState().auth.status).toBe('unauthenticated');
  });
});

describe('signInCustomer', () => {
  it('persists the session before publishing it to state', async () => {
    const { storage, peek } = createMemoryStorage();
    setSessionStorage(storage);
    registerService('auth', createStubAuthService());
    const store = createStore();

    await signInCustomer(store.dispatch, '9876543210', '123456');

    // Durable immediately. Killed here, the app restarts signed in.
    expect(peek()).toEqual(CUSTOMER_SESSION);
    // Not yet published: the verification screen is still showing that the code
    // was accepted, and publishing would unmount it mid-animation.
    expect(store.getState().auth.status).not.toBe('authenticated');

    await settlePublish();

    expect(store.getState().auth.status).toBe('authenticated');
    expect(store.getState().auth.user?.role).toBe('customer');
  });

  it('leaves state untouched when verification fails', async () => {
    const { storage, peek } = createMemoryStorage();
    setSessionStorage(storage);
    registerService(
      'auth',
      createStubAuthService({
        verifyCustomerOtp: jest.fn(async () => {
          throw new AppError({ kind: 'validation', userMessage: 'That code is not correct.' });
        }),
      }),
    );
    const store = createStore();

    await expect(signInCustomer(store.dispatch, '9876543210', '000000')).rejects.toBeInstanceOf(
      AppError,
    );

    expect(peek()).toBeNull();
    expect(store.getState().auth.status).toBe('bootstrapping');
  });
});

describe('signInVendor', () => {
  it('verifies the one-time code, persists, then publishes after the hold', async () => {
    const { storage, peek } = createMemoryStorage();
    setSessionStorage(storage);
    const service = createStubAuthService();
    registerService('auth', service);
    const store = createStore();

    await signInVendor(store.dispatch, '9000000001', VENDOR_OTP);

    expect(service.verifyVendorSignInOtp).toHaveBeenCalledWith('9000000001', VENDOR_OTP);
    // Durable at once; published once the code screen's verified state is seen.
    expect(peek()).toEqual(VENDOR_SESSION);
    expect(store.getState().auth.status).not.toBe('authenticated');

    await settlePublish();

    expect(store.getState().auth.status).toBe('authenticated');
    expect(store.getState().auth.user?.role).toBe('vendor');
  });

  it('calls nothing but the vendor sign-in verification', async () => {
    setSessionStorage(createMemoryStorage().storage);
    const service = createStubAuthService();
    registerService('auth', service);
    const store = createStore();

    await signInVendor(store.dispatch, '9000000001', VENDOR_OTP);
    await settlePublish();

    expect(service.verifyVendorOtp).not.toHaveBeenCalled();
    expect(service.verifyCustomerOtp).not.toHaveBeenCalled();
    expect(service.requestVendorSignInOtp).not.toHaveBeenCalled();
  });

  it('does not retain the code anywhere in state', async () => {
    const { storage } = createMemoryStorage();
    setSessionStorage(storage);
    registerService('auth', createStubAuthService());
    const store = createStore();

    await signInVendor(store.dispatch, '9000000001', VENDOR_OTP);
    await settlePublish();

    expect(JSON.stringify(store.getState())).not.toContain(VENDOR_OTP);
  });

  it('leaves the vendor unauthenticated when the code is refused', async () => {
    const { storage, peek } = createMemoryStorage();
    setSessionStorage(storage);
    registerService(
      'auth',
      createStubAuthService({
        verifyVendorSignInOtp: jest.fn(async () => {
          throw new AppError({ kind: 'validation', code: 'OTP_INVALID' });
        }),
      }),
    );
    const store = createStore();

    await expect(signInVendor(store.dispatch, '9000000001', '111111')).rejects.toBeInstanceOf(
      AppError,
    );

    expect(peek()).toBeNull();
    expect(store.getState().auth.status).toBe('bootstrapping');
  });
});

describe('completeVendorRegistration', () => {
  it('verifies the registration code, and that creates the session', async () => {
    const { storage, peek } = createMemoryStorage();
    setSessionStorage(storage);
    const service = createStubAuthService();
    registerService('auth', service);
    const store = createStore();

    await completeVendorRegistration(store.dispatch, 'reg_1', REGISTERED_PHONE, VENDOR_OTP);

    // Keyed by the registration id alone; the phone is never sent here.
    expect(service.verifyVendorOtp).toHaveBeenCalledWith('reg_1', VENDOR_OTP);
    expect(service.verifyVendorSignInOtp).not.toHaveBeenCalled();
    // Persisted before it is published, and published only once the vendor has
    // seen their code accepted.
    expect(peek()).toEqual(VENDOR_SESSION);
    expect(store.getState().auth.status).not.toBe('authenticated');

    await settlePublish();

    expect(store.getState().auth.status).toBe('authenticated');
  });

  it('keeps the code out of Redux', async () => {
    const { storage } = createMemoryStorage();
    setSessionStorage(storage);
    registerService('auth', createStubAuthService());
    const store = createStore();

    await completeVendorRegistration(store.dispatch, 'reg_1', REGISTERED_PHONE, VENDOR_OTP);
    await settlePublish();

    expect(JSON.stringify(store.getState())).not.toContain(VENDOR_OTP);
  });

  it('leaves the vendor unauthenticated when the code is wrong', async () => {
    const { storage, peek } = createMemoryStorage();
    setSessionStorage(storage);
    registerService(
      'auth',
      createStubAuthService({
        verifyVendorOtp: jest.fn(async () => {
          throw new AppError({ kind: 'validation', code: 'OTP_INVALID' });
        }),
      }),
    );
    const store = createStore();

    await expect(
      completeVendorRegistration(store.dispatch, 'reg_1', REGISTERED_PHONE, '111111'),
    ).rejects.toBeInstanceOf(AppError);

    expect(peek()).toBeNull();
    expect(store.getState().auth.status).toBe('bootstrapping');
  });
});

/**
 * A returning vendor on the same device is asked for a code in one tap, because
 * the phone they signed in with is remembered. These pin when it is remembered,
 * which number, and above all that the code is never what is kept.
 */
describe('remembering the vendor phone', () => {
  it('remembers the number a vendor signed in with, once the session is stored', async () => {
    const order: string[] = [];
    const session = createMemoryStorage();
    setSessionStorage({
      ...session.storage,
      write: jest.fn(async (value: PersistedSession) => {
        order.push('session');
        await session.storage.write(value);
      }),
    });
    const remembered = createRememberedStorage();
    setRememberedVendorStorage({
      ...remembered.storage,
      remember: jest.fn(async (value: string) => {
        order.push('remember');
        return remembered.storage.remember(value);
      }),
    });
    registerService('auth', createStubAuthService());
    const store = createStore();

    await signInVendor(store.dispatch, '919000000001', VENDOR_OTP);

    // The number that just worked with this call — not the account's own
    // formatting of it.
    expect(remembered.peek()).toBe('919000000001');
    expect(order).toEqual(['session', 'remember']);
    await settlePublish();
  });

  it('remembers the number typed at registration when onboarding finishes, not the account’s formatting of it', async () => {
    setSessionStorage(createMemoryStorage().storage);
    const remembered = createRememberedStorage();
    setRememberedVendorStorage(remembered.storage);
    // The account's number has no format contract. Remembered as given, this
    // one would be twelve digits, and the next sign in would send a code to
    // them and be refused as a wrong one.
    const service = createStubAuthService({
      verifyVendorOtp: jest.fn(async () => ({
        ...VENDOR_SESSION,
        user: { ...VENDOR_SESSION.user, phone: '+919000000001' },
      })),
    });
    registerService('auth', service);
    const store = createStore();

    await completeVendorRegistration(store.dispatch, 'reg_1', REGISTERED_PHONE, VENDOR_OTP);

    expect(remembered.given).toEqual([REGISTERED_PHONE]);
    // And the number is remembered, never sent: onboarding is keyed by the id.
    expect(service.verifyVendorOtp).toHaveBeenCalledWith('reg_1', VENDOR_OTP);
    await settlePublish();
  });

  it('never hands the code to the device, from either flow', async () => {
    setSessionStorage(createMemoryStorage().storage);
    const remembered = createRememberedStorage();
    setRememberedVendorStorage(remembered.storage);
    registerService('auth', createStubAuthService());
    const store = createStore();

    await signInVendor(store.dispatch, '9000000001', VENDOR_OTP);
    await completeVendorRegistration(store.dispatch, 'reg_1', REGISTERED_PHONE, VENDOR_OTP);
    await settlePublish();

    expect(remembered.given).toHaveLength(2);
    expect(JSON.stringify(remembered.given)).not.toContain(VENDOR_OTP);
  });

  it('keeps the previous number when a sign in is refused', async () => {
    setSessionStorage(createMemoryStorage().storage);
    const remembered = createRememberedStorage('9000000002');
    setRememberedVendorStorage(remembered.storage);
    registerService(
      'auth',
      createStubAuthService({
        verifyVendorSignInOtp: jest.fn(async () => {
          throw new AppError({ kind: 'validation', code: 'OTP_INVALID' });
        }),
      }),
    );
    const store = createStore();

    await expect(
      signInVendor(store.dispatch, '9000000001', '111111'),
    ).rejects.toBeInstanceOf(AppError);

    // The refusal says nothing about whether the account exists, so the
    // number that worked last time stays.
    expect(remembered.storage.remember).not.toHaveBeenCalled();
    expect(remembered.storage.forget).not.toHaveBeenCalled();
    expect(remembered.peek()).toBe('9000000002');
  });

  it('does not let a broken store undo a sign in', async () => {
    const { storage, peek } = createMemoryStorage();
    setSessionStorage(storage);
    setRememberedVendorStorage({
      read: jest.fn(async () => null),
      remember: jest.fn(async () => {
        throw new Error('device unavailable');
      }),
      forget: jest.fn(async () => undefined),
    });
    registerService('auth', createStubAuthService());
    const store = createStore();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      signInVendor(store.dispatch, '9000000001', VENDOR_OTP),
    ).resolves.toEqual(VENDOR_SESSION);
    await settlePublish();

    expect(peek()).toEqual(VENDOR_SESSION);
    expect(store.getState().auth.status).toBe('authenticated');
    // Said, not swallowed — and said without the number.
    expect(JSON.stringify(warn.mock.calls)).toContain('Could not remember the vendor phone');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('9000000001');
    warn.mockRestore();
  });

  it('remembers nothing for a customer', async () => {
    setSessionStorage(createMemoryStorage().storage);
    const remembered = createRememberedStorage();
    setRememberedVendorStorage(remembered.storage);
    registerService('auth', createStubAuthService());
    const store = createStore();

    await signInCustomer(store.dispatch, '9876543210', '123456');
    await settlePublish();

    expect(remembered.storage.remember).not.toHaveBeenCalled();
  });

  it('survives signing out — that is what it is for', async () => {
    const { storage } = createMemoryStorage(VENDOR_SESSION);
    setSessionStorage(storage);
    const remembered = createRememberedStorage('9000000001');
    setRememberedVendorStorage(remembered.storage);
    registerService('auth', createStubAuthService());
    const store = createStore();
    await restoreSession(store.dispatch);

    await signOut(store.dispatch);

    expect(remembered.storage.forget).not.toHaveBeenCalled();
    expect(remembered.peek()).toBe('9000000001');
  });
});

describe('signOut', () => {
  it('clears storage and state', async () => {
    const { storage, peek } = createMemoryStorage(CUSTOMER_SESSION);
    setSessionStorage(storage);
    const service = createStubAuthService();
    registerService('auth', service);
    const store = createStore();
    await restoreSession(store.dispatch);

    await signOut(store.dispatch);

    expect(service.signOut).toHaveBeenCalled();
    expect(peek()).toBeNull();
    expect(store.getState().auth.status).toBe('unauthenticated');
    expect(store.getState().auth.token).toBeNull();
  });

  it('still signs the user out locally when the server call fails', async () => {
    const { storage, peek } = createMemoryStorage(CUSTOMER_SESSION);
    setSessionStorage(storage);
    registerService(
      'auth',
      createStubAuthService({
        signOut: jest.fn(async () => {
          throw new AppError({ kind: 'network' });
        }),
      }),
    );
    const store = createStore();
    await restoreSession(store.dispatch);

    await expect(signOut(store.dispatch)).resolves.toBeUndefined();

    expect(peek()).toBeNull();
    expect(store.getState().auth.status).toBe('unauthenticated');
  });
});

/*
  Push (phase5-contract.md sections 6.1 and 6.3): this device stops receiving
  the account's notifications before `/auth/logout`, while the session can
  still authorise the call — and a failure there changes nothing about
  signing out. A forced sign out (the server refused the session) starts the
  unregister and does not wait for it; the person's own Log out does.
*/
describe('signOut with push on', () => {
  /** Push on, with this device's token; nothing else about it is used here. */
  function pushOn(): PushService {
    const off = () => () => undefined;
    return {
      isAvailable: () => true,
      platform: () => 'android',
      getToken: async () => 'device-token',
      onTokenRefresh: off,
      onForegroundMessage: off,
      onMessageOpened: off,
      getInitialMessage: async () => null,
      handleBackgroundMessages: () => undefined,
    };
  }

  function devices(unregisterDevice: NotificationService['unregisterDevice']): NotificationService {
    return { unregisterDevice } as unknown as NotificationService;
  }

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    resetPushRegistration();
  });

  afterEach(() => {
    resetPushRegistration();
    jest.restoreAllMocks();
  });

  it('unregisters the device before the server sign out', async () => {
    const { storage } = createMemoryStorage(CUSTOMER_SESSION);
    setSessionStorage(storage);
    const order: string[] = [];
    registerService('push', pushOn());
    const unregisterDevice = jest.fn(async () => {
      order.push('unregister');
    });
    registerService('notification', devices(unregisterDevice));
    registerService(
      'auth',
      createStubAuthService({
        signOut: jest.fn(async () => {
          order.push('logout');
        }),
      }),
    );
    const store = createStore();
    await restoreSession(store.dispatch);

    await signOut(store.dispatch);

    expect(order).toEqual(['unregister', 'logout']);
    expect(unregisterDevice).toHaveBeenCalledWith('device-token');
  });

  it('still calls logout and signs out when unregistering fails', async () => {
    const { storage, peek } = createMemoryStorage(CUSTOMER_SESSION);
    setSessionStorage(storage);
    registerService('push', pushOn());
    registerService(
      'notification',
      devices(
        jest.fn(async () => {
          throw new AppError({ kind: 'network' });
        }),
      ),
    );
    const auth = createStubAuthService();
    registerService('auth', auth);
    const store = createStore();
    await restoreSession(store.dispatch);

    await expect(signOut(store.dispatch)).resolves.toBeUndefined();

    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(peek()).toBeNull();
    expect(store.getState().auth.status).toBe('unauthenticated');
  });

  /** An unregister call that stays in the air until the test lets it land. */
  function heldUnregister() {
    let land!: () => void;
    let landed = false;
    const unregisterDevice = jest.fn(
      () =>
        new Promise<void>(resolve => {
          land = () => {
            landed = true;
            resolve();
          };
        }),
    );
    return { unregisterDevice, land: () => land(), landed: () => landed };
  }

  /**
   * Lets every promise already settled run on, without moving any clock — so
   * nothing that waits on the unregister's timeout can get past it.
   */
  async function flush(): Promise<void> {
    for (let tick = 0; tick < 50; tick += 1) {
      await Promise.resolve();
    }
  }

  it('clears a forced sign out at once, with the unregister still in the air', async () => {
    const { storage, peek } = createMemoryStorage(CUSTOMER_SESSION);
    setSessionStorage(storage);
    registerService('push', pushOn());
    const held = heldUnregister();
    registerService('notification', devices(held.unregisterDevice));
    const auth = createStubAuthService();
    registerService('auth', auth);
    const store = createStore();
    await restoreSession(store.dispatch);

    let finished = false;
    const leaving = signOut(store.dispatch, { forced: true }).then(() => {
      finished = true;
    });
    await flush();

    // Finished — signed out on this device and told to the server — while the
    // unregister has not answered and no timer has run: nothing waited for it.
    expect(finished).toBe(true);
    expect(held.landed()).toBe(false);
    expect(held.unregisterDevice).toHaveBeenCalledWith('device-token');
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(peek()).toBeNull();
    expect(store.getState().auth.status).toBe('unauthenticated');

    // Let it land, so its timeout is cleared before the next test.
    held.land();
    await leaving;
    await flush();
  });

  it('waits for the unregister before the server sign out when the person logs out', async () => {
    const { storage, peek } = createMemoryStorage(CUSTOMER_SESSION);
    setSessionStorage(storage);
    registerService('push', pushOn());
    const held = heldUnregister();
    registerService('notification', devices(held.unregisterDevice));
    const auth = createStubAuthService();
    registerService('auth', auth);
    const store = createStore();
    await restoreSession(store.dispatch);

    const leaving = signOut(store.dispatch);
    await flush();

    // Held at the unregister: the server is not told, and the session is still here.
    expect(held.unregisterDevice).toHaveBeenCalledWith('device-token');
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(peek()).toEqual(CUSTOMER_SESSION);
    expect(store.getState().auth.status).toBe('authenticated');

    held.land();
    await leaving;

    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(peek()).toBeNull();
    expect(store.getState().auth.status).toBe('unauthenticated');
  });

  it('sends nothing to unregister when push is off', async () => {
    const { storage } = createMemoryStorage(CUSTOMER_SESSION);
    setSessionStorage(storage);
    registerService('push', { ...pushOn(), isAvailable: () => false });
    const unregisterDevice = jest.fn(async () => undefined);
    registerService('notification', devices(unregisterDevice));
    const auth = createStubAuthService();
    registerService('auth', auth);
    const store = createStore();
    await restoreSession(store.dispatch);

    await signOut(store.dispatch);

    expect(unregisterDevice).not.toHaveBeenCalled();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});

describe('ServiceRegistry', () => {
  it('resolves the auth service once configured', () => {
    configureServices();

    const auth = getService('auth');

    expect(typeof auth.requestCustomerOtp).toBe('function');
    expect(typeof auth.verifyCustomerOtp).toBe('function');
    expect(typeof auth.registerVendor).toBe('function');
    expect(typeof auth.requestVendorOtp).toBe('function');
    expect(typeof auth.verifyVendorOtp).toBe('function');
    expect(typeof auth.requestVendorSignInOtp).toBe('function');
    expect(typeof auth.verifyVendorSignInOtp).toBe('function');
    expect(typeof auth.signOut).toBe('function');
    // The retired auth code left nothing behind on the registered service.
    const methods = auth as unknown as Record<string, unknown>;
    for (const retired of ['verifyVendorAuthCode', 'regenerateVendorAuthCode', 'signInVendor']) {
      expect(methods[retired]).toBeUndefined();
    }
  });

  it('throws rather than returning undefined when nothing is registered', () => {
    resetServices();

    expect(() => getService('auth')).toThrow(/not registered/i);
  });
});
