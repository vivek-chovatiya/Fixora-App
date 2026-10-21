/**
 * Completing a job and recording what it came to, on screen (PROJECT_BIBLE.md
 * sections 36 and 37: the offline payment record), through the real
 * VendorNavigator and the real mock services sharing one record of what
 * vendors did.
 *
 * Pinned here:
 *
 * - "Mark completed" on a request in progress opens the form, which carries the
 *   reference and nothing else
 * - nothing is preselected; pressing "Complete work" empty says what is wrong
 *   beside each field, sends nothing and asks nothing
 * - the method is asked for only when the customer paid, its options are the
 *   service's (never the app's), and choosing "Not paid yet" takes its message
 *   away with it
 * - the methods loading is announced; their failure is said beside the field
 *   with Try again — five presses read once — while the rest of the form keeps
 *   working and keeping its values; a paid job cannot be sent without a method
 * - valid → the confirmation; Cancel sends nothing and keeps the form
 * - confirmed → one call with exactly the record built (paid: amount, currency,
 *   status, method, notes exactly as typed; not paid: no method key, no notes
 *   key), then back on the request, read again: completed, with "Payment" —
 *   the amount, "Paid · UPI" or "Not paid yet", the notes, "Recorded by you"
 * - five confirms send one completion; the button and dialog are busy meanwhile
 * - a failure keeps everything typed, says the failure's own words, and the
 *   button is the retry
 * - a job completed elsewhere first is said calmly; the form is left and the
 *   request shows where it really is
 * - leaving with something typed asks first — the Back control and Android
 *   back; leaving untouched, or after completing, asks nothing
 * - finished work shows the record it has, and nothing about payment when it
 *   has none
 * - no word anywhere says Fixora processed a payment
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  CommonActions,
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { AuthUser } from '@/features/auth/types';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import type { VendorStackParamList } from '@/navigation/types';
import { VendorNavigator } from '@/navigation/VendorNavigator';
import { ToastProvider } from '@/shared/components';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { MockVendorRequestBook } from '@/shared/services/mock/MockVendorRequestBook';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import type { MockDashboardScenario } from '@/shared/services/mock/mockVendorDashboardData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type {
  PaymentMethodOption,
  VendorCompletionInput,
  VendorWorkStepResult,
} from '@/shared/services/types/VendorRequestService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const FORM = VENDOR_COPY.completeForm;
const WORK = VENDOR_COPY.work;
const PAYMENT = VENDOR_COPY.payment;
const VALIDATION = VENDOR_COPY.validation;
const DETAILS = VENDOR_COPY.requestDetails;
const JOB = VENDOR_COPY.job;

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

/** In the fixtures: in progress; and finished — paid by UPI, not paid yet, and with no record. */
const IN_PROGRESS = { id: 'REQ-30954', service: 'Inverter installation' };
const PAID_BY_UPI = 'REQ-30912';
const NOT_PAID_YET = 'REQ-30833';
const NO_RECORD = 'REQ-30876';

const DETAILS_SCREEN = 'vendor-request-details';
const FORM_SCREEN = 'complete-work';

const ref = (id: string) => `${JOB.referencePrefix} ${id}`;
const markCompleted = WORK.completeSpoken(IN_PROGRESS.service, ref(IN_PROGRESS.id));
const status = (label: string) => `${DETAILS.statusLabel}: ${label}`;

const offline = () => new AppError({ kind: 'network', message: 'socket hang up' });

let current: AuthUser;
let book: MockVendorRequestBook;
let requests: MockVendorRequestService;
/** Ravi again, from another phone, while this screen is open. */
let raviElsewhere: MockVendorRequestService;
let consoleError: jest.SpyInstance;

beforeEach(async () => {
  resetServices();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  current = RAVI;
  book = new MockVendorRequestBook();
  const scenarios: Record<string, MockDashboardScenario> = { [RAVI.id]: 'mixed' };
  const scenarioFor = (vendorId: string) => scenarios[vendorId] ?? 'empty';
  const currentUser = async () => current;

  const profiles = new MockVendorProfileService({ latency: NO_LATENCY, currentUser });
  requests = new MockVendorRequestService({ latency: NO_LATENCY, currentUser, scenarioFor, book });
  raviElsewhere = new MockVendorRequestService({
    latency: NO_LATENCY,
    currentUser: async () => RAVI,
    scenarioFor,
    book,
  });
  registerService('vendorProfile', profiles);
  registerService('vendorRequests', requests);
  registerService(
    'vendorDashboard',
    new MockVendorDashboardService({ latency: NO_LATENCY, currentUser, scenarioFor, book }),
  );
  registerService('category', {
    listServiceCategories: jest.fn(async () => [{ id: 'cat_electrician', name: 'Electrician' }]),
    listSubCategories: jest.fn(async () => []),
  } as CategoryService);

  setSessionStorage({
    read: async () => ({ token: 'token', user: current }),
    write: async () => undefined,
    clear: async () => undefined,
  });

  await profiles.saveProfile({ businessName: 'Kumar Electricals', serviceCategoryIds: ['cat_electrician'] });
});

