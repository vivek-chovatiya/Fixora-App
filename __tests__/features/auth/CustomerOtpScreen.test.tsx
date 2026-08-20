/**
 * The verification screen holds the only credential in the customer flow, so
 * these tests pin what it must and must not do with it: never reveal a code it
 * was not given, never log the one it was, and never sign anyone in by any route
 * other than the service saying so.
 *
 * The store is real. Whether verification produced an authenticated session is
 * the whole point of the screen, and a stubbed reducer would prove nothing.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage, type PersistedSession } from '@/core/storage/SessionStorage';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { authReducer } from '@/features/auth/state/authSlice';
import { CustomerOtpScreen } from '@/features/auth/screens/CustomerOtpScreen';
import type { SessionPayload } from '@/features/auth/types';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { AuthService, OtpChallenge } from '@/shared/services/types/AuthService';
import { Toast, ToastProvider } from '@/shared/components';
import { duration, ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const PHONE = '9876543210';
const TYPED_CODE = '246810';

/** No cooldown by default, so resend is reachable without waiting a real minute. */
const CHALLENGE: OtpChallenge = {
  maskedDestination: '••••••3210',
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  resendAfterSeconds: 0,
};

const SESSION: SessionPayload = {
  token: 'token_customer',
  user: {
    id: 'usr_1',
    firstName: 'Asha',
    lastName: 'Patel',
    phone: PHONE,
    role: 'customer',
  },
};

function stubAuthService(overrides: Partial<AuthService> = {}): AuthService {
  const unexpected = (name: string) => () => {
    throw new Error(`${name} must not be called from the verification screen`);
  };

  return {
    requestCustomerOtp: jest.fn(async () => CHALLENGE),
    verifyCustomerOtp: jest.fn(async () => SESSION),
    registerVendor: unexpected('registerVendor'),
    requestVendorOtp: unexpected('requestVendorOtp'),
    verifyVendorOtp: unexpected('verifyVendorOtp'),
    verifyVendorAuthCode: unexpected('verifyVendorAuthCode'),
    regenerateVendorAuthCode: unexpected('regenerateVendorAuthCode'),
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

async function render(service: AuthService, challenge: OtpChallenge = CHALLENGE) {
  registerService('auth', service);

  const storage = memoryStorage();
  setSessionStorage(storage);

  const store = configureStore({ reducer: { auth: authReducer } });
  const goBack = jest.fn();
  const navigate = jest.fn();
  const navigation = { goBack, navigate } as never;
  const route = {
    key: 'CustomerOtp',
    name: 'CustomerOtp' as const,
    params: { phone: PHONE, challenge },
  } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          {/* Failures leave as toasts now, so the layer that shows them is
              part of what these tests are exercising. */}
          <ToastProvider>
            <CustomerOtpScreen navigation={navigation} route={route} />
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });

  const press = async (accessibilityLabel: string) => {
    const button = renderer.root.findByProps({ accessibilityLabel });
    await act(async () => {
      button.props.onPress();
    });
  };

  const type = async (value: string) => {
    const field = renderer.root.findByProps({ testID: 'customer-otp-code' });
    await act(async () => {
      field.props.onChangeText(value);
    });
  };

  /** The host text input, not the wrappers that forward the same testID to it. */
  const codeField = () => {
    const [field] = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.testID === 'customer-otp-code' &&
        typeof node.props.onChangeText === 'function',
    );
    return field.props;
  };

  const button = (accessibilityLabel: string) =>
    renderer.root.findByProps({ accessibilityLabel }).props;

  const hasButton = (accessibilityLabel: string) =>
    renderer.root.findAllByProps({ accessibilityLabel }).length > 0;

  /** The keyboard's done key, which is the only way to submit a partial code. */
  const submitEditing = async () => {
    const { onSubmitEditing } = codeField();
    await act(async () => {
      onSubmitEditing();
    });
  };

  /**
   * Lets the scheduled session publish fire.
   *
   * Verification resolves before it dispatches, so this screen stays mounted
   * long enough to show that the code was accepted. Auth state only changes
   * once that hold is over — which is what the user waits through.
   */
  const settlePublish = async () => {
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, duration.verifiedHold + 50));
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

  return {
    renderer,
    store,
    storage,
    goBack,
    navigate,
    type,
    press,
    submitEditing,
    codeField,
    button,
    hasButton,
    settlePublish,
    isToastShowing,
    text: () => textOf(renderer.toJSON()),
  };
}

