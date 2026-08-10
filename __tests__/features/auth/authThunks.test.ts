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
  restoreSession,
  signInCustomer,
  signInVendor,
  signOut,
} from '@/features/auth/state/authThunks';
import type { SessionPayload } from '@/features/auth/types';
import {
  configureServices,
  getService,
  registerService,
  resetServices,
} from '@/shared/services/ServiceRegistry';
import type { AuthService } from '@/shared/services/types/AuthService';
import { AppError } from '@/shared/types/error';

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
    vendorApproval: 'approved',
  },
};

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
  return {
    requestCustomerOtp: jest.fn(async () => ({
      maskedDestination: '••••••3210',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      resendAfterSeconds: 30,
    })),
    verifyCustomerOtp: jest.fn(async () => CUSTOMER_SESSION),
    signInVendor: jest.fn(async () => VENDOR_SESSION),
    signOut: jest.fn(async () => undefined),
    ...overrides,
  };
}

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

    expect(peek()).toEqual(CUSTOMER_SESSION);
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
  it('establishes an approved vendor session', async () => {
    const { storage, peek } = createMemoryStorage();
    setSessionStorage(storage);
    registerService('auth', createStubAuthService());
    const store = createStore();

    await signInVendor(store.dispatch, '9000000001', 'FX-VENDOR-APPROVED');

    expect(peek()).toEqual(VENDOR_SESSION);
    expect(store.getState().auth.user?.role).toBe('vendor');
    expect(store.getState().auth.user?.vendorApproval).toBe('approved');
  });

  it('does not retain the vendor code anywhere in state', async () => {
    const { storage } = createMemoryStorage();
    setSessionStorage(storage);
    registerService('auth', createStubAuthService());
    const store = createStore();

    await signInVendor(store.dispatch, '9000000001', 'FX-VENDOR-APPROVED');

    expect(JSON.stringify(store.getState())).not.toContain('FX-VENDOR-APPROVED');
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
    expect(typeof auth.signInVendor).toBe('function');
    expect(typeof auth.signOut).toBe('function');
  });

  it('throws rather than returning undefined when nothing is registered', () => {
    resetServices();

    expect(() => getService('auth')).toThrow(/not registered/i);
  });
});