type Instance = ReactTestRenderer.ReactTestInstance;

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
  consoleError.mockRestore();
});

function textOf(node: Instance): string {
  return node.children.map(child => (typeof child === 'string' ? child : textOf(child))).join(' ');
}

async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {});
  }
}

function held<T>() {
  let land!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    land = resolve;
    fail = reject;
  });
  return { promise, land, fail };
}

async function render() {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user: current }));
  const navigation = createNavigationContainerRef<VendorStackParamList>();

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <NavigationContainer ref={navigation}>
              <VendorNavigator />
            </NavigationContainer>
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  mounted.push(renderer);
  await flush();

  const hosts = (id: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id);
  const has = (id: string) => hosts(id).length > 0;
  const scope = (within?: string) => (within ? hosts(within)[0] ?? renderer.root : renderer.root);

  const pressables = (label: string, within?: string) =>
    scope(within)
      .findAll(node => node.props?.accessibilityLabel === label)
      .filter(node => typeof node.props?.onPress === 'function');

  const tap = async (label: string, times = 1, within?: string) => {
    const [target] = pressables(label, within);
    if (!target) {
      throw new Error(`Nothing pressable labelled "${label}"`);
    }
    await act(async () => {
      for (let i = 0; i < times; i += 1) {
        target.props.onPress();
      }
    });
    await flush();
  };

  /** A chip or button by its test id. */
  const pressId = async (id: string, times = 1) => {
    const [target] = renderer.root.findAll(
      node => node.props?.testID === id && typeof node.props?.onPress === 'function',
    );
    if (!target) {
      throw new Error(`Nothing pressable with id "${id}"`);
    }
    await act(async () => {
      for (let i = 0; i < times; i += 1) {
        target.props.onPress();
      }
    });
    await flush();
  };

  const field = (id: string) => {
    const [target] = renderer.root.findAll(
      node => node.props?.testID === id && typeof node.props?.onChangeText === 'function',
    );
    if (!target) {
      throw new Error(`No field "${id}"`);
    }
    return target;
  };

  const screen = {
    renderer,
    navigation,
    has,
    tap,
    pressId,
    pressables,
    field,
    flush,
    text: (id: string) => (has(id) ? textOf(hosts(id)[0]) : ''),
    /** Everything drawn or spoken, as text — for what must never be said. */
    everything: () =>
      [
        textOf(renderer.root),
        ...renderer.root
          .findAll(node => typeof node.type === 'string')
          .flatMap(node => [node.props?.accessibilityLabel, node.props?.accessibilityHint, node.props?.placeholder])
          .filter((value): value is string => typeof value === 'string'),
      ].join('\n'),
    type: async (id: string, value: string) => {
      await act(async () => {
        field(id).props.onChangeText(value);
      });
      await flush();
    },
    /** The radio chip's checked state, as assistive technology reads it. */
    checked: (id: string) =>
      renderer.root.findAll(
        node => node.props?.testID === id && node.props?.accessibilityRole === 'radio',
      )[0]?.props.accessibilityState?.checked === true,
    busy: (label: string) =>
      renderer.root.findAll(
        node => node.props?.accessibilityLabel === label && node.props?.accessibilityState?.busy === true,
      ).length > 0,
    toast: (): string | undefined =>
      renderer.root.findAll(
        node => node.props?.accessibilityHint === 'Dismisses this message' && typeof node.props.onPress === 'function',
      )[0]?.props.accessibilityLabel,
    heading: () =>
      renderer.root.findAll(
        node => typeof node.type === 'string' && node.props?.testID === 'vendor-request-heading',
      )[0]?.props.accessibilityLabel as string | undefined,
    onForm: () => has(FORM_SCREEN),
    /** Opens a request's details from the list, by its card. */
    open: async (id: string) => {
      await tap('Requests');
      const [card] = renderer.root.findAll(
        node =>
          node.props?.testID === `vendor-request-${id}` &&
          node.props?.accessibilityRole === 'button' &&
          typeof node.props?.onPress === 'function',
      );
      if (!card) {
        throw new Error(`No card for ${id} on screen`);
      }
      await act(async () => {
        card.props.onPress();
      });
      await flush();
    },
    /** Android back, as the hardware button sends it: to the navigation container. */
    hardwareBack: async () => {
      await act(async () => {
        navigation.dispatch(CommonActions.goBack());
      });
      await flush();
    },
  };

  return screen;
}