/** Flattens every string in the rendered tree so copy can be asserted on. */
function textOf(node: ReactTestRendererJSON | ReactTestRendererJSON[] | null): string {
  if (node === null) {
    return '';
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join(' ');
  }
  return (node.children ?? [])
    .map(child => (typeof child === 'string' ? child : textOf(child as ReactTestRendererJSON)))
    .join(' ');
}

afterEach(() => {
  resetServices();
  jest.restoreAllMocks();
});

describe('CustomerOtpScreen — what the user sees', () => {
  it('continues the sign-in flow, with its heading from central copy', async () => {
    const { text } = await render(stubAuthService());

    expect(text()).toContain(AUTH_COPY.brand.wordmark);
    expect(text()).toContain(AUTH_COPY.customerOtp.title);
  });

  it('labels the field and every action for assistive technology', async () => {
    const { codeField, button, hasButton } = await render(stubAuthService());

    expect(codeField().accessibilityLabel).toBe(AUTH_COPY.customerOtp.codeLabel);

    // There is no confirming action to discover, so the field has to say that
    // finishing the code is what sends it.
    expect(codeField().accessibilityHint).toBe(AUTH_COPY.customerOtp.codeHint);
    expect(hasButton('Verify')).toBe(false);

    // Resend and change-number are reachable as buttons in their own right.
    expect(button(AUTH_COPY.customerOtp.resend).accessibilityRole).toBe('button');
    expect(button(AUTH_COPY.customerOtp.changeAction).accessibilityRole).toBe('button');
  });

  it('shows neither the raw number nor the masked one it was given', async () => {
    const { text } = await render(stubAuthService());

    // The screen no longer restates where the code went. The raw number was
    // never displayable; the masked form went with the supporting line.
    expect(text()).not.toContain(PHONE);
    expect(text()).not.toContain(CHALLENGE.maskedDestination);
  });

  it('reveals no code of its own', async () => {
    const { text, renderer } = await render(stubAuthService());

    // Nothing is prefilled: the field starts empty, so the screen cannot be
    // showing a code it was never given.
    expect(renderer.root.findByProps({ testID: 'customer-otp-code' }).props.value).toBe('');
    expect(text()).not.toMatch(/\b\d{6}\b/);
  });
});

