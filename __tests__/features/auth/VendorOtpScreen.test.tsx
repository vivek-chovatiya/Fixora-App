/**
 * This screen holds the sharpest boundary in the application. Verifying a
 * vendor's phone activates their business and issues a permanent credential, but
 * it does not sign them in — only confirming that credential does.
 *
 * The security blocks below are the point of this file. The store and session
 * storage are real, so "no session was created" is a fact about the system
 * rather than an assumption about the screen. The final block runs against the
 * real MockAuthService, because revocation is a claim about the service and the
 * screen together: a regenerated code must leave the previous one dead.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setClipboard } from '@/core/clipboard/Clipboard';
import { setSessionStorage, type PersistedSession } from '@/core/storage/SessionStorage';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { authReducer } from '@/features/auth/state/authSlice';
import { VendorOtpScreen } from '@/features/auth/screens/VendorOtpScreen';
import type { SessionPayload } from '@/features/auth/types';
import { MockAuthService } from '@/shared/services/mock/MockAuthService';
import { MOCK_OTP_CODE } from '@/shared/services/mock/mockAuthData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type {
  AuthService,
  OtpChallenge,
  VendorAuthCode,
} from '@/shared/services/types/AuthService';
import { Toast, ToastProvider } from '@/shared/components';
import { duration, ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const REGISTRATION_ID = 'reg_test_1';
const VENDOR_PHONE = '9123456780';
const TYPED_OTP = '246810';

const ISSUED_CODE: VendorAuthCode = { code: 'FX-ABCD-2345', issuedAt: new Date().toISOString() };
const REPLACEMENT_CODE: VendorAuthCode = {
  code: 'FX-WXYZ-6789',
  issuedAt: new Date().toISOString(),
};

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
};

function stubAuthService(overrides: Partial<AuthService> = {}): AuthService {
  // Mocks rather than plain functions, so a test can assert one was never
  // reached as well as fail loudly if it is.
  const unexpected = (name: string) =>
    jest.fn(() => {
      throw new Error(`${name} must not be called from vendor onboarding`);
    });

  return {
    verifyVendorOtp: jest.fn(async () => ISSUED_CODE),
    requestVendorOtp: jest.fn(async () => CHALLENGE),
    verifyVendorAuthCode: jest.fn(async () => VENDOR_SESSION),
    regenerateVendorAuthCode: jest.fn(async () => REPLACEMENT_CODE),
    registerVendor: unexpected('registerVendor'),
    requestCustomerOtp: unexpected('requestCustomerOtp'),
    verifyCustomerOtp: unexpected('verifyCustomerOtp'),
    signInVendor: unexpected('signInVendor'),
    signOut: unexpected('signOut'),
    ...overrides,
  } as AuthService;
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

async function render(
  service: AuthService,
  options: { challenge?: OtpChallenge; registrationId?: string } = {},
) {
  registerService('auth', service);

  const storage = memoryStorage();
  setSessionStorage(storage);

  const copy = jest.fn(async () => undefined);
  setClipboard({ copy });

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

  /** The code as the vendor reads it off the screen. */
  const displayedCode = (): string =>
    textOf(renderer.root.findByProps({ testID: 'vendor-auth-code-value' }).props.children);

  /**
   * Verifies the phone, landing on the auth code display.
   *
   * The step change waits for the verified state to have been on screen, so
   * arriving takes a timer as well as a finished code. Every test that needs the
   * code step behind it goes through here, which is why the wait lives in one
   * place.
   */
  const completeOtp = async () => {
    await type('vendor-otp-code', TYPED_OTP);
    await settleVerified();
  };

  /**
   * Lets the scheduled session publish fire.
   *
   * Confirmation resolves before it dispatches, so the vendor sees their code
   * accepted while this screen is still mounted. Auth state changes only once
   * that hold is over.
   */
  const settlePublish = async () => {
    await act(async () => {
      jest.advanceTimersByTime(duration.verifiedHold + 50);
    });
  };

  /** Runs out the verified hold, and anything the service scheduled behind it. */
  const settleVerified = async () => {
    await act(async () => {
      jest.advanceTimersByTime(1_000);
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
    copy,
    goBack,
    navigate,
    listeners,
    type,
    press,
    submitEditing,
    settlePublish,
    isToastShowing,
    text,
    codeField,
    button,
    displayedCode,
    completeOtp,
    settleVerified,
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

beforeEach(() => {
  // The verified state is held by a timer, so the tests drive the clock rather
  // than waiting on it.
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  resetServices();
  jest.restoreAllMocks();
});

/** Captures everything the logger emitted during a test. */
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

describe('VendorOtpScreen — what the vendor sees', () => {
  it('leads with the mark, under its own vendor heading', async () => {
    const { renderer, text } = await render(stubAuthService());

    expect(renderer.root.findAllByProps({ testID: 'vendor-otp-bar-mark' }).length)
      .toBeGreaterThan(0);
    expect(text()).toContain(AUTH_COPY.vendorOtp.title);

    // Shares the customer screen's shape, not its words: this step verifies a
    // business number and issues a credential rather than signing anyone in.
    expect(text()).not.toContain(AUTH_COPY.customerOtp.title);
  });

  it('labels the field and every action for assistive technology', async () => {
    const { codeField, button, renderer } = await render(stubAuthService());

    expect(codeField().accessibilityLabel).toBe(AUTH_COPY.vendorOtp.codeLabel);

    // The hint says what the removed button said by existing, and promises
    // activation rather than a sign in.
    expect(codeField().accessibilityHint).toBe(AUTH_COPY.vendorOtp.codeHint);
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Verify' })).toHaveLength(0);

    expect(button(AUTH_COPY.vendorOtp.resend).accessibilityRole).toBe('button');
    expect(button(AUTH_COPY.vendorOtp.changeAction).accessibilityRole).toBe('button');
  });

  it('leaves the steps after it to the auth-code UI', async () => {
    const { completeOtp, text } = await render(stubAuthService());

    await completeOtp();

    // The header belongs to the code step. Carrying it into the auth-code steps
    // would be restyling them, which is a separate piece of work.
    expect(text()).not.toContain(AUTH_COPY.vendorOtp.title);
  });
});

describe('VendorOtpScreen — the one-time code step', () => {
  it('names the destination in its masked form, and never the raw number', async () => {
    const { text, renderer } = await render(stubAuthService());

    // The vendor typed this number on the previous screen and is now being
    // asked to prove it. Naming it — masked, as the backend supplies it — is
    // what lets a typo be caught here rather than after the code never arrives.
    expect(text()).toContain(CHALLENGE.maskedDestination);
    expect(text()).not.toContain(VENDOR_PHONE);
    expect(renderer.root.findByProps({ testID: 'vendor-otp-code' }).props.value).toBe('');
  });

  it('shows no auth code before the phone is verified', async () => {
    const { text } = await render(stubAuthService());

    expect(text()).not.toContain(ISSUED_CODE.code);
    expect(text()).not.toContain('Phone verified');
  });

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

  it('verifies against the registration id, not the phone number', async () => {
    const service = stubAuthService();
    const { completeOtp } = await render(service);

    await completeOtp();

    expect(service.verifyVendorOtp).toHaveBeenCalledWith(REGISTRATION_ID, TYPED_OTP);
  });

  it('re-sends against the same onboarding rather than registering again', async () => {
    const service = stubAuthService();
    const { press } = await render(service);

    await press('Resend code');

    expect(service.requestVendorOtp).toHaveBeenCalledWith(REGISTRATION_ID);
    expect(service.registerVendor).not.toHaveBeenCalled();
  });

  it('drops the previous failure once a replacement code has been sent', async () => {
    const failure = new AppError({
      kind: 'validation',
      message: 'code mismatch',
      userMessage: 'That code is not correct. Please check and try again.',
    });
    const service = stubAuthService({
      verifyVendorOtp: jest.fn(async () => {
        throw failure;
      }),
    });
    const { completeOtp, press, text, codeField, isToastShowing } = await render(service);

    await completeOtp();
    expect(text()).toContain(failure.userMessage);
    expect(isToastShowing()).toBe(true);

    await press('Resend code');

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

    // The remaining time is shown as readable status, and there is no resend
    // control to press until it reaches zero.
    /*
      Whitespace-normalised, because the countdown is now two nested Text nodes
      — the sentence in the quiet colour, the count in the accent — and the
      helper that flattens the tree puts a separator between siblings that the
      renderer does not. What is asserted is still the exact sentence.
    */
    expect(text().replace(/\s+/g, ' ')).toContain('Resend code in 30s');
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Resend code' })).toHaveLength(0);

    expect(service.requestVendorOtp).not.toHaveBeenCalled();
  });

  it('shows a safe message for a wrong code', async () => {
    const failure = new AppError({
      kind: 'validation',
      message: 'expected 123456 but received 246810',
      userMessage: 'That code is not correct. Please check and try again.',
    });
    const service = stubAuthService({
      verifyVendorOtp: jest.fn(async () => {
        throw failure;
      }),
    });
    const { completeOtp, text } = await render(service);

    await completeOtp();

    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain('expected 123456');
  });
});

describe('VendorOtpScreen — the verified moment', () => {
  it('holds on the code step long enough for the verified state to be seen', async () => {
    const service = stubAuthService();
    const { type, text, settleVerified } = await render(service);

    await type('vendor-otp-code', TYPED_OTP);

    // Verification has already happened — the service was called and answered.
    expect(service.verifyVendorOtp).toHaveBeenCalledWith(REGISTRATION_ID, TYPED_OTP);
    // ...but the screen is still on the code step, showing the verified state
    // rather than the auth code. Without the hold this assertion fails, because
    // the step changed on the same frame the animation would have started.
    expect(text()).not.toContain('Phone verified');

    await settleVerified();

    expect(text()).toContain('Phone verified');
  });

  it('waits to move on, without waiting to take the credential', async () => {
    const { type, listeners } = await render(stubAuthService());

    await type('vendor-otp-code', TYPED_OTP);

    // The business is active from the moment the code was issued, so the door
    // back to registration is shut during the hold and not after it.
    const preventDefault = jest.fn();
    listeners.get('beforeRemove')?.({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
  });

  it('does not hold, or move on, when the code was rejected', async () => {
    const service = stubAuthService({
      verifyVendorOtp: jest.fn(async () => {
        throw new AppError({ kind: 'validation', message: 'wrong', userMessage: 'Not correct.' });
      }),
    });
    const { type, text, settleVerified } = await render(service);

    await type('vendor-otp-code', TYPED_OTP);
    await settleVerified();

    // A failure must not reach the display step by simply waiting.
    expect(text()).not.toContain('Phone verified');
    expect(text()).toContain('Not correct.');
  });
});

describe('VendorOtpScreen — the auth code is shown', () => {
  it('moves to the display step and shows the issued code', async () => {
    const { completeOtp, text, displayedCode } = await render(stubAuthService());

    await completeOtp();

    expect(text()).toContain('Phone verified');
    expect(displayedCode()).toBe(ISSUED_CODE.code);
  });

  it('describes what happened without claiming approval or a sign in', async () => {
    const { completeOtp, text } = await render(stubAuthService());

    await completeOtp();

    const rendered = text().toLowerCase();
    expect(rendered).not.toContain('approved');
    expect(rendered).not.toContain('pending');
    expect(rendered).not.toContain('review');
  });

  it('copies the code, and nothing more', async () => {
    const service = stubAuthService();
    const { completeOtp, press, copy, store, text } = await render(service);

    await completeOtp();
    await press('Copy code');

    expect(copy).toHaveBeenCalledWith(ISSUED_CODE.code);
    expect(text()).toContain('Copied');

    // Copying is not a claim that the vendor saved it, and not a sign in.
    expect(service.verifyVendorAuthCode).not.toHaveBeenCalled();
    expect(store.getState().auth.status).not.toBe('authenticated');
  });

  it('tells the vendor to write it down when the clipboard fails', async () => {
    const { completeOtp, press, text } = await render(stubAuthService());
    setClipboard({
      copy: jest.fn(async () => {
        throw new Error('clipboard unavailable');
      }),
    });

    await completeOtp();
    await press('Copy code');

    expect(text()).toContain('could not copy');
  });

  it('continues to confirmation only when the vendor says so', async () => {
    const { completeOtp, press, text } = await render(stubAuthService());

    await completeOtp();
    expect(text()).not.toContain('Confirm your code');

    await press('I have saved it');

    expect(text()).toContain('Confirm your code');
  });
});

describe('VendorOtpScreen — confirmation creates the session', () => {
  async function reachConfirmation(service: AuthService) {
    const harness = await render(service);
    await harness.completeOtp();
    await harness.press('I have saved it');
    return harness;
  }

  it('rejects an empty code locally', async () => {
    const service = stubAuthService();
    const { press, text } = await reachConfirmation(service);

    await press('Continue');

    expect(service.verifyVendorAuthCode).not.toHaveBeenCalled();
    expect(text()).toContain('Enter your authentication code.');
  });

  it('confirms through verifyVendorAuthCode, not a sign in', async () => {
    const service = stubAuthService();
    const { type, press } = await reachConfirmation(service);

    await type('vendor-auth-code-input', ISSUED_CODE.code);
    await press('Continue');

    expect(service.verifyVendorAuthCode).toHaveBeenCalledWith(REGISTRATION_ID, ISSUED_CODE.code);
    expect(service.signInVendor).not.toHaveBeenCalled();
  });

  it('publishes the session through auth state, without navigating', async () => {
    const service = stubAuthService();
    const { type, press, store, storage, navigate, goBack, settlePublish } =
      await reachConfirmation(service);

    await type('vendor-auth-code-input', ISSUED_CODE.code);
    await press('Continue');

    // Durable at once, published after the vendor has seen it accepted. Killed
    // between the two, the app restarts signed in regardless.
    expect(storage.peek()).toEqual(VENDOR_SESSION);
    expect(store.getState().auth.status).not.toBe('authenticated');

    await settlePublish();

    expect(store.getState().auth.status).toBe('authenticated');
    expect(store.getState().auth.user?.role).toBe('vendor');

    // RootNavigator reacts to auth state. The screen must not route itself.
    expect(navigate).not.toHaveBeenCalled();
    expect(goBack).not.toHaveBeenCalled();
  });

  it('keeps the vendor on the step, with the code intact, when confirmation fails', async () => {
    const failure = new AppError({
      kind: 'validation',
      message: `expected ${ISSUED_CODE.code}`,
      userMessage: 'That code is not correct. Please check and try again.',
    });
    const service = stubAuthService({
      verifyVendorAuthCode: jest.fn(async () => {
        throw failure;
      }),
    });
    const { type, press, text, store, displayedCode } = await reachConfirmation(service);

    await type('vendor-auth-code-input', 'FX-WRON-GXXX');
    await press('Continue');

    expect(text()).toContain(failure.userMessage);
    // The expected value must never be shown back to the user.
    expect(text()).not.toContain(`expected ${ISSUED_CODE.code}`);
    expect(store.getState().auth.status).not.toBe('authenticated');

    // A wrong guess does not destroy the code the vendor was issued.
    await press('Show my code again');
    expect(displayedCode()).toBe(ISSUED_CODE.code);
  });
});

describe('VendorOtpScreen — regeneration', () => {
  async function reachConfirmation(service: AuthService) {
    const harness = await render(service);
    await harness.completeOtp();
    await harness.press('I have saved it');
    return harness;
  }

  it('returns to the display step showing the replacement', async () => {
    const service = stubAuthService();
    const { press, text, displayedCode } = await reachConfirmation(service);

    await press('Regenerate code');

    expect(service.regenerateVendorAuthCode).toHaveBeenCalledWith(REGISTRATION_ID);
    expect(text()).toContain('Phone verified');
    expect(displayedCode()).toBe(REPLACEMENT_CODE.code);
    // The replaced code is gone from the screen entirely.
    expect(text()).not.toContain(ISSUED_CODE.code);
  });

  it('does not authenticate or auto-confirm', async () => {
    const service = stubAuthService();
    const { press, store, storage, text } = await reachConfirmation(service);

    await press('Regenerate code');

    expect(service.verifyVendorAuthCode).not.toHaveBeenCalled();
    expect(store.getState().auth.status).not.toBe('authenticated');
    expect(storage.write).not.toHaveBeenCalled();
    // The vendor must save and enter the new code themselves.
    expect(text()).not.toContain('Confirm your code');
  });
});

/**
 * The rules that would be invisible in the UI if they were broken.
 */
describe('VendorOtpScreen — the credential does not escape', () => {
  it('never reaches Redux, storage or navigation', async () => {
    const { completeOtp, press, store, storage, navigate, goBack } = await render(
      stubAuthService(),
    );

    await completeOtp();
    await press('Copy code');
    await press('I have saved it');

    expect(JSON.stringify(store.getState())).not.toContain(ISSUED_CODE.code);
    expect(JSON.stringify(storage.peek())).not.toContain(ISSUED_CODE.code);
    expect(storage.write).not.toHaveBeenCalled();
    expect(JSON.stringify(navigate.mock.calls)).not.toContain(ISSUED_CODE.code);
    expect(JSON.stringify(goBack.mock.calls)).not.toContain(ISSUED_CODE.code);
  });

  it('survives a successful sign in without entering the session', async () => {
    const { completeOtp, press, type, store, storage, settlePublish } = await render(
      stubAuthService(),
    );

    await completeOtp();
    await press('I have saved it');
    await type('vendor-auth-code-input', ISSUED_CODE.code);
    await press('Continue');
    await settlePublish();

    expect(store.getState().auth.status).toBe('authenticated');
    expect(JSON.stringify(store.getState())).not.toContain(ISSUED_CODE.code);
    expect(JSON.stringify(storage.peek())).not.toContain(ISSUED_CODE.code);
  });

  it('is never logged, through issue, copy, failure, regeneration or success', async () => {
    const readLogs = captureLogs();
    const service = stubAuthService({
      verifyVendorAuthCode: jest
        .fn()
        .mockRejectedValueOnce(new AppError({ kind: 'validation', message: 'mismatch' }))
        .mockResolvedValueOnce(VENDOR_SESSION),
    });
    const { completeOtp, press, type } = await render(service);

    await completeOtp();
    await press('Copy code');
    await press('I have saved it');
    await type('vendor-auth-code-input', ISSUED_CODE.code);
    await press('Continue'); // fails
    await press('Regenerate code');
    await press('I have saved it');
    await type('vendor-auth-code-input', REPLACEMENT_CODE.code);
    await press('Continue'); // succeeds

    const logged = readLogs();
    expect(logged).not.toContain(ISSUED_CODE.code);
    expect(logged).not.toContain(REPLACEMENT_CODE.code);
    expect(logged).not.toContain(TYPED_OTP);
  });

  it('is held by the screen alone, not also by the hook that fetched it', async () => {
    const service = stubAuthService();
    const { completeOtp, renderer, displayedCode } = await render(service);

    await completeOtp();

    // The screen has it, because it is on the display step showing it...
    expect(displayedCode()).toBe(ISSUED_CODE.code);

    // ...and no mutation hook is holding a second copy in its own `data`.
    const retained = renderer.root.findAll(
      node => typeof node.props?.data === 'object' && node.props?.data !== null,
    );
    expect(JSON.stringify(retained.map(node => node.props.data))).not.toContain(ISSUED_CODE.code);
  });

  it('blocks leaving once the business has been activated', async () => {
    const { completeOtp, listeners } = await render(stubAuthService());

    await completeOtp();

    const preventDefault = jest.fn();
    listeners.get('beforeRemove')?.({ preventDefault });

    // Going back would return to registration and risk a second registration
    // for a vendor that is already active.
    expect(preventDefault).toHaveBeenCalled();
  });
});

/**
 * Revocation is a claim about the service and the screen together, so this runs
 * against the real mock rather than a stub that could be told to agree.
 */
describe('VendorOtpScreen — regeneration against the real mock service', () => {
  it('kills the previous code and accepts only the replacement', async () => {
    const service = new MockAuthService({ latency: NO_LATENCY });
    const registration = await service.registerVendor({
      businessName: 'Sharma Electricals',
      ownerFirstName: 'Neha',
      ownerLastName: 'Sharma',
      phone: VENDOR_PHONE,
      serviceCategoryIds: ['cat_electrician'],
    });

    const { type, press, displayedCode, text, store, settleVerified, settlePublish } =
      await render(service, {
      registrationId: registration.registrationId,
      challenge: registration.challenge,
    });

    await type('vendor-otp-code', MOCK_OTP_CODE);
    await settleVerified();

    const firstCode = displayedCode();
    expect(firstCode).toEqual(expect.any(String));
    expect(store.getState().auth.status).not.toBe('authenticated');

    await press('I have saved it');
    await press('Regenerate code');

    const replacement = displayedCode();
    expect(replacement).not.toBe(firstCode);

    await press('I have saved it');

    // The code the vendor saved first is now dead.
    await type('vendor-auth-code-input', firstCode);
    await press('Continue');
    expect(store.getState().auth.status).not.toBe('authenticated');
    expect(text()).toContain('not correct');

    // Only the replacement signs them in.
    await type('vendor-auth-code-input', replacement);
    await press('Continue');
    await settlePublish();
    expect(store.getState().auth.status).toBe('authenticated');
    expect(store.getState().auth.user?.role).toBe('vendor');
  });
});