type Screen = Awaited<ReturnType<typeof render>>;

/** The details of the job in progress, then its completion form. */
async function openForm(): Promise<Screen> {
  const screen = await render();
  await screen.open(IN_PROGRESS.id);
  await screen.tap(markCompleted, 1, DETAILS_SCREEN);
  return screen;
}

/** Fills the form: an amount, a status, and — when paid — a method; notes if given. */
async function fill(
  screen: Screen,
  values: { amount?: string; status?: 'PAID' | 'UNPAID'; method?: string; notes?: string },
) {
  if (values.amount !== undefined) {
    await screen.type('complete-work-amount', values.amount);
  }
  if (values.status) {
    await screen.pressId(`complete-work-status-${values.status}`);
  }
  if (values.method) {
    await screen.pressId(`complete-work-method-${values.method}`);
  }
  if (values.notes !== undefined) {
    await screen.type('complete-work-notes', values.notes);
  }
}

/** Presses "Complete work" on the form — never the details' "Mark completed". */
const submit = (screen: Screen, times = 1) => screen.tap(FORM.submit, times, FORM_SCREEN);

describe('Reaching the form', () => {
  it('opens from Mark completed on the request, with its reference and nothing chosen', async () => {
    const screen = await openForm();

    expect(screen.onForm()).toBe(true);
    expect(screen.text('complete-work-heading')).toContain(FORM.title);
    expect(screen.text('complete-work-reference')).toContain(ref(IN_PROGRESS.id));
    expect(screen.field('complete-work-amount').props.value).toBe('');
    expect(screen.checked('complete-work-status-PAID')).toBe(false);
    expect(screen.checked('complete-work-status-UNPAID')).toBe(false);
    // The method is a paid job's question, and nothing has been said to be paid.
    expect(screen.has('complete-work-method')).toBe(false);
  });

  it('says the job is recorded here, not paid through Fixora', async () => {
    const screen = await openForm();

    expect(screen.text(FORM_SCREEN)).toContain(FORM.subtitle);
    expect(FORM.subtitle).toContain('Fixora does not process payments');
  });

  it('names the amount with its currency for a screen reader, and reads the symbol from the formatter', async () => {
    const screen = await openForm();

    expect(screen.field('complete-work-amount').props.accessibilityLabel).toBe(`${FORM.amountLabel}, ₹`);
    expect(screen.field('complete-work-amount').props.keyboardType).toBe('decimal-pad');
  });

  it('groups each choice as one named radio group', async () => {
    const screen = await openForm();
    await fill(screen, { status: 'PAID' });

    const groups = screen.renderer.root
      .findAll(node => typeof node.type === 'string' && node.props?.accessibilityRole === 'radiogroup')
      .map(node => node.props.accessibilityLabel);
    expect(groups).toEqual(expect.arrayContaining([FORM.statusLabel, FORM.methodLabel]));
    expect(screen.checked('complete-work-status-PAID')).toBe(true);
  });
});

describe('Checking the form', () => {
  it('says what is missing beside each field, sends nothing and asks nothing', async () => {
    const completeRequest = jest.spyOn(requests, 'completeRequest');
    const screen = await openForm();

    await submit(screen);

    expect(screen.text(FORM_SCREEN)).toContain(VALIDATION.amountRequired);
    expect(screen.text('complete-work-status-error')).toContain(VALIDATION.paymentStatusRequired);
    expect(screen.text('complete-work-fix-errors')).toContain(FORM.fixErrors);
    expect(screen.has('vendor-complete-dialog')).toBe(false);
    expect(completeRequest).not.toHaveBeenCalled();
  });

  it('refuses an amount it cannot read, with the reason beside it', async () => {
    const screen = await openForm();

    await fill(screen, { amount: '1,250', status: 'UNPAID' });
    await submit(screen);
    expect(screen.text(FORM_SCREEN)).toContain(VALIDATION.amountFormat);

    await fill(screen, { amount: '0' });
    expect(screen.text(FORM_SCREEN)).toContain(VALIDATION.amountTooSmall);

    await fill(screen, { amount: '2000000' });
    expect(screen.text(FORM_SCREEN)).toContain(VALIDATION.amountTooLarge('₹10,00,000'));
    expect(screen.has('vendor-complete-dialog')).toBe(false);
  });

  it('asks for the method only when paid — and "Not paid yet" takes its message with it', async () => {
    const screen = await openForm();

    await fill(screen, { amount: '1250', status: 'PAID' });
    await submit(screen);
    expect(screen.text('complete-work-method-error')).toContain(VALIDATION.paymentMethodRequired);
    expect(screen.has('complete-work-fix-errors')).toBe(true);

    await fill(screen, { status: 'UNPAID' });
    expect(screen.has('complete-work-method')).toBe(false);
    expect(screen.has('complete-work-method-error')).toBe(false);
    expect(screen.has('complete-work-fix-errors')).toBe(false);

    await submit(screen);
    expect(screen.has('vendor-complete-dialog')).toBe(true);
  });
});

