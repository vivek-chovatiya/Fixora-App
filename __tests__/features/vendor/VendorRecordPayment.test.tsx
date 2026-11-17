/**
 * Recording a payment after the job, on screen (owner decision, 21/10/2026:
 * "Not paid yet" may later become "Paid", only that way, and once paid it is
 * final; PROJECT_BIBLE.md section 37, the offline payment record), through the
 * real VendorNavigator and the real mock services sharing one record of what
 * vendors did.
 *
 * Pinned here:
 *
 * - "Record payment" is offered on a finished job's Payment card only while it
 *   says "Not paid yet" — never on a paid record, a job without one, work
 *   under way, or a status the app cannot read
 * - it opens the form with the reference and nothing else on the route
 * - nothing is preselected; pressing the button with no method says so beside
 *   the field and sends nothing
 * - the methods are the service's; their failure is said beside the field,
 *   with Try again
 * - chosen and pressed → asked once more, naming the method ("Mark as paid by
 *   UPI?", "This can't be changed later."), and nothing is sent until "Mark as
 *   paid"; Cancel sends nothing and keeps the choice (lead decision, 21/10/2026)
 * - confirmed → one call with exactly `{ paymentStatus: 'PAID',
 *   paymentMethodId }`, then back on the request, read again: "Paid · UPI",
 *   and no "Record payment" any more; the dashboard is told the work changed
 * - five confirms send one call; the confirm is busy meanwhile
 * - a failure says the failure's own words (never the developer's), keeps the
 *   chosen method, and the button is the retry
 * - nothing left to record (it changed elsewhere) is said calmly, and the form
 *   is left
 * - leaving with a method chosen asks first — the Back control and Android
 *   back; leaving untouched asks nothing
 * - no analytics event is sent for it (section 54 lists none)
 * - no word says Fixora processed a payment
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
  VendorPaymentResult,
} from '@/shared/services/types/VendorRequestService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const FORM = VENDOR_COPY.recordPaymentForm;
const METHOD = VENDOR_COPY.completeForm;
const WORK = VENDOR_COPY.work;
const PAYMENT = VENDOR_COPY.payment;
const VALIDATION = VENDOR_COPY.validation;

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

/** In the fixtures: finished and not paid yet; paid by UPI; finished with no record; in progress. */
const NOT_PAID_YET = 'REQ-30833';
const PAID_BY_UPI = 'REQ-30912';
const NO_RECORD = 'REQ-30876';
const IN_PROGRESS = 'REQ-30954';

const DETAILS_SCREEN = 'vendor-request-details';
const FORM_SCREEN = 'record-payment';
const CONFIRM_DIALOG = 'record-payment-confirm-dialog';

let book: MockVendorRequestBook;
let requests: MockVendorRequestService;
let dashboard: MockVendorDashboardService;
let track: jest.Mock;
let consoleError: jest.SpyInstance;

