/**
 * The thunks are the only writers of session state, so these tests pin the
 * invariant that matters: storage and Redux must never disagree about who is
 * signed in — including when the network fails during sign out.
 *
 * A stub AuthService is used rather than MockAuthService so these assert the
 * thunks' own behaviour, not the mock's.
 */

import { configureStore } from '@reduxjs/toolkit';

import {
  setSessionStorage,
  type PersistedSession,
  type SessionStorage,
} from '@/core/storage/SessionStorage';
import { authReducer } from '@/features/auth/state/authSlice';
import {
  confirmVendorAuthCode,
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
import type { AuthService } from '@/shared/services/types/AuthService';
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

const VENDOR_AUTH_CODE = '482913';

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
  };
  const issuedCode = { code: VENDOR_AUTH_CODE, issuedAt: new Date().toISOString() };

  return {
    requestCustomerOtp: jest.fn(async () => challenge),
    verifyCustomerOtp: jest.fn(async () => CUSTOMER_SESSION),
    registerVendor: jest.fn(async () => ({ registrationId: 'reg_1', challenge })),
    requestVendorOtp: jest.fn(async () => challenge),
    verifyVendorOtp: jest.fn(async () => issuedCode),
    regenerateVendorAuthCode: jest.fn(async () => issuedCode),
    verifyVendorAuthCode: jest.fn(async () => VENDOR_SESSION),
    signInVendor: jest.fn(async () => VENDOR_SESSION),
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
  it('establishes a vendor session', async () => {
    const { storage, peek } = createMemoryStorage();
    setSessionStorage(storage);
    registerService('auth', createStubAuthService());
    const store = createStore();

    await signInVendor(store.dispatch, '9000000001', VENDOR_AUTH_CODE);

    expect(peek()).toEqual(VENDOR_SESSION);
    expect(store.getState().auth.user?.role).toBe('vendor');
  });

  it('does not retain the auth code anywhere in state', async () => {
    const { storage } = createMemoryStorage();
    setSessionStorage(storage);
    registerService('auth', createStubAuthService());
    const store = createStore();

    await signInVendor(store.dispatch, '9000000001', VENDOR_AUTH_CODE);

    expect(JSON.stringify(store.getState())).not.toContain(VENDOR_AUTH_CODE);
  });
});

describe('confirmVendorAuthCode', () => {
  it('is the step that creates the session', async () => {
    const { storage, peek } = createMemoryStorage();
    setSessionStorage(storage);
    const service = createStubAuthService();
    registerService('auth', service);
    const store = createStore();

    await confirmVendorAuthCode(store.dispatch, 'reg_1', REGISTERED_PHONE, VENDOR_AUTH_CODE);

    expect(service.verifyVendorAuthCode).toHaveBeenCalledWith('reg_1', VENDOR_AUTH_CODE);
    // Persisted before it is published, and published only once the vendor has
    // seen their code accepted.
    expect(peek()).toEqual(VENDOR_SESSION);
    expect(store.getState().auth.status).not.toBe('authenticated');

    await settlePublish();

    expect(store.getState().auth.status).toBe('authenticated');
  });

  it('keeps the generated auth code out of Redux', async () => {
    const { storage } = createMemoryStorage();
    setSessionStorage(storage);
    registerService('auth', createStubAuthService());
    const store = createStore();

    await confirmVendorAuthCode(store.dispatch, 'reg_1', REGISTERED_PHONE, VENDOR_AUTH_CODE);

    expect(JSON.stringify(store.getState())).not.toContain(VENDOR_AUTH_CODE);
  });

  it('leaves the vendor unauthenticated when the code is wrong', async () => {
    const { storage, peek } = createMemoryStorage();
    setSessionStorage(storage);
    registerService(
      'auth',
      createStubAuthService({
        verifyVendorAuthCode: jest.fn(async () => {
          throw new AppError({ kind: 'validation', userMessage: 'That code is not correct.' });
        }),
      }),
    );
    const store = createStore();

    await expect(
      confirmVendorAuthCode(store.dispatch, 'reg_1', REGISTERED_PHONE, '111111'),
    ).rejects.toBeInstanceOf(AppError);

    expect(peek()).toBeNull();
    expect(store.getState().auth.status).toBe('bootstrapping');
  });
});