describe('The payment methods', () => {
  it('offers the service’s methods, not a list of the app’s own', async () => {
    const methods: PaymentMethodOption[] = [
      { id: 'cheque', label: 'Cheque' },
      { id: 'upi', label: 'UPI' },
    ];
    jest.spyOn(requests, 'listPaymentMethods').mockResolvedValue(methods);
    const screen = await openForm();

    await fill(screen, { status: 'PAID' });

    const shown = screen.renderer.root
      .findAll(
        node =>
          typeof node.props?.testID === 'string' &&
          node.props.testID.startsWith('complete-work-method-') &&
          node.props?.accessibilityRole === 'radio',
      )
      .map(node => node.props.accessibilityLabel);
    expect([...new Set(shown)]).toEqual(['Cheque', 'UPI']);
    expect(screen.text(FORM_SCREEN)).not.toContain('Bank transfer');
  });

  it('says it is loading them, by name and as busy', async () => {
    const read = held<PaymentMethodOption[]>();
    jest.spyOn(requests, 'listPaymentMethods').mockReturnValueOnce(read.promise);
    const screen = await openForm();
    await fill(screen, { status: 'PAID' });

    const [loading] = screen.renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.testID === 'complete-work-methods-loading',
    );
    expect(loading.props.accessibilityLabel).toBe(FORM.methodsLoading);
    expect(loading.props.accessibilityState).toEqual({ busy: true });

    await act(async () => {
      read.land([{ id: 'cash', label: 'Cash' }]);
    });
    await screen.flush();
    expect(screen.has('complete-work-methods-loading')).toBe(false);
    expect(screen.has('complete-work-method-cash')).toBe(true);
  });

  it('says beside the field when they fail, keeps the rest of the form, and reads once for five Try agains', async () => {
    const methods = jest.spyOn(requests, 'listPaymentMethods').mockRejectedValueOnce(offline());
    const screen = await openForm();
    await fill(screen, { amount: '1250', status: 'PAID', notes: 'Wired two rooms.' });

    expect(screen.text('complete-work-methods-error')).toContain(FORM.methodsFailed);
    expect(screen.text('complete-work-methods-error')).toContain(offline().userMessage);
    expect(screen.text('complete-work-methods-error')).not.toContain('socket hang up');
    // The rest of the form is untouched by it.
    expect(screen.field('complete-work-amount').props.value).toBe('1250');
    expect(screen.field('complete-work-notes').props.value).toBe('Wired two rooms.');

    // A paid job cannot go without a method.
    await submit(screen);
    expect(screen.text('complete-work-method-error')).toContain(VALIDATION.paymentMethodRequired);
    expect(screen.has('vendor-complete-dialog')).toBe(false);

    const retry = held<PaymentMethodOption[]>();
    methods.mockReturnValueOnce(retry.promise);
    const callsBefore = methods.mock.calls.length;
    await screen.tap(FORM.methodsRetry, 5, FORM_SCREEN);
    expect(methods.mock.calls.length - callsBefore).toBe(1);

    await act(async () => {
      retry.land([
        { id: 'cash', label: 'Cash' },
        { id: 'upi', label: 'UPI' },
      ]);
    });
    await screen.flush();

    expect(screen.has('complete-work-methods-error')).toBe(false);
    await fill(screen, { method: 'upi' });
    await submit(screen);
    expect(screen.has('vendor-complete-dialog')).toBe(true);
    expect(screen.field('complete-work-amount').props.value).toBe('1250');
  });

  it('lets a job not paid yet go without the methods at all', async () => {
    jest.spyOn(requests, 'listPaymentMethods').mockRejectedValue(offline());
    const screen = await openForm();

    await fill(screen, { amount: '450', status: 'UNPAID' });
    await submit(screen);

    expect(screen.has('vendor-complete-dialog')).toBe(true);
  });
});

