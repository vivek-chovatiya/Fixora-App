/**
 * The last step of vendor registration. Since 28/11/2026 (phase5-contract.md
 * section 1.2) verifying the registration code creates the vendor and signs them
 * in — there is no permanent auth code to show, copy, confirm or regenerate.
 *
 * What this file guards against is the old flow creeping back, and the new one
 * signing in the wrong way: the session must come from `verifyVendorOtp` keyed
 * by the registration id, and from nothing else. Every other AuthService method
 * is a stub that throws, so a call to one fails the test that made it. The store
 * and session storage are real, so "signed in" is a fact about the system rather
 * than an assumption about the screen. The final block runs against the real
 * MockAuthService, so the service and the screen agree on the whole flow.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage, type PersistedSession } from '@/core/storage/SessionStorage';
import { AUTH_COPY, formatCopy } from '@/features/auth/constants/authCopy';
import { authReducer } from '@/features/auth/state/authSlice';
import { setRememberedVendorStorage } from '@/features/auth/state/rememberedVendorStorage';
import { VendorOtpScreen } from '@/features/auth/screens/VendorOtpScreen';
import type { SessionPayload } from '@/features/auth/types';
import { MockAuthService } from '@/shared/services/mock/MockAuthService';
import { MOCK_OTP_CODE } from '@/shared/services/mock/mockAuthData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { AuthService, OtpChallenge } from '@/shared/services/types/AuthService';
import { Toast, ToastProvider } from '@/shared/components';
import { duration, ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const REGISTRATION_ID = 'reg_test_1';
const VENDOR_PHONE = '9123456780';
const TYPED_OTP = '246810';

const VENDOR_SESSION: SessionPayload = {
  token: 'token_vendor',
  user: {
    id: 'usr_vendor_1',
    firstName: 'Neha',
    lastName: 'Sharma',
    phone: VENDOR_PHONE,
    role: 'vendor',
  },
};

/** No cooldown by default, so resend is reachable without waiting. */
const CHALLENGE: OtpChallenge = {
  maskedDestination: '••••••6780',
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  resendAfterSeconds: 0,
  deliveryChannel: 'NONE',
};

/** What the retired auth-code steps said. None of it may appear at any point. */
const RETIRED_WORDS = [
  'authentication code',
  'Authentication code',
  'Regenerate',
  'I have saved it',
  'Copy code',
  'Phone verified',
  'Show my code again',
];

function stubAuthService(overrides: Partial<AuthService> = {}): AuthService {
  // Mocks rather than plain functions, so a test can assert one was never
  // reached as well as fail loudly if it is.
  const unexpected = (name: string) =>
    jest.fn(() => {
      throw new Error(`${name} must not be called from vendor registration`);
    });

  return {
    verifyVendorOtp: jest.fn(async () => VENDOR_SESSION),
    requestVendorOtp: jest.fn(async () => CHALLENGE),
    registerVendor: unexpected('registerVendor'),
    requestCustomerOtp: unexpected('requestCustomerOtp'),
    verifyCustomerOtp: unexpected('verifyCustomerOtp'),
    requestVendorSignInOtp: unexpected('requestVendorSignInOtp'),
    verifyVendorSignInOtp: unexpected('verifyVendorSignInOtp'),
    signOut: unexpected('signOut'),
    ...overrides,
  };
}

function memoryStorage() {
  let value: PersistedSession | null = null;
  return {
    read: jest.fn(async () => value),
    write: jest.fn(async (session: PersistedSession) => {
      value = session;
    }),
    clear: jest.fn(async () => {
      value = null;
    }),
    peek: () => value,
  };
}

let mounted: ReactTestRenderer.ReactTestRenderer | null = null;