describe('CustomerOtpScreen — verification', () => {
  it('does not reach the service until the code is complete', async () => {
    const service = stubAuthService();
    const { type } = await render(service);

    await type('1');
    await type('12345');

    // Five digits is not a code. Nothing is sent, and nothing is complained
    // about — the user is still typing.
    expect(service.verifyCustomerOtp).not.toHaveBeenCalled();
  });

  it('rejects an incomplete code locally when the keyboard submits one', async () => {
    const service = stubAuthService();
    const { type, submitEditing, text } = await render(service);

    await type('123');
    await submitEditing();

    expect(service.verifyCustomerOtp).not.toHaveBeenCalled();
    expect(text()).toContain('digits');
  });

  it('verifies on the last digit, with no action to confirm it', async () => {
    const service = stubAuthService();
    const { type } = await render(service);

    await type(TYPED_CODE);

    expect(service.verifyCustomerOtp).toHaveBeenCalledWith(PHONE, TYPED_CODE);
  });

  it('signs the customer in through auth state, not by navigating', async () => {
    const service = stubAuthService();
    const { type, store, navigate, goBack, settlePublish } = await render(service);

    await type(TYPED_CODE);

    expect(service.verifyCustomerOtp).toHaveBeenCalledWith(PHONE, TYPED_CODE);

    // The verified state is on screen first; the tree swaps after it.
    expect(store.getState().auth.status).not.toBe('authenticated');
    await settlePublish();

    expect(store.getState().auth.status).toBe('authenticated');
    expect(store.getState().auth.user?.role).toBe('customer');
    // RootNavigator reacts to state; the screen must not route anywhere itself.
    expect(navigate).not.toHaveBeenCalled();
    expect(goBack).not.toHaveBeenCalled();
  });

  it('shows a safe message for a wrong code and stays unauthenticated', async () => {
    const failure = new AppError({
      kind: 'validation',
      message: 'expected 123456 but received 246810',
      userMessage: 'That code is not correct. Please check and try again.',
    });
    const service = stubAuthService({
      verifyCustomerOtp: jest.fn(async () => {
        throw failure;
      }),
    });
    const { type, text, store } = await render(service);

    await type(TYPED_CODE);

    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain('expected 123456');
    expect(store.getState().auth.status).not.toBe('authenticated');
  });

  it('says the code expired rather than claiming the session did', async () => {
    const service = stubAuthService({
      verifyCustomerOtp: jest.fn(async () => {
        throw new AppError({
          kind: 'unauthorized',
          message: 'Mock challenge expired',
          userMessage: 'That code has expired. Request a new one.',
        });
      }),
    });
    const { type, text } = await render(service);

    await type(TYPED_CODE);

    // The message says everything the heading used to, so the toast carries no
    // heading at all.
    expect(text()).toContain('That code has expired. Request a new one.');
    // There is no session at this point, so this default would be nonsense.
    expect(text()).not.toContain('Session expired');
  });

  it('locks the field while the check is in flight', async () => {
    // Resolved by the test rather than by the stub, so the pending state can be
    // observed instead of guessed at with a timer.
    let release!: (session: SessionPayload) => void;
    const service = stubAuthService({
      verifyCustomerOtp: jest.fn(
        () =>
          new Promise<SessionPayload>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { type, codeField } = await render(service);

    expect(codeField().editable).toBe(true);

    // `type` flushes the render caused by completing the code and starting the
    // call, but the call itself is still unresolved when it returns.
    await type(TYPED_CODE);
    expect(codeField().editable).toBe(false);

    await act(async () => {
      release(SESSION);
    });

    // Still locked, because the code was accepted and the screen is leaving.
    expect(codeField().editable).toBe(false);
  });
});

describe('CustomerOtpScreen — resend', () => {
  it('asks the same service for another code', async () => {
    const service = stubAuthService();
    const { press } = await render(service);

    await press('Resend code');

    expect(service.requestCustomerOtp).toHaveBeenCalledWith(PHONE);
  });

  it('takes the cooldown from the replacement rather than reusing the first', async () => {
    const replacement: OtpChallenge = { ...CHALLENGE, resendAfterSeconds: 45 };
    const service = stubAuthService({ requestCustomerOtp: jest.fn(async () => replacement) });
    const { press, text } = await render(service);

    await press('Resend code');

    expect(text()).toContain('Resend code in 45s');
  });

  it('drops the previous failure once a replacement code has been sent', async () => {
    const failure = new AppError({
      kind: 'validation',
      message: 'code mismatch',
      userMessage: 'That code is not correct. Please check and try again.',
    });
    const service = stubAuthService({
      verifyCustomerOtp: jest.fn(async () => {
        throw failure;
      }),
    });
    const { type, press, text, codeField, isToastShowing } = await render(service);

    await type(TYPED_CODE);
    expect(text()).toContain(failure.userMessage);
    expect(isToastShowing()).toBe(true);

    await press('Resend code');

    // The message described an attempt against a code that no longer exists,
    // so it is withdrawn rather than left to sit out its dwell.
    expect(isToastShowing()).toBe(false);
    // The typed code is left alone; only the stale message goes.
    expect(codeField().value).toBe(TYPED_CODE);
  });

  it('will not send a second request while the first is unanswered', async () => {
    let release!: (challenge: OtpChallenge) => void;
    const service = stubAuthService({
      requestCustomerOtp: jest.fn(
        () =>
          new Promise<OtpChallenge>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { press } = await render(service);

    await press('Resend code');
    // Still unanswered — a second tap must not reach the service.
    await press('Resend code');

    expect(service.requestCustomerOtp).toHaveBeenCalledTimes(1);

    await act(async () => {
      release(CHALLENGE);
    });
  });

  it('honours the cooldown the backend asked for rather than one of its own', async () => {
    const service = stubAuthService();
    const { renderer, text } = await render(service, { ...CHALLENGE, resendAfterSeconds: 30 });

    // The remaining time is readable status rather than a dimmed button label,
    // and there is nothing to press until it reaches zero.
    expect(text()).toContain('Resend code in 30s');
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Resend code' })).toHaveLength(0);

    expect(service.requestCustomerOtp).not.toHaveBeenCalled();
  });
});

describe('CustomerOtpScreen — one operation at a time', () => {
  it('sends one verification however many times the same code is completed', async () => {
    let release!: (session: SessionPayload) => void;
    const service = stubAuthService({
      verifyCustomerOtp: jest.fn(
        () =>
          new Promise<SessionPayload>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { type } = await render(service);

    await type(TYPED_CODE);
    await type(TYPED_CODE);
    await type(TYPED_CODE);

    // Re-completing the same code is not a new attempt. Without this guard the
    // absent button would be replaced by something that fires far more often.
    expect(service.verifyCustomerOtp).toHaveBeenCalledTimes(1);

    await act(async () => {
      release(SESSION);
    });
  });

  it('verifies again once a rejected code has been edited', async () => {
    const service = stubAuthService({
      verifyCustomerOtp: jest.fn(async () => {
        throw new AppError({ kind: 'validation', userMessage: 'That code is not correct.' });
      }),
    });
    const { type } = await render(service);

    await type(TYPED_CODE);
    expect(service.verifyCustomerOtp).toHaveBeenCalledTimes(1);

    // Editing is the only retry there is now, so completing the code again has
    // to count as a fresh attempt even when the digits are identical.
    await type(TYPED_CODE.slice(0, 5));
    await type(TYPED_CODE);

    expect(service.verifyCustomerOtp).toHaveBeenCalledTimes(2);
  });

  it('will not resend while a verification is unanswered', async () => {
    let release!: (session: SessionPayload) => void;
    const service = stubAuthService({
      verifyCustomerOtp: jest.fn(
        () =>
          new Promise<SessionPayload>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { type, press, button } = await render(service);

    await type(TYPED_CODE);

    expect(button('Resend code').accessibilityState.disabled).toBe(true);
    await press('Resend code');
    expect(service.requestCustomerOtp).not.toHaveBeenCalled();

    await act(async () => {
      release(SESSION);
    });
  });

  it('will not verify while a resend is unanswered', async () => {
    let release!: (challenge: OtpChallenge) => void;
    const service = stubAuthService({
      requestCustomerOtp: jest.fn(
        () =>
          new Promise<OtpChallenge>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { type, press, codeField } = await render(service);

    await press('Resend code');

    // The field is shut while the replacement is in flight, and completing a
    // code behind that must not slip a verification past it.
    expect(codeField().editable).toBe(false);
    await type(TYPED_CODE);
    expect(service.verifyCustomerOtp).not.toHaveBeenCalled();

    await act(async () => {
      release(CHALLENGE);
    });
  });

  it('stays usable after a resend fails', async () => {
    const service = stubAuthService({
      requestCustomerOtp: jest.fn(async () => {
        throw new AppError({ kind: 'network', message: 'socket hang up' });
      }),
    });
    const { type, press, text, store, codeField, settlePublish } = await render(service);

    await press('Resend code');

    // The toast carries the user-facing message. "No connection" was the
    // heading of the block that used to sit in the layout, and is now nowhere.
    expect(text()).toContain('No internet connection. Check your network and try again.');
    expect(text()).not.toContain('socket hang up');

    // Verifying still works once the failed resend has answered.
    await type(TYPED_CODE);
    expect(codeField().value).toBe(TYPED_CODE);
    expect(service.verifyCustomerOtp).toHaveBeenCalledWith(PHONE, TYPED_CODE);

    await settlePublish();
    expect(store.getState().auth.status).toBe('authenticated');
  });
});

describe('CustomerOtpScreen — the code never leaks', () => {
  it('is never written to the device, not even alongside the session', async () => {
    const { type, storage } = await render(stubAuthService());

    await type(TYPED_CODE);

    // A session was persisted, and the code used to obtain it was not part of it.
    expect(storage.write).toHaveBeenCalled();
    expect(JSON.stringify(storage.peek())).not.toContain(TYPED_CODE);
  });

  it('is not sent anywhere by requesting a replacement', async () => {
    const service = stubAuthService();
    const { type, press, store, storage } = await render(service);

    // Deliberately incomplete: a finished code would verify itself before the
    // resend was ever asked for.
    await type(TYPED_CODE.slice(0, 4));
    await press('Resend code');

    // Resending asks for a new code with the number alone. It proves nothing,
    // so it must not authenticate and must not carry the typed code.
    expect(service.requestCustomerOtp).toHaveBeenCalledWith(PHONE);
    expect(store.getState().auth.status).not.toBe('authenticated');
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('is not written to logs, even when verification fails', async () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const service = stubAuthService({
      verifyCustomerOtp: jest.fn(async () => {
        throw new AppError({ kind: 'validation', message: 'code mismatch' });
      }),
    });
    const { type } = await render(service);

    await type(TYPED_CODE);

    const logged = [...consoleLog.mock.calls, ...consoleError.mock.calls]
      .flat()
      .map(entry => JSON.stringify(entry))
      .join(' ');

    expect(logged).not.toContain(TYPED_CODE);
  });

  it('is not held in Redux after a successful sign in', async () => {
    const { type, store } = await render(stubAuthService());

    await type(TYPED_CODE);

    expect(JSON.stringify(store.getState())).not.toContain(TYPED_CODE);
  });
});

describe('CustomerOtpScreen — changing the number', () => {
  it('goes back rather than rebuilding the sign-in form', async () => {
    const { press, goBack, navigate } = await render(stubAuthService());

    await press('Change phone number');

    expect(goBack).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
