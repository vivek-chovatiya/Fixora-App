/**
 * The auth thunks are the only writers of session state, which makes them the
 * one place analytics and crash reporting learn who is signed in, and the one
 * place section 54's sign in and sign up events are sent from. Pinned here:
 *
 * - each event is sent exactly once, at the moment a session exists, and never
 *   when sign in fails — not again when the delayed publish lands;
 * - an event carries the role and nothing else — asserted as the exact key
 *   set — and no phone number, name or one-time code appears anywhere either
 *   service was handed (section 7A);
 * - the user is identified before the event, so the event is theirs;
 * - a vendor finishing onboarding — the registration code, which signs them in
 *   since 28/11/2026 (phase5-contract.md section 1.2) — is a sign up, not a
 *   login as well;
 * - restoring a session identifies without sending anything, and signing out
 *   clears both services;
 * - analytics failing never fails a sign in (section 54).
 *
 * Stub services record the calls, as authThunks.test.ts does for the auth
 * service, so these assert the thunks' behaviour and not a mock's.
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
import type { SessionPayload } from '@/features/auth/types';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { AuthService } from '@/shared/services/types/AuthService';
import { duration } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const settlePublish = () =>
  new Promise<void>(resolve => setTimeout(resolve, duration.verifiedHold + 50));

const CUSTOMER_PHONE = '9876543210';
const VENDOR_PHONE = '9000000001';
const OTP = '123456';
/** A vendor's one-time code, distinct from the customer's `OTP`. */
const VENDOR_OTP = '482913';

const CUSTOMER_SESSION: SessionPayload = {
  token: 'token_customer',
  user: {
    id: 'usr_customer_1',
    firstName: 'Asha',
    lastName: 'Patel',
    email: 'asha@example.com',
    phone: CUSTOMER_PHONE,
    role: 'customer',
  },
};

const VENDOR_SESSION: SessionPayload = {
  token: 'token_vendor',
  user: {
    id: 'usr_vendor_1',
    firstName: 'Ravi',
    lastName: 'Kumar',
    phone: VENDOR_PHONE,
    role: 'vendor',
  },
};

/** Nothing either telemetry service was handed may contain any of these. */
const NEVER_SENT = [
  CUSTOMER_PHONE,
  VENDOR_PHONE,
  OTP,
  VENDOR_OTP,
  'Asha',
  'Patel',
  'Ravi',
  'Kumar',
  'asha@example.com',
  'token_customer',
  'token_vendor',
];

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
  return storage;
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

function registerTelemetry() {
  const analytics = { track: jest.fn(), identify: jest.fn() };
  const crashReporter = { recordError: jest.fn(), setUser: jest.fn() };
  registerService('analytics', analytics);
  registerService('crashReporter', crashReporter);
  return { analytics, crashReporter };
}

function expectNothingPersonal(...mocks: jest.Mock[]) {
  const serialised = JSON.stringify(mocks.map(mock => mock.mock.calls));
  for (const value of NEVER_SENT) {
    expect(serialised).not.toContain(value);
  }
}

const wrongCode = () =>
  jest.fn(async () => {
    throw new AppError({ kind: 'validation', userMessage: 'That code is not correct.' });
  });

afterEach(() => {
  resetServices();
});