async function render(
  service: AuthService,
  options: { challenge?: OtpChallenge; registrationId?: string } = {},
) {
  registerService('auth', service);

  const storage = memoryStorage();
  setSessionStorage(storage);

  // Signing in remembers the vendor's phone on the device; kept in memory here.
  const remember = jest.fn<Promise<boolean>, [string]>(async () => true);
  setRememberedVendorStorage({
    read: jest.fn(async () => null),
    remember,
    forget: jest.fn(async () => undefined),
  });

  const store = configureStore({ reducer: { auth: authReducer } });
  const goBack = jest.fn();
  const navigate = jest.fn();
  const setOptions = jest.fn();
  const listeners = new Map<string, (event: { preventDefault: () => void }) => void>();
  const addListener = jest.fn((event: string, listener: never) => {
    listeners.set(event, listener);
    return () => listeners.delete(event);
  });
  const navigation = { goBack, navigate, setOptions, addListener } as never;
  const route = {
    key: 'VendorOtp',
    name: 'VendorOtp' as const,
    params: {
      registrationId: options.registrationId ?? REGISTRATION_ID,
      // The digits registration sent, which is what the sign in remembers.
      phone: VENDOR_PHONE,
      challenge: options.challenge ?? CHALLENGE,
    },
  } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <VendorOtpScreen navigation={navigation} route={route} />
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  mounted = renderer;

  const type = async (testID: string, value: string) => {
    await act(async () => {
      renderer.root.findByProps({ testID }).props.onChangeText(value);
    });
  };

  const press = async (accessibilityLabel: string) => {
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel }).props.onPress();
    });
  };

  const text = () => textOf(renderer.toJSON());

  /** The host text input, not the wrappers that forward the same testID to it. */
  const codeField = () => {
    const [field] = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.testID === 'vendor-otp-code' &&
        typeof node.props.onChangeText === 'function',
    );
    return field.props;
  };

  const button = (accessibilityLabel: string) =>
    renderer.root.findByProps({ accessibilityLabel }).props;

  /** Lets the scheduled session publish fire — it waits for the verified hold. */
  const settlePublish = async () => {
    await act(async () => {
      jest.advanceTimersByTime(duration.verifiedHold + 50);
    });
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
  };

  /**
   * Whether a message is currently on screen.
   *
   * Asked of the toast's own state rather than of the rendered text: the exit
   * animation outlives the dismissal, so the words are still in the tree for a
   * moment after the toast has been withdrawn.
   */
  const isToastShowing = () =>
    renderer.root.findAllByType(Toast).some(node => node.props.isVisible);

  /** The keyboard's done key, which is the only way to submit a partial code. */
  const submitEditing = async () => {
    const { onSubmitEditing } = codeField();
    await act(async () => {
      onSubmitEditing();
    });
  };

  return {
    renderer,
    store,
    storage,
    remember,
    goBack,
    navigate,
    setOptions,
    listeners,
    type,
    press,
    submitEditing,
    settlePublish,
    isToastShowing,
    text,
    codeField,
    button,
  };
}

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join(' ');
  }
  return textOf((node as ReactTestRendererJSON).children);
}

function expectNoRetiredWords(text: string) {
  for (const words of RETIRED_WORDS) {
    expect(text).not.toContain(words);
  }
}

beforeEach(() => {
  // The session publish is held by a timer, so the tests drive the clock
  // rather than waiting on it.
  jest.useFakeTimers();
});

afterEach(() => {
  // Unmounted, so the countdown and the toast's dwell do not outlive the test.
  act(() => {
    mounted?.unmount();
  });
  mounted = null;
  jest.useRealTimers();
  resetServices();
  jest.restoreAllMocks();
});