describe('Confirming and sending', () => {
  it('asks first; Cancel sends nothing and keeps everything typed', async () => {
    const completeRequest = jest.spyOn(requests, 'completeRequest');
    const screen = await openForm();
    await fill(screen, { amount: '1250.50', status: 'PAID', method: 'upi', notes: 'All done.' });

    await submit(screen);
    expect(screen.has('vendor-complete-dialog')).toBe(true);
    expect(screen.text('vendor-complete-dialog')).toContain(WORK.completeMessage);

    await screen.tap(WORK.completeCancel);
    expect(screen.has('vendor-complete-dialog')).toBe(false);
    expect(completeRequest).not.toHaveBeenCalled();
    expect(screen.onForm()).toBe(true);
    expect(screen.field('complete-work-amount').props.value).toBe('1250.50');
    expect(screen.checked('complete-work-method-upi')).toBe(true);
  });

  it('sends a paid job with exactly these keys, then shows it completed with what was recorded', async () => {
    const completeRequest = jest.spyOn(requests, 'completeRequest');
    const screen = await openForm();
    const notes = '  Fitted the inverter.\nBattery under warranty.  ';
    await fill(screen, { amount: '1250.50', status: 'PAID', method: 'upi', notes });

    await submit(screen);
    await screen.tap(WORK.completeConfirm);

    expect(completeRequest).toHaveBeenCalledTimes(1);
    const [reference, sent] = completeRequest.mock.calls[0];
    expect(reference).toBe(IN_PROGRESS.id);
    expect(Object.keys(sent).sort()).toEqual([
      'currency',
      'finalAmountMinor',
      'notes',
      'paymentMethodId',
      'paymentStatus',
    ]);
    expect(sent).toEqual({
      finalAmountMinor: 125_050,
      currency: 'INR',
      paymentStatus: 'PAID',
      paymentMethodId: 'upi',
      notes,
    });
    // The method's id travels; its label never does.
    expect(JSON.stringify(sent)).not.toContain('UPI');

    // Back on the request, read again: completed, with the payment it was given.
    expect(screen.onForm()).toBe(false);
    expect(screen.has(DETAILS_SCREEN)).toBe(true);
    expect(screen.heading()).toContain(status(JOB.statusCompleted));
    expect(screen.has('vendor-request-work')).toBe(false);
    expect(screen.text('vendor-request-payment')).toContain(PAYMENT.section);
    expect(screen.text('vendor-request-payment-amount')).toContain('₹1,250.50');
    expect(screen.text('vendor-request-payment-status')).toContain('Paid · UPI');
    expect(screen.text('vendor-request-payment-notes')).toContain(notes);
    expect(screen.text('vendor-request-payment-recorded')).toContain(PAYMENT.recorded);
    expect(screen.toast()).toBe(WORK.completed);
    // Nothing was asked on the way out.
    expect(screen.has('complete-work-discard-dialog')).toBe(false);
  });

  it('sends a job not paid yet with no method and no notes — absent, not empty', async () => {
    const completeRequest = jest.spyOn(requests, 'completeRequest');
    const screen = await openForm();
    // A method chosen, then "Not paid yet": the method must not be sent.
    await fill(screen, { amount: ' 450 ', status: 'PAID', method: 'cash' });
    await fill(screen, { status: 'UNPAID', notes: '   ' });

    await submit(screen);
    await screen.tap(WORK.completeConfirm);

    const [, sent] = completeRequest.mock.calls[0];
    expect(Object.keys(sent).sort()).toEqual(['currency', 'finalAmountMinor', 'paymentStatus']);
    expect(sent).toEqual({ finalAmountMinor: 45_000, currency: 'INR', paymentStatus: 'UNPAID' });

    expect(screen.text('vendor-request-payment-status')).toContain('Not paid yet');
    expect(screen.text('vendor-request-payment-amount')).toContain('₹450');
    expect(screen.has('vendor-request-payment-notes')).toBe(false);
  });

  it('sends one completion for five presses and five confirms, busy until the service answers', async () => {
    const call = held<VendorWorkStepResult<'completed'>>();
    const completeRequest = jest.spyOn(requests, 'completeRequest').mockReturnValueOnce(call.promise);
    const screen = await openForm();
    await fill(screen, { amount: '1250', status: 'UNPAID' });

    await submit(screen, 5);
    await screen.tap(WORK.completeConfirm, 5);

    expect(completeRequest).toHaveBeenCalledTimes(1);
    expect(screen.busy(WORK.completeConfirm)).toBe(true);
    expect(screen.busy(FORM.submit)).toBe(true);
    expect(screen.field('complete-work-amount').props.editable).toBe(false);

    await act(async () => {
      call.land(await raviElsewhere.completeRequest(IN_PROGRESS.id, {
        finalAmountMinor: 125_000,
        currency: 'INR',
        paymentStatus: 'UNPAID',
      }));
    });
    await screen.flush();

    expect(screen.onForm()).toBe(false);
    expect(completeRequest).toHaveBeenCalledTimes(1);
  });

  it('keeps everything typed when completing fails, says why, and the button is the retry', async () => {
    const completeRequest = jest.spyOn(requests, 'completeRequest').mockRejectedValueOnce(offline());
    const screen = await openForm();
    await fill(screen, { amount: '1250.50', status: 'PAID', method: 'card', notes: 'Done.' });

    await submit(screen);
    await screen.tap(WORK.completeConfirm);

    expect(screen.onForm()).toBe(true);
    expect(screen.has('vendor-complete-dialog')).toBe(false);
    expect(screen.toast()).toBe(`${WORK.completeFailed} ${offline().userMessage}`);
    expect(screen.toast()).not.toContain('socket hang up');
    expect(screen.field('complete-work-amount').props.value).toBe('1250.50');
    expect(screen.checked('complete-work-status-PAID')).toBe(true);
    expect(screen.checked('complete-work-method-card')).toBe(true);
    expect(screen.field('complete-work-notes').props.value).toBe('Done.');
    expect(screen.busy(FORM.submit)).toBe(false);

    await submit(screen);
    await screen.tap(WORK.completeConfirm);
    expect(completeRequest).toHaveBeenCalledTimes(2);
    expect(screen.onForm()).toBe(false);
    expect(screen.heading()).toContain(status(JOB.statusCompleted));
  });

  it('says calmly when the job was completed elsewhere first, leaves the form, and shows it as it is', async () => {
    const screen = await openForm();
    await fill(screen, { amount: '999', status: 'PAID', method: 'cash' });

    await raviElsewhere.completeRequest(IN_PROGRESS.id, {
      finalAmountMinor: 200_000,
      currency: 'INR',
      paymentStatus: 'UNPAID',
    });
    await submit(screen);
    await screen.tap(WORK.completeConfirm);

    expect(screen.toast()).toBe(WORK.changed);
    expect(screen.onForm()).toBe(false);
    expect(screen.heading()).toContain(status(JOB.statusCompleted));
    // What was recorded is the other phone's, not what was typed here.
    expect(screen.text('vendor-request-payment-amount')).toContain('₹2,000');
    expect(screen.text('vendor-request-payment-status')).toContain('Not paid yet');
    expect(screen.has('complete-work-discard-dialog')).toBe(false);
  });

  it('reads the request again even when its details were never in view — restored under the form', async () => {
    const screen = await render();
    // Both pushed at once, as a restored or deep-linked stack would be: the details never have focus.
    await act(async () => {
      screen.navigation.dispatch(
        CommonActions.reset({
          index: 2,
          routes: [
            { name: 'VendorTabs' },
            { name: 'VendorRequestDetails', params: { requestId: IN_PROGRESS.id } },
            { name: 'CompleteWork', params: { requestId: IN_PROGRESS.id } },
          ],
        }),
      );
    });
    await screen.flush();
    expect(screen.onForm()).toBe(true);

    await fill(screen, { amount: '1250', status: 'UNPAID' });
    await submit(screen);
    await screen.tap(WORK.completeConfirm);

    expect(screen.onForm()).toBe(false);
    expect(screen.heading()).toContain(status(JOB.statusCompleted));
    expect(screen.text('vendor-request-payment-status')).toContain('Not paid yet');
  });

  it('comes back to the list from a card, with the job completed there', async () => {
    const screen = await render();
    await screen.tap('Requests');
    await screen.tap(markCompleted);
    expect(screen.onForm()).toBe(true);

    await fill(screen, { amount: '1250', status: 'UNPAID' });
    await submit(screen);
    await screen.tap(WORK.completeConfirm);

    expect(screen.onForm()).toBe(false);
    expect(screen.has(DETAILS_SCREEN)).toBe(false);
    expect(screen.pressables(markCompleted)).toHaveLength(0);
  });
});

