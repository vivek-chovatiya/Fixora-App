/**
 * Starting and completing accepted work, on screen (PROJECT_BIBLE.md sections
 * 34 to 36, Phase 3E-5), through the real VendorNavigator and the real mock
 * services sharing one record of what vendors did.
 *
 * Pinned here:
 *
 * - accepted work offers Start work, work in progress Mark completed, finished
 *   work nothing — on its card and on its details
 * - Start acts at once; Mark completed opens the completion form (the final
 *   amount and payment, sections 36 and 37), which asks before sending, and
 *   Cancel changes nothing — the form itself is pinned in
 *   `VendorCompleteWork.test.tsx`
 * - a step moves the request only when the service confirms it: started stays
 *   in Active as In progress, completed goes to the top of Completed, and the
 *   vendor stays where they are
 * - a failure leaves the job exactly as it was, ready to try again
 * - a job that moved on elsewhere is said calmly and shown as it really is
 * - five quick taps send one step, and every action waits for the one in the
 *   air
 * - the step buttons act and open nothing; the card still opens the request
 * - a request goes all the way, waiting to completed, from the list and from
 *   its details
 * - the dashboard counts what the list and the details changed
 * - another vendor sees none of it
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { AuthUser } from '@/features/auth/types';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
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
import type { VendorWorkStepResult } from '@/shared/services/types/VendorRequestService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const WORK = VENDOR_COPY.work;
const FORM = VENDOR_COPY.completeForm;
const ANSWER = VENDOR_COPY.answer;
const COPY = VENDOR_COPY.requests;
const DETAILS = VENDOR_COPY.requestDetails;
const JOB = VENDOR_COPY.job;
const DASHBOARD = VENDOR_COPY.dashboard;

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};
const MEENA: AuthUser = {
  id: 'usr_vendor_2',
  firstName: 'Meena',
  lastName: 'Iyer',
  phone: '9000000002',
  role: 'vendor',
};

/** In the fixtures: accepted, and in progress. */
const ACCEPTED = { id: 'REQ-30961', service: 'MCB replacement' };
const IN_PROGRESS = { id: 'REQ-30954', service: 'Inverter installation' };
/** Waiting, sent to Ravi directly. */
const DIRECTED = { id: 'REQ-31038', service: 'Ceiling fan installation' };
const OPEN = { id: 'REQ-31042', service: 'Switchboard repair' };
const FINISHED = { id: 'REQ-30912', service: 'Geyser wiring' };

const ref = (job: { id: string }) => `${JOB.referencePrefix} ${job.id}`;
const startLabel = (job: { id: string; service: string }) => WORK.startSpoken(job.service, ref(job));
const completeLabel = (job: { id: string; service: string }) => WORK.completeSpoken(job.service, ref(job));
const acceptLabel = (job: { id: string; service: string }) => ANSWER.acceptSpoken(job.service, ref(job));

const offline = () => new AppError({ kind: 'network', message: 'offline' });

const DETAILS_SCREEN = 'vendor-request-details';

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
  const scenarios: Record<string, MockDashboardScenario> = { [RAVI.id]: 'mixed', [MEENA.id]: 'openOnly' };
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
  current = MEENA;
  await profiles.saveProfile({ businessName: 'Iyer Electricals', serviceCategoryIds: ['cat_electrician'] });
  current = RAVI;
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
  const promise = new Promise<T>(resolve => (land = resolve));
  return { promise, land };
}

