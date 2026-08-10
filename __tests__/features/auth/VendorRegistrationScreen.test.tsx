/**
 * Vendor registration is the widest form in the app, so these tests concentrate
 * on the boundary rather than the layout: what is allowed to reach the service,
 * in what shape, and what survives a failure.
 *
 * Two rules are structural and worth pinning. Registering must never produce a
 * session — the response is a handle and a challenge, nothing more — and the
 * services a vendor selects travel as identifiers, never as names.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';

import { VendorRegistrationScreen } from '@/features/auth/screens/VendorRegistrationScreen';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { AuthService, VendorRegistration } from '@/shared/services/types/AuthService';
import type { CategoryService, ServiceCategory } from '@/shared/services/types/CategoryService';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const CATEGORIES: ServiceCategory[] = [
  { id: 'cat_test_a', name: 'Category A', iconGlyph: 'flash-outline' },
  { id: 'cat_test_b', name: 'Category B', iconGlyph: 'water-outline' },
];

const REGISTRATION: VendorRegistration = {
  registrationId: 'reg_test_1',
  challenge: {
    maskedDestination: '••••••3210',
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    resendAfterSeconds: 30,
  },
};

const VALID = {
  businessName: 'Sharma Electricals',
  ownerFirstName: 'Neha',
  ownerLastName: 'Sharma',
  phone: '+91 98765-43210',
  normalisedPhone: '919876543210',
  email: 'Neha@Example.COM',
};

function stubAuthService(overrides: Partial<AuthService> = {}): AuthService {
  const unexpected = (name: string) => () => {
    throw new Error(`${name} must not be called from the registration screen`);
  };

  return {
    registerVendor: jest.fn(async () => REGISTRATION),
    requestCustomerOtp: unexpected('requestCustomerOtp'),
    verifyCustomerOtp: unexpected('verifyCustomerOtp'),
    requestVendorOtp: unexpected('requestVendorOtp'),
    verifyVendorOtp: unexpected('verifyVendorOtp'),
    verifyVendorAuthCode: unexpected('verifyVendorAuthCode'),
    regenerateVendorAuthCode: unexpected('regenerateVendorAuthCode'),
    signInVendor: unexpected('signInVendor'),
    signOut: unexpected('signOut'),
    ...overrides,
  } as AuthService;
}

function stubCategoryService(): CategoryService {
  return { listServiceCategories: jest.fn(async () => CATEGORIES) };
}

async function render(service: AuthService, categories: CategoryService = stubCategoryService()) {
  registerService('auth', service);
  registerService('category', categories);

  const navigate = jest.fn();
  const navigation = { navigate } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <VendorRegistrationScreen navigation={navigation} route={{} as never} />
      </ThemeProvider>,
    );
  });

  /**
   * The text input itself, not the ControlledInput wrapper that also carries the
   * testID — only one of them has an onChangeText to drive.
   */
  const field = (testID: string) => {
    const matches = renderer.root.findAll(
      node => node.props.testID === testID && typeof node.props.onChangeText === 'function',
    );
    if (matches.length === 0) {
      throw new Error(`No editable field found for testID "${testID}"`);
    }
    return matches[matches.length - 1];
  };

  const fill = async (testID: string, value: string) => {
    await act(async () => {
      field(testID).props.onChangeText(value);
    });
  };

  const press = async (accessibilityLabel: string) => {
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel }).props.onPress();
    });
  };

  /** Fills every required field with valid values, selecting one category. */
  const fillValid = async () => {
    await fill('vendor-business-name', VALID.businessName);
    await fill('vendor-first-name', VALID.ownerFirstName);
    await fill('vendor-last-name', VALID.ownerLastName);
    await fill('vendor-phone', VALID.phone);
    await press(CATEGORIES[0].name);
  };

  return {
    renderer,
    navigate,
    fill,
    press,
    fillValid,
    submit: () => press('Continue'),
    valueOf: (testID: string) => field(testID).props.value,
    submitButton: () => renderer.root.findByProps({ accessibilityLabel: 'Continue' }).props,
    text: () => textOf(renderer.toJSON()),
  };
}

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