describe('VendorOtpScreen — what the vendor sees', () => {
  it('leads with the mark, under its own vendor heading', async () => {
    const { renderer, text } = await render(stubAuthService());

    expect(renderer.root.findAllByProps({ testID: 'vendor-otp-bar-mark' }).length)
      .toBeGreaterThan(0);
    expect(text()).toContain(AUTH_COPY.vendorOtp.title);
    expect(text()).not.toContain(AUTH_COPY.customerOtp.title);
  });

  it('labels the field and every action for assistive technology', async () => {
    const { codeField, button, renderer } = await render(stubAuthService());

    expect(codeField().accessibilityLabel).toBe(AUTH_COPY.vendorOtp.codeLabel);
    // Verifying signs the vendor in now, and the hint says so.
    expect(codeField().accessibilityHint).toBe(AUTH_COPY.vendorOtp.codeHint);
    expect(AUTH_COPY.vendorOtp.codeHint).toContain('Signs you in');
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Verify' })).toHaveLength(0);

    expect(button(AUTH_COPY.vendorOtp.resend).accessibilityRole).toBe('button');
    expect(button(AUTH_COPY.vendorOtp.changeAction).accessibilityRole).toBe('button');
  });

  it('names the destination in its masked form, and never the raw number', async () => {
    const { text, codeField } = await render(stubAuthService());

    expect(text()).toContain(CHALLENGE.maskedDestination);
    expect(text()).not.toContain(VENDOR_PHONE);
    expect(codeField().value).toBe('');
  });
});

describe('VendorOtpScreen — where the code went (deliveryChannel)', () => {
  it('says WhatsApp when the backend says it sent the code on WhatsApp', async () => {
    const { text } = await render(stubAuthService(), {
      challenge: { ...CHALLENGE, deliveryChannel: 'WHATSAPP' },
    });

    expect(text()).toContain(
      formatCopy(AUTH_COPY.vendorOtp.sentToWhatsApp, {
        destination: CHALLENGE.maskedDestination,
      }),
    );
  });

  it('keeps today’s wording, and names no channel, for NONE', async () => {
    const { text } = await render(stubAuthService());

    expect(text()).toContain(
      formatCopy(AUTH_COPY.vendorOtp.sentTo, { destination: CHALLENGE.maskedDestination }),
    );
    expect(text()).not.toContain('WhatsApp');
  });

  it('rewords the line when a resend comes back on WhatsApp', async () => {
    const service = stubAuthService({
      requestVendorOtp: jest.fn(async () => ({ ...CHALLENGE, deliveryChannel: 'WHATSAPP' as const })),
    });
    const { text, press } = await render(service);
    expect(text()).not.toContain('WhatsApp');

    await press(AUTH_COPY.vendorOtp.resend);

    expect(text()).toContain(
      formatCopy(AUTH_COPY.vendorOtp.sentToWhatsApp, {
        destination: CHALLENGE.maskedDestination,
      }),
    );
  });
});