async function render() {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user: current }));

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <NavigationContainer>
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

  /*
    The list stays mounted under the details it opened, so a button on both is
    found twice; a details test looks on the details only.
  */
  const scope = (within?: string) => (within ? hosts(within)[0] ?? renderer.root : renderer.root);

  const buttons = (label: string, within?: string) =>
    scope(within).findAll(
      node =>
        node.props?.accessibilityLabel === label &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    );

  const tap = async (label: string, times = 1, within?: string) => {
    const [target] = buttons(label, within).length
      ? buttons(label, within)
      : renderer.root.findAll(
          node => node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function',
        );
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

  const list = () =>
    renderer.root.findAll(
      node => node.props?.testID === 'vendor-requests-list' && 'data' in (node.props ?? {}),
    )[0];

  type Line = { kind: string; group?: string; title?: string; count?: number; job?: { id: string; status: string } };
  const lines = (): Line[] => list().props.data;

  return {
    renderer,
    has,
    buttons,
    tap,
    flush,
    text: (id: string) => (has(id) ? textOf(hosts(id)[0]) : ''),
    groupOf: (id: string) => lines().find(line => line.kind === 'request' && line.job?.id === id)?.group,
    statusOf: (id: string) => lines().find(line => line.kind === 'request' && line.job?.id === id)?.job?.status,
    /** The references in one group, in order. */
    inGroup: (group: string) =>
      lines()
        .filter(line => line.kind === 'request' && line.group === group)
        .map(line => line.job?.id),
    headings: () =>
      lines()
        .filter(line => line.kind === 'heading')
        .map(line => `${line.title} ${line.count}`),
    /** Every work-step label on a button, as drawn. */
    workLabels: () =>
      [
        ...new Set(
          renderer.root
            .findAll(node => node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function')
            .map(node => String(node.props.accessibilityLabel ?? '')),
        ),
      ].filter(label => label.startsWith(`${WORK.start} on `) || label.startsWith(`${WORK.complete}: `)),
    disabled: (label: string, within?: string) => buttons(label, within)[0]?.props.disabled === true,
    busy: (label: string) =>
      renderer.root.findAll(
        node => node.props?.accessibilityLabel === label && node.props?.accessibilityState?.busy === true,
      ).length > 0,
    toast: (): string | undefined =>
      renderer.root.findAll(
        node => node.props?.accessibilityHint === 'Dismisses this message' && typeof node.props.onPress === 'function',
      )[0]?.props.accessibilityLabel,
    labelled: (label: string) => renderer.root.findAll(node => node.props?.accessibilityLabel === label),
    /**
     * On the completion form: an amount, paid by cash, then "Complete work" —
     * which opens the confirmation; the test confirms or cancels it.
     */
    fillCompletion: async () => {
      const [amount] = renderer.root.findAll(
        node => node.props?.testID === 'complete-work-amount' && typeof node.props?.onChangeText === 'function',
      );
      await act(async () => {
        amount.props.onChangeText('1250');
      });
      for (const id of ['complete-work-status-PAID', 'complete-work-method-cash']) {
        const [chip] = renderer.root.findAll(
          node => node.props?.testID === id && typeof node.props?.onPress === 'function',
        );
        await act(async () => {
          chip.props.onPress();
        });
      }
      await flush();
      await tap(FORM.submit);
    },
    openCard: async (id: string) => {
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
    heading: () =>
      renderer.root.findAll(
        node => typeof node.type === 'string' && node.props?.testID === 'vendor-request-heading',
      )[0]?.props.accessibilityLabel as string | undefined,
    switchTo: async (user: AuthUser) => {
      current = user;
      await act(async () => {
        store.dispatch(signedIn({ token: 'token', user }));
      });
      await flush();
    },
  };
}

async function renderRequests(filter?: string) {
  const screen = await render();
  await screen.tap('Requests');
  if (filter) {
    await screen.tap(filter);
  }
  return screen;
}

const status = (label: string) => `${DETAILS.statusLabel}: ${label}`;

describe('Work steps on the list — what is offered', () => {
  it('offers Start work on accepted work and Mark completed on work in progress, and nothing on finished work', async () => {
    const screen = await renderRequests(COPY.filterActive);

    expect(new Set(screen.workLabels())).toEqual(new Set([completeLabel(IN_PROGRESS), startLabel(ACCEPTED)]));
    expect(screen.buttons(startLabel(ACCEPTED))[0].props.accessibilityHint).toBe(WORK.startHint);
    expect(screen.buttons(completeLabel(IN_PROGRESS))[0].props.accessibilityHint).toBe(WORK.completeHint);

    await screen.tap(COPY.filterCompleted);
    expect(screen.workLabels()).toEqual([]);

    await screen.tap(COPY.filterPending);
    expect(screen.workLabels()).toEqual([]);
  });
});

describe('Work steps on the list — start', () => {
  it('starts at once: the card says In progress, offers Mark completed, and the vendor stays', async () => {
    const startRequest = jest.spyOn(requests, 'startRequest');
    const screen = await renderRequests(COPY.filterActive);

    await screen.tap(startLabel(ACCEPTED));

    expect(startRequest).toHaveBeenCalledTimes(1);
    expect(startRequest).toHaveBeenCalledWith(ACCEPTED.id);
    expect(screen.statusOf(ACCEPTED.id)).toBe('IN_PROGRESS');
    expect(screen.groupOf(ACCEPTED.id)).toBe('active');
    expect(screen.workLabels()).toContain(completeLabel(ACCEPTED));
    expect(screen.workLabels()).not.toContain(startLabel(ACCEPTED));
    expect(screen.toast()).toBe(WORK.started);
    expect(screen.has('vendor-request-details')).toBe(false);
  });

  it('changes the card at once, without waiting for the list to be read again', async () => {
    const screen = await renderRequests(COPY.filterActive);
    const reread = held<Awaited<ReturnType<MockVendorRequestService['listRequests']>>>();
    jest.spyOn(requests, 'listRequests').mockReturnValueOnce(reread.promise);

    await screen.tap(startLabel(ACCEPTED));

    expect(screen.statusOf(ACCEPTED.id)).toBe('IN_PROGRESS');
    expect(screen.workLabels()).not.toContain(startLabel(ACCEPTED));
  });

  it('keeps the job as it was when starting fails, and can try again', async () => {
    jest.spyOn(requests, 'startRequest').mockRejectedValueOnce(offline());
    const screen = await renderRequests(COPY.filterActive);

    await screen.tap(startLabel(ACCEPTED));

    expect(screen.statusOf(ACCEPTED.id)).toBe('ACCEPTED');
    expect(screen.toast()).toBe(`${WORK.startFailed} ${offline().userMessage}`);
    expect(screen.disabled(startLabel(ACCEPTED))).toBe(false);

    await screen.tap(startLabel(ACCEPTED));
    expect(screen.statusOf(ACCEPTED.id)).toBe('IN_PROGRESS');
  });

  it('sends one start for five quick taps', async () => {
    const startRequest = jest.spyOn(requests, 'startRequest');
    const screen = await renderRequests(COPY.filterActive);

    await screen.tap(startLabel(ACCEPTED), 5);

    expect(startRequest).toHaveBeenCalledTimes(1);
    expect(screen.statusOf(ACCEPTED.id)).toBe('IN_PROGRESS');
  });

  it('holds every action on the list while a step is in the air, and shows which', async () => {
    const call = held<VendorWorkStepResult<'started'>>();
    const startRequest = jest.spyOn(requests, 'startRequest').mockReturnValueOnce(call.promise);
    const screen = await renderRequests();

    await screen.tap(startLabel(ACCEPTED));

    expect(screen.busy(startLabel(ACCEPTED))).toBe(true);
    expect(screen.disabled(completeLabel(IN_PROGRESS))).toBe(true);
    expect(screen.disabled(acceptLabel(OPEN))).toBe(true);
    await screen.tap(completeLabel(IN_PROGRESS));
    expect(screen.has('complete-work')).toBe(false);
    expect(startRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      call.land({ outcome: 'started', request: { ...(await requests.getRequest(ACCEPTED.id)), status: 'IN_PROGRESS' } });
    });
    await screen.flush();

    expect(screen.disabled(acceptLabel(OPEN))).toBe(false);
    expect(screen.disabled(completeLabel(IN_PROGRESS))).toBe(false);
  });

  it('says calmly when the job had already been started elsewhere, and shows it as it is', async () => {
    const list = jest.spyOn(requests, 'listRequests');
    const screen = await renderRequests(COPY.filterActive);
    const readsBefore = list.mock.calls.length;

    await raviElsewhere.startRequest(ACCEPTED.id);
    await screen.tap(startLabel(ACCEPTED));

    expect(screen.toast()).toBe(WORK.changed);
    expect(list.mock.calls.length).toBeGreaterThan(readsBefore);
    expect(screen.statusOf(ACCEPTED.id)).toBe('IN_PROGRESS');
    expect(screen.workLabels()).toContain(completeLabel(ACCEPTED));
    expect(screen.workLabels()).not.toContain(startLabel(ACCEPTED));
  });
});

describe('Work steps on the list — complete', () => {
  it('opens the completion form, which asks first, and Cancel changes nothing', async () => {
    const completeRequest = jest.spyOn(requests, 'completeRequest');
    const screen = await renderRequests(COPY.filterActive);

    await screen.tap(completeLabel(IN_PROGRESS));
    expect(screen.has('complete-work')).toBe(true);
    expect(screen.has('vendor-request-details')).toBe(false);

    await screen.fillCompletion();
    expect(screen.has('vendor-complete-dialog')).toBe(true);
    expect(screen.labelled(WORK.completeTitle).length).toBeGreaterThan(0);
    expect(screen.text('vendor-complete-dialog')).toContain(WORK.completeMessage);

    await screen.tap(WORK.completeCancel);

    expect(screen.has('vendor-complete-dialog')).toBe(false);
    expect(screen.has('complete-work')).toBe(true);
    expect(completeRequest).not.toHaveBeenCalled();
    expect(screen.statusOf(IN_PROGRESS.id)).toBe('IN_PROGRESS');
  });

  it('completes once confirmed: back on the list, the job at the top of Completed with nothing left to press', async () => {
    const completeRequest = jest.spyOn(requests, 'completeRequest');
    const screen = await renderRequests();

    await screen.tap(completeLabel(IN_PROGRESS));
    await screen.fillCompletion();
    await screen.tap(WORK.completeConfirm);

    expect(completeRequest).toHaveBeenCalledTimes(1);
    expect(completeRequest).toHaveBeenCalledWith(IN_PROGRESS.id, {
      finalAmountMinor: 125_000,
      currency: 'INR',
      paymentStatus: 'PAID',
      paymentMethodId: 'cash',
    });
    expect(screen.has('vendor-complete-dialog')).toBe(false);
    expect(screen.has('complete-work')).toBe(false);
    expect(screen.groupOf(IN_PROGRESS.id)).toBe('completed');
    expect(screen.statusOf(IN_PROGRESS.id)).toBe('COMPLETED');
    expect(screen.inGroup('completed')[0]).toBe(IN_PROGRESS.id);
    expect(screen.headings()).toEqual([
      `${COPY.groupPending} 4`,
      `${COPY.groupActive} 1`,
      `${COPY.groupCompleted} 6`,
    ]);
    expect(screen.workLabels()).not.toContain(completeLabel(IN_PROGRESS));
    expect(screen.toast()).toBe(WORK.completed);
    expect(screen.has('vendor-request-details')).toBe(false);
    // Dated after its label in the sentence's own case (found on device).
    expect(screen.text(`vendor-request-${IN_PROGRESS.id}`)).toContain(`${JOB.completedLabel} ${JOB.justNow}`);
    expect(screen.text(`vendor-request-${IN_PROGRESS.id}`)).not.toContain('Just now');
  });

  it('sends one completion for five quick confirms, and keeps the dialog until the service answers', async () => {
    const call = held<VendorWorkStepResult<'completed'>>();
    const completeRequest = jest.spyOn(requests, 'completeRequest').mockReturnValueOnce(call.promise);
    const screen = await renderRequests(COPY.filterActive);

    await screen.tap(completeLabel(IN_PROGRESS));
    await screen.fillCompletion();
    await screen.tap(WORK.completeConfirm, 5);

    expect(completeRequest).toHaveBeenCalledTimes(1);
    expect(screen.has('vendor-complete-dialog')).toBe(true);
    expect(screen.busy(WORK.completeConfirm)).toBe(true);
    expect(screen.disabled(WORK.completeCancel)).toBe(true);

    await act(async () => {
      call.land({
        outcome: 'completed',
        request: { ...(await requests.getRequest(IN_PROGRESS.id)), status: 'COMPLETED' },
      });
    });
    await screen.flush();

    expect(screen.has('vendor-complete-dialog')).toBe(false);
    expect(screen.has('complete-work')).toBe(false);
  });

  it('keeps the job in progress when completing fails, and can try again from the form', async () => {
    jest.spyOn(requests, 'completeRequest').mockRejectedValueOnce(offline());
    const screen = await renderRequests(COPY.filterActive);

    await screen.tap(completeLabel(IN_PROGRESS));
    await screen.fillCompletion();
    await screen.tap(WORK.completeConfirm);

    expect(screen.has('vendor-complete-dialog')).toBe(false);
    expect(screen.has('complete-work')).toBe(true);
    expect(screen.statusOf(IN_PROGRESS.id)).toBe('IN_PROGRESS');
    expect(screen.toast()).toBe(`${WORK.completeFailed} ${offline().userMessage}`);

    await screen.tap(FORM.submit);
    await screen.tap(WORK.completeConfirm);
    expect(screen.has('complete-work')).toBe(false);
    expect(screen.groupOf(IN_PROGRESS.id)).toBeUndefined();
    // Under the Active filter it has gone; it is under Completed.
    await screen.tap(COPY.filterCompleted);
    expect(screen.groupOf(IN_PROGRESS.id)).toBe('completed');
  });
});

describe('Work steps on the list — the whole way, and the card still opens', () => {
  it('takes a waiting request to completed: Accept, Start work, Mark completed', async () => {
    const screen = await renderRequests();

    await screen.tap(acceptLabel(DIRECTED));
    expect(screen.groupOf(DIRECTED.id)).toBe('active');
    expect(screen.statusOf(DIRECTED.id)).toBe('ACCEPTED');

    await screen.tap(startLabel(DIRECTED));
    expect(screen.statusOf(DIRECTED.id)).toBe('IN_PROGRESS');

    await screen.tap(completeLabel(DIRECTED));
    await screen.fillCompletion();
    await screen.tap(WORK.completeConfirm);
    expect(screen.groupOf(DIRECTED.id)).toBe('completed');
    expect(screen.inGroup('completed')[0]).toBe(DIRECTED.id);
    expect(screen.workLabels().filter(label => label.includes(DIRECTED.id))).toEqual([]);
  });

  it('steps without opening the request, and opens it from the card', async () => {
    const screen = await renderRequests(COPY.filterActive);

    await screen.tap(startLabel(ACCEPTED));
    expect(screen.has('vendor-request-details')).toBe(false);

    // Mark completed opens the completion form — never the request.
    await screen.tap(completeLabel(IN_PROGRESS));
    expect(screen.has('vendor-request-details')).toBe(false);
    expect(screen.has('complete-work')).toBe(true);
    await screen.tap(FORM.back);
    expect(screen.has('complete-work')).toBe(false);

    await screen.openCard(ACCEPTED.id);
    expect(screen.has('vendor-request-details')).toBe(true);
  });
});

describe('Work steps on the details', () => {
  async function opened(id: string, filter?: string) {
    const screen = await renderRequests(filter);
    await screen.openCard(id);
    return screen;
  }

  it('offers Start work on accepted work, right under the heading', async () => {
    const screen = await opened(ACCEPTED.id, COPY.filterActive);

    expect(screen.has('vendor-request-work')).toBe(true);
    expect(screen.text('vendor-request-work')).toContain(WORK.promptStart);
    expect(screen.buttons(startLabel(ACCEPTED), DETAILS_SCREEN)).toHaveLength(1);
    expect(screen.has('vendor-request-answer')).toBe(false);
  });

  it('offers nothing on finished work', async () => {
    const screen = await opened(FINISHED.id, COPY.filterCompleted);

    expect(screen.heading()).toContain(status(JOB.statusCompleted));
    expect(screen.has('vendor-request-work')).toBe(false);
    expect(screen.has('vendor-request-answer')).toBe(false);
  });

  it('takes a request all the way and comes back to it: Accept → Start work → Mark completed', async () => {
    const screen = await opened(DIRECTED.id);

    await screen.tap(acceptLabel(DIRECTED), 1, DETAILS_SCREEN);
    expect(screen.heading()).toContain(status(JOB.statusAccepted));
    expect(screen.text('vendor-request-work')).toContain(WORK.promptStart);

    await screen.tap(startLabel(DIRECTED), 1, DETAILS_SCREEN);
    expect(screen.heading()).toContain(status(JOB.statusInProgress));
    expect(screen.toast()).toBe(WORK.started);
    expect(screen.text('vendor-request-work')).toContain(WORK.promptComplete);

    await screen.tap(completeLabel(DIRECTED), 1, DETAILS_SCREEN);
    expect(screen.has('complete-work')).toBe(true);
    await screen.fillCompletion();
    expect(screen.has('vendor-complete-dialog')).toBe(true);
    await screen.tap(WORK.completeConfirm);

    // Back on the details, read again: completed, with what was recorded.
    expect(screen.has('complete-work')).toBe(false);
    expect(screen.has('vendor-request-details')).toBe(true);
    expect(screen.heading()).toContain(status(JOB.statusCompleted));
    expect(screen.has('vendor-request-work')).toBe(false);
    expect(screen.has('vendor-request-completed')).toBe(true);
    expect(screen.has('vendor-request-payment')).toBe(true);
    expect(screen.toast()).toBe(WORK.completed);

    // The list underneath has caught up by the time the vendor goes back.
    await screen.tap(DETAILS.back);
    expect(screen.groupOf(DIRECTED.id)).toBe('completed');
  });

  it('asks before completing, from the form, and Cancel keeps the job in progress', async () => {
    const completeRequest = jest.spyOn(requests, 'completeRequest');
    const screen = await opened(IN_PROGRESS.id, COPY.filterActive);

    await screen.tap(completeLabel(IN_PROGRESS), 1, DETAILS_SCREEN);
    await screen.fillCompletion();
    expect(screen.has('vendor-complete-dialog')).toBe(true);

    await screen.tap(WORK.completeCancel);
    expect(screen.has('vendor-complete-dialog')).toBe(false);
    expect(completeRequest).not.toHaveBeenCalled();

    // Leaving the form — after the discard question, since something was typed.
    await screen.tap(FORM.back);
    await screen.tap(FORM.discardConfirm);
    expect(screen.has('complete-work')).toBe(false);
    expect(screen.heading()).toContain(status(JOB.statusInProgress));
  });

  it('keeps the job as it was when a step fails, and can try again', async () => {
    jest.spyOn(requests, 'startRequest').mockRejectedValueOnce(offline());
    const screen = await opened(ACCEPTED.id, COPY.filterActive);

    await screen.tap(startLabel(ACCEPTED), 1, DETAILS_SCREEN);

    expect(screen.heading()).toContain(status(JOB.statusAccepted));
    expect(screen.buttons(startLabel(ACCEPTED), DETAILS_SCREEN)).toHaveLength(1);
    expect(screen.toast()).toBe(`${WORK.startFailed} ${offline().userMessage}`);

    await screen.tap(startLabel(ACCEPTED), 1, DETAILS_SCREEN);
    expect(screen.heading()).toContain(status(JOB.statusInProgress));
  });

  it('says calmly when the job moved on elsewhere, and shows its latest status with the right step', async () => {
    const screen = await opened(ACCEPTED.id, COPY.filterActive);

    await raviElsewhere.startRequest(ACCEPTED.id);
    await screen.tap(startLabel(ACCEPTED), 1, DETAILS_SCREEN);

    expect(screen.toast()).toBe(WORK.changed);
    expect(screen.heading()).toContain(status(JOB.statusInProgress));
    expect(screen.buttons(startLabel(ACCEPTED), DETAILS_SCREEN)).toHaveLength(0);
    expect(screen.buttons(completeLabel(ACCEPTED), DETAILS_SCREEN)).toHaveLength(1);
  });

  it('sends one start for five quick taps', async () => {
    const startRequest = jest.spyOn(requests, 'startRequest');
    const screen = await opened(ACCEPTED.id, COPY.filterActive);

    await screen.tap(startLabel(ACCEPTED), 5, DETAILS_SCREEN);

    expect(startRequest).toHaveBeenCalledTimes(1);
  });
});

describe('The dashboard counts each step', () => {
  it('keeps started work active and counts completed work as completed, when the vendor comes back', async () => {
    const screen = await render();
    expect(screen.labelled(DASHBOARD.activeSpoken(2)).length).toBeGreaterThan(0);
    expect(screen.labelled(DASHBOARD.completedSpoken(5)).length).toBeGreaterThan(0);

    await screen.tap('Requests');
    await screen.tap(COPY.filterActive);
    await screen.tap(startLabel(ACCEPTED));
    await screen.tap('Dashboard');
    expect(screen.labelled(DASHBOARD.activeSpoken(2)).length).toBeGreaterThan(0);

    await screen.tap('Requests');
    await screen.tap(completeLabel(IN_PROGRESS));
    await screen.fillCompletion();
    await screen.tap(WORK.completeConfirm);
    await screen.tap('Dashboard');

    expect(screen.labelled(DASHBOARD.pendingSpoken(4)).length).toBeGreaterThan(0);
    expect(screen.labelled(DASHBOARD.activeSpoken(1)).length).toBeGreaterThan(0);
    expect(screen.labelled(DASHBOARD.completedSpoken(6)).length).toBeGreaterThan(0);
  });

  it('counts a step taken on the details screen too', async () => {
    const screen = await renderRequests(COPY.filterActive);
    await screen.openCard(IN_PROGRESS.id);
    await screen.tap(completeLabel(IN_PROGRESS), 1, DETAILS_SCREEN);
    await screen.fillCompletion();
    await screen.tap(WORK.completeConfirm);
    await screen.tap(DETAILS.back);
    await screen.tap('Dashboard');

    expect(screen.labelled(DASHBOARD.activeSpoken(1)).length).toBeGreaterThan(0);
    expect(screen.labelled(DASHBOARD.completedSpoken(6)).length).toBeGreaterThan(0);
  });
});

describe('Whose work', () => {
  it('shows another vendor none of this vendor’s work or its steps', async () => {
    const screen = await renderRequests(COPY.filterActive);
    await screen.tap(startLabel(ACCEPTED));

    await screen.switchTo(MEENA);
    await screen.tap('Requests');

    expect(screen.groupOf(ACCEPTED.id)).toBeUndefined();
    expect(screen.groupOf(IN_PROGRESS.id)).toBeUndefined();
    expect(screen.workLabels()).toEqual([]);

    // Her own work, from her own answer, goes through the same steps.
    await screen.tap(acceptLabel(OPEN));
    expect(screen.workLabels()).toEqual([startLabel(OPEN)]);
  });
});

/**
 * Section 54's work events on screen: each step counted once, from the
 * service's answer, with exactly its keys — and the read after a completion
 * made on the form is not a second viewing of the request.
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

  it('counts a request taken all the way on its details, each step once', async () => {
    const screen = await renderRequests();
    await screen.openCard(DIRECTED.id);

    await screen.tap(acceptLabel(DIRECTED), 1, DETAILS_SCREEN);
    await screen.tap(startLabel(DIRECTED), 1, DETAILS_SCREEN);
    await screen.tap(completeLabel(DIRECTED), 1, DETAILS_SCREEN);
    await screen.fillCompletion();
    await screen.tap(WORK.completeConfirm);
    // Back on the details, which read the request again.
    expect(screen.heading()).toContain(status(JOB.statusCompleted));

    expect(events()).toEqual([
      'request_viewed',
      'request_accepted',
      'work_started',
      'work_completed',
    ]);
    expect(sent('request_viewed')).toStrictEqual([{ requestId: DIRECTED.id, dispatch: 'directed' }]);
    expect(sent('request_accepted')).toStrictEqual([{ requestId: DIRECTED.id, dispatch: 'directed' }]);
    expect(sent('work_started')).toStrictEqual([{ requestId: DIRECTED.id }]);
    expect(sent('work_completed')).toStrictEqual([{ requestId: DIRECTED.id, paymentStatus: 'PAID' }]);

    // Not the amount, not the method, not the customer, not the job.
    const serialised = JSON.stringify(track.mock.calls);
    for (const value of ['1250', '125000', 'cash', 'Cash', 'Rahul Menon', DIRECTED.service]) {
      expect(serialised).not.toContain(value);
    }
  });

  it('counts work started from the list by its reference alone', async () => {
    const screen = await renderRequests(COPY.filterActive);

    await screen.tap(startLabel(ACCEPTED));

    expect(events()).toEqual(['work_started']);
    const [properties] = sent('work_started');
    expect(Object.keys(properties).sort()).toEqual(['requestId']);
    expect(properties).toEqual({ requestId: ACCEPTED.id });
  });

  it('counts nothing for a start that failed, and one for the retry that worked', async () => {
    jest.spyOn(requests, 'startRequest').mockRejectedValueOnce(offline());
    const screen = await renderRequests(COPY.filterActive);

    await screen.tap(startLabel(ACCEPTED));
    expect(track).not.toHaveBeenCalled();

    await screen.tap(startLabel(ACCEPTED));
    expect(events()).toEqual(['work_started']);
  });

  it('counts nothing for a start refused because the work had moved on elsewhere', async () => {
    const screen = await renderRequests(COPY.filterActive);

    await raviElsewhere.startRequest(ACCEPTED.id);
    await screen.tap(startLabel(ACCEPTED));

    expect(screen.toast()).toBe(WORK.changed);
    expect(track).not.toHaveBeenCalled();
  });
});