describe('customer sign in', () => {
  it('sends login_completed once, with the role alone, after identifying the customer', async () => {
    setSessionStorage(createMemoryStorage());
    registerService('auth', createStubAuthService());
    const { analytics, crashReporter } = registerTelemetry();
    const store = createStore();

    await signInCustomer(store.dispatch, CUSTOMER_PHONE, OTP);
    await settlePublish();

    expect(analytics.track).toHaveBeenCalledTimes(1);
    const [event, properties] = analytics.track.mock.calls[0];
    expect(event).toBe('login_completed');
    expect(Object.keys(properties).sort()).toEqual(['role']);
    expect(properties).toEqual({ role: 'customer' });

    expect(analytics.identify).toHaveBeenCalledTimes(1);
    expect(analytics.identify).toHaveBeenCalledWith({ id: 'usr_customer_1', role: 'customer' });
    expect(crashReporter.setUser).toHaveBeenCalledWith({ id: 'usr_customer_1', role: 'customer' });
    expect(analytics.identify.mock.invocationCallOrder[0]).toBeLessThan(
      analytics.track.mock.invocationCallOrder[0],
    );

    expectNothingPersonal(
      analytics.track,
      analytics.identify,
      crashReporter.setUser,
      crashReporter.recordError,
    );
  });

  it('does not claim a sign up it cannot know about', async () => {
    setSessionStorage(createMemoryStorage());
    registerService('auth', createStubAuthService());
    const { analytics } = registerTelemetry();
    const store = createStore();

    await signInCustomer(store.dispatch, CUSTOMER_PHONE, OTP);
    await settlePublish();

    expect(analytics.track.mock.calls.map(call => call[0])).not.toContain('signup_completed');
  });

  it('sends nothing and identifies nobody when the code is wrong', async () => {
    setSessionStorage(createMemoryStorage());
    registerService('auth', createStubAuthService({ verifyCustomerOtp: wrongCode() }));
    const { analytics, crashReporter } = registerTelemetry();
    const store = createStore();

    await expect(signInCustomer(store.dispatch, CUSTOMER_PHONE, '000000')).rejects.toBeInstanceOf(
      AppError,
    );

    expect(analytics.track).not.toHaveBeenCalled();
    expect(analytics.identify).not.toHaveBeenCalled();
    expect(crashReporter.setUser).not.toHaveBeenCalled();
  });

  it('still signs the customer in when analytics throws', async () => {
    setSessionStorage(createMemoryStorage());
    registerService('auth', createStubAuthService());
    const explode = () => {
      throw new Error('provider exploded');
    };
    registerService('analytics', { track: jest.fn(explode), identify: jest.fn(explode) });
    const store = createStore();

    await expect(signInCustomer(store.dispatch, CUSTOMER_PHONE, OTP)).resolves.toEqual(
      CUSTOMER_SESSION,
    );
    await settlePublish();

    expect(store.getState().auth.status).toBe('authenticated');
  });
});

describe('vendor sign in', () => {
  it('sends login_completed once, with the role alone, and never the code', async () => {
    setSessionStorage(createMemoryStorage());
    registerService('auth', createStubAuthService());
    const { analytics, crashReporter } = registerTelemetry();
    const store = createStore();

    await signInVendor(store.dispatch, VENDOR_PHONE, VENDOR_OTP);
    // Not again when the delayed publish lands.
    await settlePublish();

    expect(analytics.track).toHaveBeenCalledTimes(1);
    const [event, properties] = analytics.track.mock.calls[0];
    expect(event).toBe('login_completed');
    expect(Object.keys(properties).sort()).toEqual(['role']);
    expect(properties).toEqual({ role: 'vendor' });
    expect(analytics.identify).toHaveBeenCalledWith({ id: 'usr_vendor_1', role: 'vendor' });
    expect(crashReporter.setUser).toHaveBeenCalledWith({ id: 'usr_vendor_1', role: 'vendor' });

    expectNothingPersonal(analytics.track, analytics.identify, crashReporter.setUser);
  });

  it('sends nothing when the code is wrong', async () => {
    setSessionStorage(createMemoryStorage());
    registerService('auth', createStubAuthService({ verifyVendorSignInOtp: wrongCode() }));
    const { analytics } = registerTelemetry();
    const store = createStore();

    await expect(
      signInVendor(store.dispatch, VENDOR_PHONE, '111111'),
    ).rejects.toBeInstanceOf(AppError);

    expect(analytics.track).not.toHaveBeenCalled();
    expect(analytics.identify).not.toHaveBeenCalled();
  });
});