beforeEach(async () => {
  resetServices();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  book = new MockVendorRequestBook();
  const scenarios: Record<string, MockDashboardScenario> = { [RAVI.id]: 'mixed' };
  const scenarioFor = (vendorId: string) => scenarios[vendorId] ?? 'empty';
  const currentUser = async () => RAVI;

  const profiles = new MockVendorProfileService({ latency: NO_LATENCY, currentUser });
  requests = new MockVendorRequestService({ latency: NO_LATENCY, currentUser, scenarioFor, book });
  track = jest.fn();
  registerService('analytics', { track, identify: jest.fn() });
  registerService('vendorProfile', profiles);
  registerService('vendorRequests', requests);
  dashboard = new MockVendorDashboardService({ latency: NO_LATENCY, currentUser, scenarioFor, book });
  registerService('vendorDashboard', dashboard);
  registerService('category', {
    listServiceCategories: jest.fn(async () => [{ id: 'cat_electrician', name: 'Electrician' }]),
    listSubCategories: jest.fn(async () => []),
  } as CategoryService);

  setSessionStorage({
    read: async () => ({ token: 'token', user: RAVI }),
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

/** The vendor app, opened straight onto one request's details. */
async function openDetails(requestId: string) {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user: RAVI }));
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
  await act(async () => {
    navigation.navigate('VendorRequestDetails', { requestId });
  });
  await flush();

  const hosts = (id: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id);
  const has = (id: string) => hosts(id).length > 0;

  /*
    Within one screen when asked: the form's button and the details' entry to
    it are both "Record payment", and the details stay mounted beneath.
  */
  const pressables = (label: string, within?: string) =>
    (within ? hosts(within)[0] ?? renderer.root : renderer.root)
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

  const pressId = async (id: string) => {
    const [target] = renderer.root.findAll(
      node => node.props?.testID === id && typeof node.props?.onPress === 'function',
    );
    if (!target) {
      throw new Error(`Nothing pressable with id "${id}"`);
    }
    await act(async () => {
      target.props.onPress();
    });
    await flush();
  };

  return {
    navigation,
    has,
    tap,
    pressId,
    pressables,
    text: (id: string) => (has(id) ? textOf(hosts(id)[0]) : ''),
    onForm: () => has(FORM_SCREEN),
    /** Everything drawn or spoken, as text — for what must never be said. */
    everything: () =>
      [
        textOf(renderer.root),
        ...renderer.root
          .findAll(node => typeof node.type === 'string')
          .flatMap(node => [node.props?.accessibilityLabel, node.props?.accessibilityHint])
          .filter((value): value is string => typeof value === 'string'),
      ].join('\n'),
    checked: (id: string) =>
      renderer.root.findAll(
        node => node.props?.testID === id && node.props?.accessibilityRole === 'radio',
      )[0]?.props.accessibilityState?.checked === true,
    busy: (label: string, within: string) =>
      (hosts(within)[0] ?? renderer.root).findAll(
        node => node.props?.accessibilityLabel === label && node.props?.accessibilityState?.busy === true,
      ).length > 0,
    toast: (): string | undefined =>
      renderer.root.findAll(
        node => node.props?.accessibilityHint === 'Dismisses this message' && typeof node.props.onPress === 'function',
      )[0]?.props.accessibilityLabel,
    hardwareBack: async () => {
      await act(async () => {
        navigation.dispatch(CommonActions.goBack());
      });
      await flush();
    },
  };
}

type Screen = Awaited<ReturnType<typeof openDetails>>;

/** "Record payment" on the form, then "Mark as paid" in the question it asks. */
async function recordAndConfirm(screen: Screen, confirms = 1) {
  await screen.tap(FORM.submit, 1, FORM_SCREEN);
  await screen.tap(FORM.confirmConfirm, confirms);
}

/** The details of the unpaid job, then its record-payment form. */
async function openForm(): Promise<Screen> {
  const screen = await openDetails(NOT_PAID_YET);
  await screen.tap(PAYMENT.recordPayment);
  expect(screen.onForm()).toBe(true);
  return screen;
}

describe('Where "Record payment" is offered', () => {
  it('is on a finished job recorded "Not paid yet", with a hint saying it opens a form', async () => {
    const screen = await openDetails(NOT_PAID_YET);

    expect(screen.text('vendor-request-payment-status')).toContain('Not paid yet');
    const [button] = screen.pressables(PAYMENT.recordPayment);
    expect(button).toBeDefined();
    expect(button.props.accessibilityHint).toBe(PAYMENT.recordPaymentHint);
  });

  it.each([
    ['a paid record — paid is final', PAID_BY_UPI],
    ['a finished job with no record', NO_RECORD],
    ['work still in progress', IN_PROGRESS],
  ])('is not on %s', async (_name, reference) => {
    const screen = await openDetails(reference);

    expect(screen.has(DETAILS_SCREEN)).toBe(true);
    expect(screen.pressables(PAYMENT.recordPayment)).toHaveLength(0);
  });

  it('is not on a record whose status the app cannot read', async () => {
    jest.spyOn(requests, 'getRequest').mockResolvedValue({
      ...(await requests.getRequest(NOT_PAID_YET)),
      completion: { finalAmountMinor: 65_000, currency: 'INR', paymentStatus: 'PARTLY_PAID' },
    });
    const screen = await openDetails(NOT_PAID_YET);

    expect(screen.has('vendor-request-payment')).toBe(true);
    expect(screen.pressables(PAYMENT.recordPayment)).toHaveLength(0);
  });

  it('opens the form with the reference and nothing else on the route', async () => {
    const screen = await openForm();

    const route = screen.navigation.getCurrentRoute();
    expect(route?.name).toBe('RecordPayment');
    expect(route?.params).toStrictEqual({ requestId: NOT_PAID_YET });
    expect(screen.text('record-payment-reference')).toContain(NOT_PAID_YET);
    expect(screen.text('record-payment-subtitle')).toBe(FORM.subtitle);
  });
});

describe('The form', () => {
  it('preselects nothing, and with no method chosen says so beside the field and sends nothing', async () => {
    const recordPayment = jest.spyOn(requests, 'recordPayment');
    const screen = await openForm();

    expect(screen.checked('record-payment-method-cash')).toBe(false);
    expect(screen.checked('record-payment-method-upi')).toBe(false);

    await screen.tap(FORM.submit, 1, FORM_SCREEN);

    expect(recordPayment).not.toHaveBeenCalled();
    expect(screen.text('record-payment-method-error')).toBe(VALIDATION.paymentMethodRequired);
    expect(screen.text('record-payment-fix-errors')).toBe(FORM.fixErrors);
    expect(screen.onForm()).toBe(true);
  });

  it('offers the service’s methods, and says beside the field when they fail, with Try again', async () => {
    const listPaymentMethods = jest
      .spyOn(requests, 'listPaymentMethods')
      .mockRejectedValueOnce(new AppError({ kind: 'network', message: 'socket hang up' }));
    const screen = await openForm();

    expect(screen.text('record-payment-methods-error')).toContain(METHOD.methodsFailed);
    expect(screen.everything()).not.toContain('socket hang up');

    await screen.tap(METHOD.methodsRetry);

    expect(listPaymentMethods).toHaveBeenCalledTimes(2);
    expect(screen.has('record-payment-method-upi')).toBe(true);
  });
});

describe('Recording', () => {
  it('sends exactly the paid status and the method, then shows the request paid', async () => {
    const recordPayment = jest.spyOn(requests, 'recordPayment');
    const getDashboard = jest.spyOn(dashboard, 'getDashboard');
    const screen = await openForm();
    const dashboardReadsBefore = getDashboard.mock.calls.length;

    await screen.pressId('record-payment-method-upi');
    expect(screen.checked('record-payment-method-upi')).toBe(true);
    await recordAndConfirm(screen);

    expect(recordPayment).toHaveBeenCalledTimes(1);
    const [reference, payment] = recordPayment.mock.calls[0];
    expect(reference).toBe(NOT_PAID_YET);
    expect(Object.keys(payment).sort()).toEqual(['paymentMethodId', 'paymentStatus']);
    expect(payment).toStrictEqual({ paymentStatus: 'PAID', paymentMethodId: 'upi' });

    // Back on the request, read again: paid, and nothing more to record.
    expect(screen.onForm()).toBe(false);
    expect(screen.text('vendor-request-payment-status')).toContain('Paid · UPI');
    expect(screen.pressables(PAYMENT.recordPayment)).toHaveLength(0);
    // The amount is the one recorded at completion.
    expect(screen.text('vendor-request-payment-amount')).toContain('650');
    expect(screen.toast()).toBe(WORK.paymentRecorded);
    // The dashboard beneath was told the work changed, and read it again.
    expect(getDashboard.mock.calls.length).toBeGreaterThan(dashboardReadsBefore);
  });

  it('sends one call for five confirms, and the confirm is busy while it is out', async () => {
    const call = held<VendorPaymentResult>();
    const recordPayment = jest.spyOn(requests, 'recordPayment').mockImplementationOnce(() => call.promise);
    const screen = await openForm();

    await screen.pressId('record-payment-method-cash');
    await recordAndConfirm(screen, 5);

    expect(recordPayment).toHaveBeenCalledTimes(1);
    expect(screen.busy(FORM.confirmConfirm, CONFIRM_DIALOG)).toBe(true);
    expect(screen.has(CONFIRM_DIALOG)).toBe(true);

    await act(async () => {
      call.land({ outcome: 'recorded', request: await requests.getRequest(NOT_PAID_YET) });
    });
    await flush();

    expect(screen.onForm()).toBe(false);
  });

  it('keeps the chosen method on a failure, says the failure’s own words, and the button is the retry', async () => {
    const failure = new AppError({ kind: 'network', message: 'ECONNRESET at socket 7' });
    const recordPayment = jest.spyOn(requests, 'recordPayment').mockRejectedValueOnce(failure);
    const screen = await openForm();

    await screen.pressId('record-payment-method-card');
    await recordAndConfirm(screen);

    expect(screen.onForm()).toBe(true);
    // The question closes; the choice it asked about does not go with it.
    expect(screen.has(CONFIRM_DIALOG)).toBe(false);
    expect(screen.checked('record-payment-method-card')).toBe(true);
    expect(screen.toast()).toBe(`${WORK.recordPaymentFailed} ${failure.userMessage}`);
    expect(screen.everything()).not.toContain('ECONNRESET');

    await recordAndConfirm(screen);

    expect(recordPayment).toHaveBeenCalledTimes(2);
    expect(recordPayment.mock.calls[1][1]).toStrictEqual({ paymentStatus: 'PAID', paymentMethodId: 'card' });
    expect(screen.onForm()).toBe(false);
    expect(screen.text('vendor-request-payment-status')).toContain('Paid · Card');
  });

  it('says calmly when there is nothing left to record, and leaves the form', async () => {
    jest
      .spyOn(requests, 'recordPayment')
      .mockResolvedValueOnce({ outcome: 'refused', reason: 'invalidTransition' });
    const screen = await openForm();

    await screen.pressId('record-payment-method-cash');
    await recordAndConfirm(screen);

    expect(screen.toast()).toBe(WORK.changed);
    expect(screen.onForm()).toBe(false);
    expect(screen.has(DETAILS_SCREEN)).toBe(true);
  });

  it('sends no analytics event for it — section 54 names none', async () => {
    const screen = await openForm();
    track.mockClear();

    await screen.pressId('record-payment-method-upi');
    await recordAndConfirm(screen);

    expect(screen.onForm()).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });
});

describe('Asked once more (lead decision, 21/10/2026)', () => {
  it('sends nothing on "Record payment" — it asks, naming the method, and says it cannot be changed', async () => {
    const recordPayment = jest.spyOn(requests, 'recordPayment');
    const screen = await openForm();

    await screen.pressId('record-payment-method-upi');
    await screen.tap(FORM.submit, 1, FORM_SCREEN);

    expect(recordPayment).not.toHaveBeenCalled();
    expect(FORM.confirmTitle('UPI')).toBe('Mark as paid by UPI?');
    expect(screen.text(CONFIRM_DIALOG)).toContain(FORM.confirmTitle('UPI'));
    expect(screen.text(CONFIRM_DIALOG)).toContain(FORM.confirmMessage);
    // Named by the service's word for it, never its id.
    expect(screen.text(CONFIRM_DIALOG)).not.toContain('upi');
  });

  it('sends nothing on Cancel, closes the question and keeps the choice', async () => {
    const recordPayment = jest.spyOn(requests, 'recordPayment');
    const screen = await openForm();

    await screen.pressId('record-payment-method-bank_transfer');
    await screen.tap(FORM.submit, 1, FORM_SCREEN);
    await screen.tap(FORM.confirmCancel);

    expect(recordPayment).not.toHaveBeenCalled();
    expect(screen.has(CONFIRM_DIALOG)).toBe(false);
    expect(screen.onForm()).toBe(true);
    expect(screen.checked('record-payment-method-bank_transfer')).toBe(true);
  });

  it('sends one call on "Mark as paid", and still one for a double tap', async () => {
    const recordPayment = jest.spyOn(requests, 'recordPayment');
    const screen = await openForm();

    await screen.pressId('record-payment-method-upi');
    await recordAndConfirm(screen, 2);

    expect(recordPayment).toHaveBeenCalledTimes(1);
    expect(recordPayment.mock.calls[0][1]).toStrictEqual({ paymentStatus: 'PAID', paymentMethodId: 'upi' });
    expect(screen.onForm()).toBe(false);
  });
});

describe('Leaving the form', () => {
  it('asks first when a method is chosen — Keep editing stays, Discard leaves and sends nothing', async () => {
    const recordPayment = jest.spyOn(requests, 'recordPayment');
    const screen = await openForm();
    await screen.pressId('record-payment-method-cash');

    await screen.tap(FORM.back);
    expect(screen.has('record-payment-discard-dialog')).toBe(true);
    expect(screen.text('record-payment-discard-dialog')).toContain(FORM.discardTitle);

    await screen.tap(FORM.discardKeep);
    expect(screen.onForm()).toBe(true);
    expect(screen.checked('record-payment-method-cash')).toBe(true);

    await screen.hardwareBack();
    expect(screen.has('record-payment-discard-dialog')).toBe(true);
    await screen.tap(FORM.discardConfirm);

    expect(screen.onForm()).toBe(false);
    expect(recordPayment).not.toHaveBeenCalled();
  });

  it('leaves an untouched form without asking', async () => {
    const screen = await openForm();

    await screen.tap(FORM.back);

    expect(screen.onForm()).toBe(false);
    expect(screen.has(DETAILS_SCREEN)).toBe(true);
  });
});

describe('What is never said', () => {
  it('says nowhere that Fixora took, received or processed a payment', async () => {
    const screen = await openForm();
    await screen.pressId('record-payment-method-upi');

    const everything = screen.everything();
    expect(everything).toContain('Fixora does not process payments');
    expect(everything).not.toMatch(/Fixora (has )?(processed|received|took|confirmed)/i);
    expect(everything).not.toMatch(/payment processed/i);
  });

  it('offers the methods the service lists, and no other', async () => {
    const methods: PaymentMethodOption[] = [{ id: 'cheque', label: 'Cheque' }];
    jest.spyOn(requests, 'listPaymentMethods').mockResolvedValueOnce(methods);
    const screen = await openForm();

    expect(screen.has('record-payment-method-cheque')).toBe(true);
    expect(screen.has('record-payment-method-cash')).toBe(false);
  });
});
