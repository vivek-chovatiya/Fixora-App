/**
 * Vendor sign in while the remembered number is being read, and the moment it
 * arrives (review finding, 21/10/2026).
 *
 * - A slow read shows the shared loader in the form's place, after a delay —
 *   never at once, which would flash on every ordinary visit, and never a face
 *   that is then swapped for the other one.
 * - The remembered number is in the hidden phone field before the face can be
 *   tapped. The probe below stands in for that tap: the skyline at the foot of
 *   the screen is replaced by a component whose passive effect types a code and
 *   presses Sign in in the very commit that first draws the face. A child's
 *   passive effects run before its parent's, so a number filled by the screen's
 *   own passive effect would not be there yet — exactly the gap between the
 *   paint and that effect on a device.
 *
 * Apart from `VendorLoginScreen.test.tsx` because of that replacement: the
 * skyline is part of what those tests draw.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage, type PersistedSession } from '@/core/storage/SessionStorage';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { authReducer } from '@/features/auth/state/authSlice';
import { setRememberedVendorStorage } from '@/features/auth/state/rememberedVendorStorage';
import { VendorLoginScreen } from '@/features/auth/screens/VendorLoginScreen';
import type { SessionPayload } from '@/features/auth/types';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { AuthService } from '@/shared/services/types/AuthService';
import { ToastProvider } from '@/shared/components';
import { ThemeProvider } from '@/shared/theme';

const COPY = AUTH_COPY.vendorLogin;

const REMEMBERED_PHONE = '9000000001';
const CODE = '482913';

/** Runs after every commit the screen's foot is part of; set by a test. */
let mockOnCommit: (() => void) | null = null;

jest.mock('@/features/auth/components/AuthCityscape', () => {
  const { useEffect: useProbeEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    AuthCityscape: function ProbeCityscape() {
      // No dependencies on purpose: once per commit, like a tap that can land
      // on any frame.
      useProbeEffect(() => {
        mockOnCommit?.();
      });
      return null;
    },
  };
});

const SESSION: SessionPayload = {
  token: 'token_vendor',
  user: {
    id: 'usr_vendor_1',
    firstName: 'Ravi',
    lastName: 'Kumar',
    phone: REMEMBERED_PHONE,
    role: 'vendor',
  },
};

function stubAuthService(): AuthService {
  const unexpected = (name: string) =>
    jest.fn(() => {
      throw new Error(`${name} must not be called from vendor sign in`);
    });

  return {
    signInVendor: jest.fn(async () => SESSION),
    registerVendor: unexpected('registerVendor'),
    requestVendorOtp: unexpected('requestVendorOtp'),
    verifyVendorOtp: unexpected('verifyVendorOtp'),
    verifyVendorAuthCode: unexpected('verifyVendorAuthCode'),
    regenerateVendorAuthCode: unexpected('regenerateVendorAuthCode'),
    requestCustomerOtp: unexpected('requestCustomerOtp'),
    verifyCustomerOtp: unexpected('verifyCustomerOtp'),
    signOut: unexpected('signOut'),
  } as AuthService;
}

/** A remembered-vendor store whose read answers only when the test says so. */
function slowRemembered() {
  let answer!: (phone: string | null) => void;
  const read = new Promise<string | null>(resolve => {
    answer = resolve;
  });
  setRememberedVendorStorage({
    read: jest.fn(() => read),
    remember: jest.fn(async () => true),
    forget: jest.fn(async () => undefined),
  });
  return {
    answer: async (phone: string | null) => {
      await act(async () => {
        answer(phone);
      });
    },
  };
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  mockOnCommit = null;
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  resetServices();
  jest.useRealTimers();
});

async function render(service: AuthService) {
  registerService('auth', service);
  let session: PersistedSession | null = null;
  setSessionStorage({
    read: jest.fn(async () => session),
    write: jest.fn(async (next: PersistedSession) => {
      session = next;
    }),
    clear: jest.fn(async () => {
      session = null;
    }),
  });

  const store = configureStore({ reducer: { auth: authReducer } });
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(),
  } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <VendorLoginScreen navigation={navigation} route={{} as never} />
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  mounted.push(renderer);

  return {
    renderer,
    hasLoader: () =>
      renderer.root.findAll(
        node => typeof node.type === 'string' && node.props.accessibilityRole === 'progressbar',
      ).length > 0,
    /** Either face: the heading both of them open with. */
    hasFace: () => renderer.root.findAll(node => node.props.testID === 'vendor-login-heading').length > 0,
    hasPhoneField: () => renderer.root.findAll(node => node.props.testID === 'vendor-login-phone').length > 0,
  };
}

describe('VendorLoginScreen — a slow remembered-number read', () => {
  it('shows nothing in the form’s place at first, and the loader once the read outlasts the delay', async () => {
    jest.useFakeTimers();
    const remembered = slowRemembered();
    const screen = await render(stubAuthService());

    expect(screen.hasLoader()).toBe(false);
    expect(screen.hasFace()).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(299);
    });
    expect(screen.hasLoader()).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.hasLoader()).toBe(true);
    // Waiting, not guessing: neither face, so neither can be swapped away.
    expect(screen.hasFace()).toBe(false);
    expect(screen.hasPhoneField()).toBe(false);

    await remembered.answer(REMEMBERED_PHONE);

    expect(screen.hasLoader()).toBe(false);
    expect(screen.hasFace()).toBe(true);
    expect(screen.hasPhoneField()).toBe(false);
  });

  it('never shows the loader for a read that answers inside the delay', async () => {
    jest.useFakeTimers();
    const remembered = slowRemembered();
    const screen = await render(stubAuthService());

    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.hasLoader()).toBe(false);

    await remembered.answer(null);
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });

    expect(screen.hasLoader()).toBe(false);
    expect(screen.hasFace()).toBe(true);
    expect(screen.hasPhoneField()).toBe(true);
  });
});

describe('VendorLoginScreen — the moment the remembered number arrives', () => {
  it('has the number in the hidden phone field before the face can be tapped', async () => {
    const service = stubAuthService();
    const remembered = slowRemembered();
    const screen = await render(service);

    // The tap: in the first commit that draws the face, before anything
    // scheduled after the paint has run.
    let tapped = false;
    mockOnCommit = () => {
      const [codeField] = screen.renderer.root.findAll(
        node =>
          typeof node.type === 'string' &&
          node.props.testID === 'vendor-login-code' &&
          typeof node.props.onChangeText === 'function',
      );
      if (tapped || !codeField) {
        return;
      }
      tapped = true;
      codeField.props.onChangeText(CODE);
      screen.renderer.root.findByProps({ accessibilityLabel: COPY.submit }).props.onPress();
    };

    await remembered.answer(REMEMBERED_PHONE);
    await act(async () => {});

    expect(tapped).toBe(true);
    expect(service.signInVendor).toHaveBeenCalledWith(REMEMBERED_PHONE, CODE);
  });
});