describe('Leaving the form', () => {
  it('leaves at once when nothing was typed', async () => {
    const screen = await openForm();

    await screen.tap(FORM.back, 1, FORM_SCREEN);

    expect(screen.onForm()).toBe(false);
    expect(screen.has('complete-work-discard-dialog')).toBe(false);
    expect(screen.heading()).toContain(status(JOB.statusInProgress));
  });

  it('asks before leaving with something typed — from the Back control', async () => {
    const completeRequest = jest.spyOn(requests, 'completeRequest');
    const screen = await openForm();
    await fill(screen, { amount: '1250' });

    await screen.tap(FORM.back, 1, FORM_SCREEN);
    expect(screen.onForm()).toBe(true);
    expect(screen.pressables(FORM.discardKeep)).toHaveLength(1);

    await screen.tap(FORM.discardKeep);
    expect(screen.onForm()).toBe(true);
    expect(screen.field('complete-work-amount').props.value).toBe('1250');

    await screen.tap(FORM.back, 1, FORM_SCREEN);
    await screen.tap(FORM.discardConfirm);
    expect(screen.onForm()).toBe(false);
    expect(completeRequest).not.toHaveBeenCalled();
    expect(screen.heading()).toContain(status(JOB.statusInProgress));
  });

  it('asks before leaving with something typed — from Android back', async () => {
    const screen = await openForm();
    await fill(screen, { status: 'UNPAID' });

    await screen.hardwareBack();
    expect(screen.onForm()).toBe(true);
    expect(screen.pressables(FORM.discardConfirm)).toHaveLength(1);

    await screen.tap(FORM.discardConfirm);
    expect(screen.onForm()).toBe(false);
  });
});