describe('VendorRegistrationScreen — the form', () => {
  it('renders every field the service contract carries', async () => {
    const { renderer, text } = await render(stubAuthService());

    expect(renderer.root.findByProps({ testID: 'vendor-business-name' })).toBeDefined();
    expect(renderer.root.findByProps({ testID: 'vendor-first-name' })).toBeDefined();
    expect(renderer.root.findByProps({ testID: 'vendor-last-name' })).toBeDefined();
    expect(renderer.root.findByProps({ testID: 'vendor-phone' })).toBeDefined();
    expect(renderer.root.findByProps({ testID: 'vendor-email' })).toBeDefined();
    expect(text()).toContain(CATEGORIES[0].name);
  });

  it('says nothing about approval, review or waiting', async () => {
    const { text } = await render(stubAuthService());

    expect(text().toLowerCase()).not.toContain('approval');
    expect(text().toLowerCase()).not.toContain('pending');
    expect(text().toLowerCase()).not.toContain('review');
  });
});

describe('VendorRegistrationScreen — validation', () => {
  it('reports every missing required field at once', async () => {
    const service = stubAuthService();
    const { submit, text } = await render(service);

    await submit();

    const rendered = text();
    expect(rendered).toContain('Enter the business name.');
    expect(rendered).toContain('Enter the first name.');
    expect(rendered).toContain('Enter the last name.');
    expect(rendered).toContain('Enter your phone number.');
    expect(rendered).toContain('Select at least one service you offer.');
    expect(service.registerVendor).not.toHaveBeenCalled();
  });

  it('rejects an implausible phone number', async () => {
    const service = stubAuthService();
    const { fillValid, fill, submit, text } = await render(service);

    await fillValid();
    await fill('vendor-phone', '12345');
    await submit();

    expect(text()).toContain('too short');
    expect(service.registerVendor).not.toHaveBeenCalled();
  });

  it('rejects a malformed email but allows none at all', async () => {
    const service = stubAuthService();
    const { fillValid, fill, submit, text } = await render(service);

    await fillValid();
    await fill('vendor-email', 'neha@@example');
    await submit();

    expect(text()).toContain('Enter a valid email address.');
    expect(service.registerVendor).not.toHaveBeenCalled();

    // Email is optional in the contract, so clearing it must let the form through.
    await fill('vendor-email', '');
    await submit();

    expect(service.registerVendor).toHaveBeenCalledTimes(1);
    expect(service.registerVendor).toHaveBeenCalledWith(
      expect.objectContaining({ email: undefined }),
    );
  });

  it('requires at least one service to be selected', async () => {
    const service = stubAuthService();
    const { fillValid, press, submit, text } = await render(service);

    await fillValid();
    await press(CATEGORIES[0].name); // deselect

    await submit();

    expect(text()).toContain('Select at least one service you offer.');
    expect(service.registerVendor).not.toHaveBeenCalled();
  });
});