describe('VendorOtpScreen — the code step', () => {
  it('does not reach the service until the code is complete', async () => {
    const service = stubAuthService();
    const { type } = await render(service);

    await type('vendor-otp-code', '123');

    expect(service.verifyVendorOtp).not.toHaveBeenCalled();
  });

  it('rejects an incomplete code locally when the keyboard submits one', async () => {
    const service = stubAuthService();
    const { type, submitEditing, text } = await render(service);

    await type('vendor-otp-code', '123');
    await submitEditing();

    expect(text()).toContain('digits');
    expect(service.verifyVendorOtp).not.toHaveBeenCalled();
  });

  it('verifies against the registration id and the code, and nothing else', async () => {
    const service = stubAuthService();
    const { type, settlePublish } = await render(service);

    await type('vendor-otp-code', TYPED_OTP);
    await settlePublish();

    // Exactly these two arguments: the phone is remembered, never sent.
    expect((service.verifyVendorOtp as jest.Mock).mock.calls).toEqual([
      [REGISTRATION_ID, TYPED_OTP],
    ]);
  });

  it('re-sends against the same onboarding rather than registering again', async () => {
    const service = stubAuthService();
    const { press } = await render(service);

    await press(AUTH_COPY.vendorOtp.resend);

    expect((service.requestVendorOtp as jest.Mock).mock.calls).toEqual([[REGISTRATION_ID]]);
    expect(service.registerVendor).not.toHaveBeenCalled();
    expect(service.requestVendorSignInOtp).not.toHaveBeenCalled();
  });

  it('drops the previous failure once a replacement code has been sent', async () => {
    const service = stubAuthService({
      verifyVendorOtp: jest.fn(async () => {
        throw new AppError({ kind: 'validation', code: 'OTP_INVALID', message: 'code mismatch' });
      }),
    });
    const { type, press, text, codeField, isToastShowing } = await render(service);

    await type('vendor-otp-code', TYPED_OTP);
    expect(text()).toContain(AppError.messageForCode('OTP_INVALID'));
    expect(isToastShowing()).toBe(true);

    await press(AUTH_COPY.vendorOtp.resend);

    // The message described an attempt against a code that no longer exists,
    // so it is withdrawn rather than left to sit out its dwell.
    expect(isToastShowing()).toBe(false);
    // The typed code is left alone; only the stale message goes.
    expect(codeField().value).toBe(TYPED_OTP);
  });

  it('honours the cooldown the challenge specified', async () => {
    const service = stubAuthService();
    const { renderer, text } = await render(service, {
      challenge: { ...CHALLENGE, resendAfterSeconds: 30 },
    });

    // Whitespace-normalised: the countdown is two nested Text nodes.
    expect(text().replace(/\s+/g, ' ')).toContain('Resend code in 30s');
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: AUTH_COPY.vendorOtp.resend }),
    ).toHaveLength(0);
    expect(service.requestVendorOtp).not.toHaveBeenCalled();
  });

  it.each([
    ['a wrong code', 'OTP_INVALID', 'That code is not correct. Please check and try again.'],
    ['an expired code', 'OTP_EXPIRED', 'That code has expired. Request a new one.'],
  ])('says so, in the app’s words, for %s', async (_case, code, sentence) => {
    const service = stubAuthService({
      verifyVendorOtp: jest.fn(async () => {
        throw new AppError({
          kind: 'validation',
          code,
          message: 'expected 123456 but received 246810',
        });
      }),
    });
    const { type, settlePublish, text, store } = await render(service);

    await type('vendor-otp-code', TYPED_OTP);
    await settlePublish();

    expect(text()).toContain(sentence);
    expect(text()).not.toContain('expected 123456');
    expect(store.getState().auth.status).not.toBe('authenticated');
  });
});

describe('VendorOtpScreen — verifying signs the vendor in', () => {
  it('publishes the session through auth state, without navigating', async () => {
    const service = stubAuthService();
    const { type, store, storage, navigate, goBack, settlePublish } = await render(service);

    await type('vendor-otp-code', TYPED_OTP);

    // Durable at once, published after the vendor has seen it accepted.
    expect(storage.peek()).toEqual(VENDOR_SESSION);
    expect(store.getState().auth.status).not.toBe('authenticated');

    await settlePublish();

    expect(store.getState().auth.status).toBe('authenticated');
    expect(store.getState().auth.user?.role).toBe('vendor');

    // RootNavigator reacts to auth state. The screen must not route itself.
    expect(navigate).not.toHaveBeenCalled();
    expect(goBack).not.toHaveBeenCalled();
  });

  it('remembers the number registration sent, not the account’s formatting of it', async () => {
    // The account's number has no format contract; this one, remembered,
    // would make the next sign in send twelve digits.
    const service = stubAuthService({
      verifyVendorOtp: jest.fn(async () => ({
        ...VENDOR_SESSION,
        user: { ...VENDOR_SESSION.user, phone: `+91${VENDOR_PHONE}` },
      })),
    });
    const { type, remember, settlePublish } = await render(service);

    await type('vendor-otp-code', TYPED_OTP);
    await settlePublish();

    expect(remember.mock.calls).toEqual([[VENDOR_PHONE]]);
  });

  it('remembers nothing and signs nobody in when the code is refused', async () => {
    const service = stubAuthService({
      verifyVendorOtp: jest.fn(async () => {
        throw new AppError({ kind: 'validation', code: 'OTP_INVALID' });
      }),
    });
    const { type, remember, storage, settlePublish } = await render(service);

    await type('vendor-otp-code', TYPED_OTP);
    await settlePublish();

    expect(remember).not.toHaveBeenCalled();
    expect(storage.peek()).toBeNull();
  });
});