describe('What finished work shows', () => {
  it('shows a job paid by UPI with its note, and says it is the vendor’s record', async () => {
    const screen = await render();
    await screen.tap('Requests');
    await screen.tap(VENDOR_COPY.requests.filterCompleted);
    const [card] = screen.renderer.root.findAll(
      node =>
        node.props?.testID === `vendor-request-${PAID_BY_UPI}` &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    );
    await act(async () => {
      card.props.onPress();
    });
    await screen.flush();

    expect(screen.text('vendor-request-payment-amount')).toContain('₹1,850');
    expect(screen.text('vendor-request-payment-status')).toContain('Paid · UPI');
    expect(screen.has('vendor-request-payment-notes')).toBe(true);
    expect(screen.text('vendor-request-payment-recorded')).toContain(PAYMENT.recorded);
    // One phrase each for a screen reader.
    const [amountRow] = screen.renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.testID === 'vendor-request-payment-amount',
    );
    expect(amountRow.props.accessibilityLabel).toBe(`${PAYMENT.amountLabel}, ₹1,850`);
  });

  it('shows a job not paid yet with no method and no notes', async () => {
    const screen = await render();
    await screen.tap('Requests');
    await screen.tap(VENDOR_COPY.requests.filterCompleted);
    const [card] = screen.renderer.root.findAll(
      node =>
        node.props?.testID === `vendor-request-${NOT_PAID_YET}` &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    );
    await act(async () => {
      card.props.onPress();
    });
    await screen.flush();

    expect(screen.text('vendor-request-payment-status')).toContain('Not paid yet');
    expect(screen.text('vendor-request-payment-status')).not.toContain('·');
    expect(screen.has('vendor-request-payment-notes')).toBe(false);
  });

  it('says nothing about payment on finished work with no record', async () => {
    const screen = await render();
    await screen.tap('Requests');
    await screen.tap(VENDOR_COPY.requests.filterCompleted);
    const [card] = screen.renderer.root.findAll(
      node =>
        node.props?.testID === `vendor-request-${NO_RECORD}` &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    );
    await act(async () => {
      card.props.onPress();
    });
    await screen.flush();

    expect(screen.has(DETAILS_SCREEN)).toBe(true);
    expect(screen.has('vendor-request-payment')).toBe(false);
  });

  it('shows no payment on work under way — even if the record carries one', async () => {
    const read = requests.getRequest.bind(requests);
    jest.spyOn(requests, 'getRequest').mockImplementation(async id => ({
      ...(await read(id)),
      completion: { finalAmountMinor: 100, currency: 'INR', paymentStatus: 'PAID', paymentMethodLabel: 'Cash' },
    }));
    const screen = await render();
    await screen.open(IN_PROGRESS.id);

    expect(screen.heading()).toContain(status(JOB.statusInProgress));
    expect(screen.has('vendor-request-payment')).toBe(false);
    expect(screen.onForm()).toBe(false);
    // Still the step it is ready for. (The button and the pressable inside it both answer to the name.)
    expect(screen.pressables(markCompleted, DETAILS_SCREEN).length).toBeGreaterThan(0);
  });
});