/**
 * A returning vendor on the same device types only their code, because the
 * phone they signed in with is remembered. These pin when it is remembered,
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

    await signInVendor(store.dispatch, '919000000001', VENDOR_AUTH_CODE);

    // The number that just worked with this call — not the account's own
    // formatting of it.
    expect(remembered.peek()).toBe('919000000001');
    expect(order).toEqual(['session', 'remember']);
  });

  it('remembers the number typed at registration when onboarding finishes, not the account’s formatting of it', async () => {
    setSessionStorage(createMemoryStorage().storage);
    const remembered = createRememberedStorage();
    setRememberedVendorStorage(remembered.storage);
    // The account's number has no format contract. Remembered as given, this
    // one would be twelve digits, and the next code-only sign in would send
    // them and fail as a wrong code.
    const service = createStubAuthService({
      verifyVendorAuthCode: jest.fn(async () => ({
        ...VENDOR_SESSION,
        user: { ...VENDOR_SESSION.user, phone: '+919000000001' },
      })),
    });
    registerService('auth', service);
    const store = createStore();

    await confirmVendorAuthCode(store.dispatch, 'reg_1', REGISTERED_PHONE, VENDOR_AUTH_CODE);

    expect(remembered.given).toEqual([REGISTERED_PHONE]);
    // And the number is remembered, never sent: onboarding is keyed by the id.
    expect(service.verifyVendorAuthCode).toHaveBeenCalledWith('reg_1', VENDOR_AUTH_CODE);
    await settlePublish();
  });

  it('never hands the auth code to the device, from either flow', async () => {
    setSessionStorage(createMemoryStorage().storage);
    const remembered = createRememberedStorage();
    setRememberedVendorStorage(remembered.storage);
    registerService('auth', createStubAuthService());
    const store = createStore();

    await signInVendor(store.dispatch, '9000000001', VENDOR_AUTH_CODE);
    await confirmVendorAuthCode(store.dispatch, 'reg_1', REGISTERED_PHONE, VENDOR_AUTH_CODE);
    await settlePublish();

    expect(remembered.given).toHaveLength(2);
    expect(JSON.stringify(remembered.given)).not.toContain(VENDOR_AUTH_CODE);
  });

  it('keeps the previous number when a sign in is refused', async () => {
    setSessionStorage(createMemoryStorage().storage);
    const remembered = createRememberedStorage('9000000002');
    setRememberedVendorStorage(remembered.storage);
    registerService(
      'auth',
      createStubAuthService({
        signInVendor: jest.fn(async () => {
          throw new AppError({ kind: 'unauthorized' });
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
      signInVendor(store.dispatch, '9000000001', VENDOR_AUTH_CODE),
    ).resolves.toEqual(VENDOR_SESSION);

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

describe('ServiceRegistry', () => {
  it('resolves the auth service once configured', () => {
    configureServices();

    const auth = getService('auth');

    expect(typeof auth.requestCustomerOtp).toBe('function');
    expect(typeof auth.verifyCustomerOtp).toBe('function');
    expect(typeof auth.registerVendor).toBe('function');
    expect(typeof auth.requestVendorOtp).toBe('function');
    expect(typeof auth.verifyVendorOtp).toBe('function');
    expect(typeof auth.verifyVendorAuthCode).toBe('function');
    expect(typeof auth.regenerateVendorAuthCode).toBe('function');
    expect(typeof auth.signInVendor).toBe('function');
    expect(typeof auth.signOut).toBe('function');
  });

  it('throws rather than returning undefined when nothing is registered', () => {
    resetServices();

    expect(() => getService('auth')).toThrow(/not registered/i);
  });
});