describe('VendorOtpScreen — no auth code, at any point', () => {
  it('shows none of the retired auth-code UI before, during or after verification', async () => {
    const { type, text, settlePublish } = await render(stubAuthService());

    expectNoRetiredWords(text());

    await type('vendor-otp-code', TYPED_OTP);
    expectNoRetiredWords(text());

    await settlePublish();
    expectNoRetiredWords(text());
  });

  it('has no auth-code nodes in its tree', async () => {
    const { renderer, type, settlePublish } = await render(stubAuthService());

    await type('vendor-otp-code', TYPED_OTP);
    await settlePublish();

    const authCodeNodes = renderer.root.findAll(
      node => typeof node.props.testID === 'string' && node.props.testID.includes('auth-code'),
    );
    expect(authCodeNodes).toHaveLength(0);
  });
});

describe('VendorOtpScreen — going back', () => {
  it('goes back to the registration form before the code is verified', async () => {
    const { press, goBack } = await render(stubAuthService());

    await press(AUTH_COPY.vendorOtp.changeAction);

    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('does not block leaving: no vendor exists until the code is accepted', async () => {
    const { listeners, setOptions, type } = await render(stubAuthService({
      // Never answers, so the screen stays mid-verification.
      verifyVendorOtp: jest.fn(() => new Promise<SessionPayload>(() => {})),
    }));

    const preventDefault = jest.fn();
    listeners.get('beforeRemove')?.({ preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();

    await type('vendor-otp-code', TYPED_OTP);
    listeners.get('beforeRemove')?.({ preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();

    // Nor is the back gesture switched off.
    expect(setOptions).not.toHaveBeenCalledWith(expect.objectContaining({ gestureEnabled: false }));
  });
});

/**
 * The whole flow against the real mock, so the service and the screen agree:
 * register, verify, signed in — with nothing in between.
 */
describe('VendorOtpScreen — against the real mock service', () => {
  it('signs a freshly registered vendor in with the registration code', async () => {
    const service = new MockAuthService({ latency: NO_LATENCY });
    const registration = await service.registerVendor({
      businessName: 'Sharma Electricals',
      ownerFirstName: 'Neha',
      ownerLastName: 'Sharma',
      phone: VENDOR_PHONE,
      serviceCategoryIds: ['cat_electrician'],
    });

    const { type, store, text, remember, settlePublish } = await render(service, {
      registrationId: registration.registrationId,
      challenge: registration.challenge,
    });

    await type('vendor-otp-code', MOCK_OTP_CODE);
    await settlePublish();

    expectNoRetiredWords(text());
    expect(store.getState().auth.status).toBe('authenticated');
    expect(store.getState().auth.user?.role).toBe('vendor');
    expect(remember.mock.calls).toEqual([[VENDOR_PHONE]]);
  });

  it('refuses a wrong code without signing anybody in', async () => {
    const service = new MockAuthService({ latency: NO_LATENCY });
    const registration = await service.registerVendor({
      businessName: 'Sharma Electricals',
      ownerFirstName: 'Neha',
      ownerLastName: 'Sharma',
      phone: VENDOR_PHONE,
      serviceCategoryIds: ['cat_electrician'],
    });

    const { type, store, text, settlePublish } = await render(service, {
      registrationId: registration.registrationId,
      challenge: registration.challenge,
    });

    await type('vendor-otp-code', '000000');
    await settlePublish();

    expect(text()).toContain('That code is not correct');
    expect(store.getState().auth.status).not.toBe('authenticated');
  });
});