describe('Recorded, never processed', () => {
  it('never says a payment was processed — on the form, the confirmation, or the record', async () => {
    const screen = await openForm();
    await fill(screen, { amount: '1250', status: 'PAID', method: 'upi', notes: 'Done.' });
    const onForm = screen.everything();
    await submit(screen);
    const onDialog = screen.everything();
    await screen.tap(WORK.completeConfirm);
    const onRecord = screen.everything();

    for (const drawn of [onForm, onDialog, onRecord]) {
      expect(drawn.toLowerCase()).not.toContain('processed');
      expect(drawn).not.toContain('through Fixora');
      expect(drawn).not.toContain('paid to Fixora');
    }
    const copy = JSON.stringify([FORM, PAYMENT, WORK]).toLowerCase();
    expect(copy).not.toContain('processed');
  });
});

describe('Payload discipline', () => {
  it('sends the reference and the record only — no display data', async () => {
    const completeRequest = jest.spyOn(requests, 'completeRequest');
    const screen = await openForm();
    await fill(screen, { amount: '1250', status: 'PAID', method: 'bank_transfer' });
    await submit(screen);
    await screen.tap(WORK.completeConfirm);

    const wire = JSON.stringify(completeRequest.mock.calls[0]);
    expect(wire).not.toContain(IN_PROGRESS.service);
    expect(wire).not.toContain('Bank transfer');
    expect(wire).not.toContain('₹');
    const completion: VendorCompletionInput = completeRequest.mock.calls[0][1];
    expect(completion.paymentMethodId).toBe('bank_transfer');
  });
});

/**
 * Section 54's `work_completed`, from the form: once, when the service
 * recorded the completion, with whether the customer paid and nothing else of
 * what was typed — and the request is still viewed once, though the details
 * read it again on the way back.
 */
describe('What analytics is told (section 54)', () => {
  let track: jest.Mock;

  beforeEach(() => {
    track = jest.fn();
    registerService('analytics', { track, identify: jest.fn() });
  });

  const events = () => track.mock.calls.map(call => call[0] as string);
  const sent = (event: string) =>
    track.mock.calls.filter(call => call[0] === event).map(call => call[1]);

  it('counts a job not paid yet as completed and unpaid — and nothing typed on the form', async () => {
    const screen = await openForm();
    await fill(screen, { amount: '1250.50', status: 'UNPAID', notes: 'Fitted the inverter.' });

    await submit(screen);
    await screen.tap(WORK.completeConfirm);

    expect(screen.heading()).toContain(status(JOB.statusCompleted));
    expect(events()).toEqual(['request_viewed', 'work_completed']);
    const [properties] = sent('work_completed');
    expect(Object.keys(properties).sort()).toEqual(['paymentStatus', 'requestId']);
    expect(properties).toEqual({ requestId: IN_PROGRESS.id, paymentStatus: 'UNPAID' });

    const serialised = JSON.stringify(track.mock.calls);
    for (const value of [
      '1250',
      '125050',
      'INR',
      'Fitted the inverter',
      'Imran Sheikh',
      'BTM Layout',
      IN_PROGRESS.service,
    ]) {
      expect(serialised).not.toContain(value);
    }
  });

  it('counts nothing for a completion that failed, and one for the retry that worked', async () => {
    jest.spyOn(requests, 'completeRequest').mockRejectedValueOnce(offline());
    const screen = await openForm();
    await fill(screen, { amount: '1250', status: 'PAID', method: 'card' });

    await submit(screen);
    await screen.tap(WORK.completeConfirm);
    expect(screen.onForm()).toBe(true);
    expect(sent('work_completed')).toEqual([]);

    await submit(screen);
    await screen.tap(WORK.completeConfirm);
    expect(sent('work_completed')).toStrictEqual([{ requestId: IN_PROGRESS.id, paymentStatus: 'PAID' }]);
  });

  it('counts nothing when the job was completed elsewhere first', async () => {
    const screen = await openForm();
    await fill(screen, { amount: '999', status: 'PAID', method: 'cash' });

    await raviElsewhere.completeRequest(IN_PROGRESS.id, {
      finalAmountMinor: 200_000,
      currency: 'INR',
      paymentStatus: 'UNPAID',
    });
    await submit(screen);
    await screen.tap(WORK.completeConfirm);

    expect(screen.toast()).toBe(WORK.changed);
    expect(events()).toEqual(['request_viewed']);
  });
});