describe('VendorRegistrationScreen — submission', () => {
  it('sends normalised values, with services as identifiers', async () => {
    const service = stubAuthService();
    const { fillValid, fill, press, submit } = await render(service);

    await fillValid();
    await fill('vendor-email', VALID.email);
    await press(CATEGORIES[1].name);
    await submit();

    expect(service.registerVendor).toHaveBeenCalledWith({
      businessName: VALID.businessName,
      ownerFirstName: VALID.ownerFirstName,
      ownerLastName: VALID.ownerLastName,
      phone: VALID.normalisedPhone,
      email: 'neha@example.com',
      serviceCategoryIds: [CATEGORIES[0].id, CATEGORIES[1].id],
    });
  });

  it('sends no category name, only identifiers', async () => {
    const service = stubAuthService();
    const { fillValid, submit } = await render(service);

    await fillValid();
    await submit();

    const submitted = (service.registerVendor as jest.Mock).mock.calls[0][0];
    expect(JSON.stringify(submitted)).not.toContain(CATEGORIES[0].name);
  });

  it('locks the button while the request is in flight', async () => {
    let release!: (registration: VendorRegistration) => void;
    const service = stubAuthService({
      registerVendor: jest.fn(
        () =>
          new Promise<VendorRegistration>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { fillValid, submit, submitButton } = await render(service);

    await fillValid();
    expect(submitButton().accessibilityState.busy).toBe(false);

    await submit();
    expect(submitButton().accessibilityState.busy).toBe(true);
    expect(submitButton().accessibilityState.disabled).toBe(true);

    await act(async () => {
      release(REGISTRATION);
    });
  });

  it('will not register twice while the first request is unanswered', async () => {
    let release!: (registration: VendorRegistration) => void;
    const service = stubAuthService({
      registerVendor: jest.fn(
        () =>
          new Promise<VendorRegistration>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { fillValid, submit } = await render(service);

    await fillValid();
    await submit();
    await submit();

    expect(service.registerVendor).toHaveBeenCalledTimes(1);

    await act(async () => {
      release(REGISTRATION);
    });
  });

  it('hands verification the registration id, not the phone number', async () => {
    const { fillValid, submit, navigate } = await render(stubAuthService());

    await fillValid();
    await submit();

    expect(navigate).toHaveBeenCalledWith('VendorOtp', {
      registrationId: REGISTRATION.registrationId,
      challenge: REGISTRATION.challenge,
    });

    // Onboarding is identified by the handle. Knowing the number must not be
    // enough to resume someone else's registration.
    const params = navigate.mock.calls[0][1];
    expect(JSON.stringify(params)).not.toContain(VALID.normalisedPhone);
  });
});

describe('VendorRegistrationScreen — failure', () => {
  it('shows the safe message and keeps every entered value', async () => {
    const failure = new AppError({
      kind: 'conflict',
      message: 'duplicate key vendors_phone_idx (9876543210)',
      userMessage: 'An account already exists for this number. Try signing in instead.',
    });
    const service = stubAuthService({
      registerVendor: jest.fn(async () => {
        throw failure;
      }),
    });
    const { fillValid, submit, text, valueOf } = await render(service);

    await fillValid();
    await submit();

    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain('duplicate key');

    expect(valueOf('vendor-business-name')).toBe(VALID.businessName);
    expect(valueOf('vendor-first-name')).toBe(VALID.ownerFirstName);
    expect(valueOf('vendor-phone')).toBe(VALID.phone);
  });

  it('allows a retry once the failure is understood', async () => {
    const service = stubAuthService({
      registerVendor: jest
        .fn()
        .mockRejectedValueOnce(new AppError({ kind: 'network' }))
        .mockResolvedValueOnce(REGISTRATION),
    });
    const { fillValid, submit, navigate } = await render(service);

    await fillValid();
    await submit();
    await submit();

    expect(service.registerVendor).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});

describe('VendorRegistrationScreen — nothing leaks', () => {
  it('passes on no one-time code, because it is never given one', async () => {
    const { fillValid, submit, navigate, text } = await render(stubAuthService());

    await fillValid();
    await submit();

    expect(JSON.stringify(REGISTRATION)).not.toMatch(/\b\d{6}\b/);
    expect(JSON.stringify(navigate.mock.calls)).not.toMatch(/\b\d{6}\b/);
    expect(text()).not.toMatch(/\b\d{6}\b/);
  });

  it('writes neither the phone number nor the registration handle to logs', async () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const service = stubAuthService({
      registerVendor: jest.fn(async () => {
        throw new AppError({ kind: 'server', message: 'registration failed' });
      }),
    });
    const { fillValid, submit } = await render(service);

    await fillValid();
    await submit();

    const logged = [...consoleLog.mock.calls, ...consoleError.mock.calls]
      .flat()
      .map(entry => JSON.stringify(entry))
      .join(' ');

    expect(logged).not.toContain(VALID.normalisedPhone);
    expect(logged).not.toContain(REGISTRATION.registrationId);
  });
});