describe('vendor onboarding', () => {
  it('sends vendor_signup once when the registration code is verified — and not login_completed', async () => {
    setSessionStorage(createMemoryStorage());
    registerService('auth', createStubAuthService());
    const { analytics, crashReporter } = registerTelemetry();
    const store = createStore();

    await completeVendorRegistration(store.dispatch, 'reg_1', VENDOR_PHONE, VENDOR_OTP);
    await settlePublish();

    expect(analytics.track.mock.calls.map(call => call[0])).toEqual(['vendor_signup']);
    const properties = analytics.track.mock.calls[0][1];
    expect(Object.keys(properties).sort()).toEqual(['role']);
    expect(properties).toEqual({ role: 'vendor' });
    expect(analytics.identify).toHaveBeenCalledWith({ id: 'usr_vendor_1', role: 'vendor' });
    expect(analytics.identify.mock.invocationCallOrder[0]).toBeLessThan(
      analytics.track.mock.invocationCallOrder[0],
    );

    expectNothingPersonal(analytics.track, analytics.identify, crashReporter.setUser);
  });

  it('sends nothing when the registration code is refused', async () => {
    setSessionStorage(createMemoryStorage());
    registerService('auth', createStubAuthService({ verifyVendorOtp: wrongCode() }));
    const { analytics } = registerTelemetry();
    const store = createStore();

    await expect(
      completeVendorRegistration(store.dispatch, 'reg_1', VENDOR_PHONE, '111111'),
    ).rejects.toBeInstanceOf(AppError);

    expect(analytics.track).not.toHaveBeenCalled();
    expect(analytics.identify).not.toHaveBeenCalled();
  });
});

describe('restoring and ending a session', () => {
  it('identifies a restored user without sending an event', async () => {
    setSessionStorage(createMemoryStorage(VENDOR_SESSION));
    const { analytics, crashReporter } = registerTelemetry();
    const store = createStore();

    await restoreSession(store.dispatch);

    expect(analytics.identify).toHaveBeenCalledTimes(1);
    expect(analytics.identify).toHaveBeenCalledWith({ id: 'usr_vendor_1', role: 'vendor' });
    expect(crashReporter.setUser).toHaveBeenCalledWith({ id: 'usr_vendor_1', role: 'vendor' });
    expect(analytics.track).not.toHaveBeenCalled();
    expectNothingPersonal(analytics.identify, crashReporter.setUser);
  });

  it('identifies nobody when there is no session to restore', async () => {
    setSessionStorage(createMemoryStorage(null));
    const { analytics, crashReporter } = registerTelemetry();
    const store = createStore();

    await restoreSession(store.dispatch);

    expect(analytics.identify).not.toHaveBeenCalled();
    expect(crashReporter.setUser).not.toHaveBeenCalled();
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it('clears both services on sign out, and sends nothing', async () => {
    setSessionStorage(createMemoryStorage(CUSTOMER_SESSION));
    registerService('auth', createStubAuthService());
    const { analytics, crashReporter } = registerTelemetry();
    const store = createStore();
    await restoreSession(store.dispatch);

    await signOut(store.dispatch);

    expect(analytics.identify).toHaveBeenLastCalledWith(null);
    expect(crashReporter.setUser).toHaveBeenLastCalledWith(null);
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it('clears both services even when the server sign out fails', async () => {
    setSessionStorage(createMemoryStorage(CUSTOMER_SESSION));
    registerService(
      'auth',
      createStubAuthService({
        signOut: jest.fn(async () => {
          throw new AppError({ kind: 'network' });
        }),
      }),
    );
    const { analytics, crashReporter } = registerTelemetry();
    const store = createStore();
    await restoreSession(store.dispatch);

    await signOut(store.dispatch);

    expect(analytics.identify).toHaveBeenLastCalledWith(null);
    expect(crashReporter.setUser).toHaveBeenLastCalledWith(null);
  });
});
