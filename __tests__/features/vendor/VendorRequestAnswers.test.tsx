/**
 * Accepting and rejecting a waiting request, on screen (PROJECT_BIBLE.md
 * section 33, Phase 3E-4), through the real VendorNavigator and the real mock
 * services sharing one record of who answered what.
 *
 * Pinned here:
 *
 * - only a waiting request offers Accept and Reject — on its card and on its
 *   details — and work under way or done offers neither
 * - Accept answers at once; Reject asks first, and Cancel changes nothing
 * - an answer moves the request only when the service confirms it: accepted
 *   into Active, rejected out of the list, and the vendor stays where they are
 * - a failure leaves the request exactly as it was, ready to try again
 * - losing the race for an open request is said calmly, and the request goes
 * - five quick taps send one answer, and every answer waits for the one in the
 *   air
 * - the buttons answer and open nothing; the card still opens the request
 * - the dashboard counts what the list and the details changed
 * - another vendor sees only the open requests, and loses the one taken
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
import type { VendorRequestDecisionResult } from '@/shared/services/types/VendorRequestService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

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

/** Sent to everybody — Ravi and Meena both see it. */
const OPEN = { id: 'REQ-31042', service: 'Switchboard repair' };
const OPEN_LONG = {
  id: 'REQ-2026-BLR-EAST-0031021',
  service: 'Full house wiring inspection before tenancy handover',
};
/** The customer chose Ravi. */
const DIRECTED = { id: 'REQ-31038', service: 'Ceiling fan installation' };
/** Ravi's, with no word on how it reached him. */
const PLAIN = { id: 'REQ-30987', service: 'Light fitting replacement' };

const acceptLabel = (job: { id: string; service: string }) =>
  ANSWER.acceptSpoken(job.service, `${JOB.referencePrefix} ${job.id}`);
const rejectLabel = (job: { id: string; service: string }) =>
  ANSWER.rejectSpoken(job.service, `${JOB.referencePrefix} ${job.id}`);

const offline = () => new AppError({ kind: 'network', message: 'offline' });

const DETAILS_SCREEN = 'vendor-request-details';

let current: AuthUser;
let book: MockVendorRequestBook;
let requests: MockVendorRequestService;
/** Meena, answering from her own phone while Ravi's screen is open. */
let meenaElsewhere: MockVendorRequestService;
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
  meenaElsewhere = new MockVendorRequestService({
    latency: NO_LATENCY,
    currentUser: async () => MEENA,
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

/** A service call that stays in the air until the test lets it land. */
function held<T>() {
  let land!: (value: T) => void;
  const promise = new Promise<T>(resolve => (land = resolve));
  return { promise, land };
}

async function render({ open = true }: { open?: boolean } = {}) {
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

  /**
    Where to look. The list stays mounted under the details it opened, so a
    button on both is found twice; a details test looks on the details only.
  */
  const scope = (within?: string) =>
    within ? hosts(within)[0] ?? renderer.root : renderer.root;

  /** The pressable itself — the one that honours its own disabled state. */
  const buttons = (label: string, within?: string) =>
    scope(within).findAll(
      node =>
        node.props?.accessibilityLabel === label &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    );

  const tap = async (label: string, times = 1, within?: string) => {
    // The button itself where there is one; otherwise whatever answers to the name (a tab).
    const [target] = buttons(label, within).length
      ? buttons(label, within)
      : renderer.root.findAll(
          node => node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function',
        );
    if (!target) {
      throw new Error(`Nothing pressable labelled "${label}"`);
    }
    // All in one act: taps faster than the screen can draw in between.
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

  const screen = {
    renderer,
    has,
    buttons,
    tap,
    flush,
    text: (id: string) => (has(id) ? textOf(hosts(id)[0]) : ''),
    /** Where the list has a request, or undefined when it is not listed. */
    groupOf: (id: string) => lines().find(line => line.kind === 'request' && line.job?.id === id)?.group,
    /** The references the current filter lists, in order (2026-10-21). */
    listed: () => lines().filter(line => line.kind === 'request').map(line => line.job?.id),
    /** Every label on anything pressable inside one screen (2026-10-21). */
    pressablesIn: (within: string) => [
      ...new Set(
        scope(within)
          .findAll(node => typeof node.props?.onPress === 'function')
          .map(node => String(node.props.accessibilityLabel ?? '')),
      ),
    ],
    pull: async () => {
      await act(async () => {
        list().props.onRefresh();
      });
      await flush();
    },
    statusOf: (id: string) => lines().find(line => line.kind === 'request' && line.job?.id === id)?.job?.status,
    headings: () =>
      lines()
        .filter(line => line.kind === 'heading')
        .map(line => `${line.title} ${line.count}`),
    /** Every label on a button inside the list as drawn. */
    answerLabels: () =>
      [...new Set(
        renderer.root
          .findAll(node => node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function')
          .map(node => String(node.props.accessibilityLabel ?? '')),
      )].filter(label => /^(Accept|Reject) /.test(label)),
    disabled: (label: string) => buttons(label)[0]?.props.disabled === true,
    busy: (label: string) =>
      renderer.root.findAll(
        node => node.props?.accessibilityLabel === label && node.props?.accessibilityState?.busy === true,
      ).length > 0,
    toast: (): string | undefined =>
      renderer.root.findAll(
        node => node.props?.accessibilityHint === 'Dismisses this message' && typeof node.props.onPress === 'function',
      )[0]?.props.accessibilityLabel,
    labelled: (label: string) => renderer.root.findAll(node => node.props?.accessibilityLabel === label),
    choose: (label: string) => tap(label),
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

  if (open) {
    await screen.tap('Requests');
  }

  return screen;
}

describe('Answering from the list — what is offered', () => {
  it('offers Accept and Reject on every waiting request, and on nothing else', async () => {
    const screen = await render();

    expect(new Set(screen.answerLabels())).toEqual(
      new Set([OPEN, DIRECTED, OPEN_LONG, PLAIN].flatMap(job => [acceptLabel(job), rejectLabel(job)])),
    );

    await screen.choose(COPY.filterActive);
    expect(screen.answerLabels()).toEqual([]);

    await screen.choose(COPY.filterCompleted);
    expect(screen.answerLabels()).toEqual([]);
  });

  it('keeps the card’s own button for opening it, apart from the answers', async () => {
    const screen = await render();

    const card = screen.renderer.root.findAll(
      node => node.props?.testID === `vendor-request-${OPEN.id}` && node.props?.accessibilityRole === 'button',
    )[0];
    expect(card.props.accessibilityHint).toBe(JOB.openHint);
    // The answers are not inside the button that opens: a screen reader reaches each on its own.
    expect(
      card.findAll(node => node.props?.accessibilityLabel === acceptLabel(OPEN)),
    ).toHaveLength(0);
  });

  it('labels each answer with the request it answers, and says what it does', async () => {
    const screen = await render();

    expect(screen.buttons(acceptLabel(DIRECTED))[0].props.accessibilityHint).toBe(ANSWER.acceptHint);
    expect(screen.buttons(rejectLabel(DIRECTED))[0].props.accessibilityHint).toBe(ANSWER.rejectHint);
  });
});

describe('Answering from the list — accept', () => {
  it('moves the request from Pending to Active once the service confirms it, says so, and stays on the list', async () => {
    const accept = jest.spyOn(requests, 'acceptRequest');
    const screen = await render();

    await screen.tap(acceptLabel(DIRECTED));

    expect(accept).toHaveBeenCalledTimes(1);
    expect(accept).toHaveBeenCalledWith(DIRECTED.id);
    expect(screen.groupOf(DIRECTED.id)).toBe('active');
    expect(screen.statusOf(DIRECTED.id)).toBe('ACCEPTED');
    expect(screen.headings()).toEqual([
      `${COPY.groupPending} 3`,
      `${COPY.groupActive} 3`,
      `${COPY.groupCompleted} 5`,
    ]);
    expect(screen.answerLabels()).not.toContain(acceptLabel(DIRECTED));
    expect(screen.toast()).toBe(ANSWER.accepted);
    expect(screen.has('vendor-requests')).toBe(true);
    expect(screen.has('vendor-request-details')).toBe(false);
  });

  it('moves the card at once, without waiting for the list to be read again', async () => {
    const screen = await render();
    const reread = held<Awaited<ReturnType<MockVendorRequestService['listRequests']>>>();
    jest.spyOn(requests, 'listRequests').mockReturnValueOnce(reread.promise);

    await screen.tap(acceptLabel(DIRECTED));

    // The service confirmed it; the re-read is still in the air.
    expect(screen.groupOf(DIRECTED.id)).toBe('active');
    expect(screen.answerLabels()).not.toContain(acceptLabel(DIRECTED));
  });

  it('keeps the request where it was when accepting fails, and can try again', async () => {
    jest.spyOn(requests, 'acceptRequest').mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.tap(acceptLabel(DIRECTED));

    expect(screen.groupOf(DIRECTED.id)).toBe('pending');
    expect(screen.toast()).toBe(`${ANSWER.acceptFailed} ${offline().userMessage}`);
    expect(screen.disabled(acceptLabel(DIRECTED))).toBe(false);

    await screen.tap(acceptLabel(DIRECTED));
    expect(screen.groupOf(DIRECTED.id)).toBe('active');
  });

  it('sends one answer for five quick taps', async () => {
    const accept = jest.spyOn(requests, 'acceptRequest');
    const screen = await render();

    await screen.tap(acceptLabel(DIRECTED), 5);

    expect(accept).toHaveBeenCalledTimes(1);
    expect(screen.groupOf(DIRECTED.id)).toBe('active');
  });

  it('holds every answer on the list while one is in the air, and shows which', async () => {
    const call = held<VendorRequestDecisionResult<'accepted'>>();
    const accept = jest.spyOn(requests, 'acceptRequest').mockReturnValueOnce(call.promise);
    const screen = await render();

    await screen.tap(acceptLabel(DIRECTED));

    expect(screen.busy(acceptLabel(DIRECTED))).toBe(true);
    expect(screen.disabled(acceptLabel(OPEN))).toBe(true);
    expect(screen.disabled(rejectLabel(OPEN))).toBe(true);
    // A tap on a held button does nothing.
    await screen.tap(acceptLabel(OPEN));
    expect(accept).toHaveBeenCalledTimes(1);

    await act(async () => {
      call.land({
        outcome: 'accepted',
        request: { ...(await requests.getRequest(DIRECTED.id)), status: 'ACCEPTED' },
      });
    });
    await screen.flush();

    expect(screen.disabled(acceptLabel(OPEN))).toBe(false);
    expect(screen.busy(acceptLabel(OPEN))).toBe(false);
  });
});

describe('Answering from the list — reject', () => {
  it('asks first, and Cancel changes nothing', async () => {
    const reject = jest.spyOn(requests, 'rejectRequest');
    const screen = await render();

    await screen.tap(rejectLabel(DIRECTED));

    expect(screen.has('vendor-reject-dialog')).toBe(true);
    expect(screen.labelled(ANSWER.rejectTitle).length).toBeGreaterThan(0);
    expect(screen.text('vendor-reject-dialog')).toContain(ANSWER.rejectMessage);
    // True since the Rejected list (21/10/2026): the request does not vanish —
    // the dialog says where it goes, by the word on the list's own filter.
    expect(ANSWER.rejectMessage).toContain(VENDOR_COPY.requests.filterRejected);
    expect(ANSWER.rejectMessage).not.toMatch(/no longer (be )?available/);
    expect(reject).not.toHaveBeenCalled();

    await screen.tap(ANSWER.rejectCancel);

    expect(screen.has('vendor-reject-dialog')).toBe(false);
    expect(reject).not.toHaveBeenCalled();
    expect(screen.groupOf(DIRECTED.id)).toBe('pending');
  });

  it('rejects once confirmed: the request leaves the list, not for Active, and the vendor stays', async () => {
    const reject = jest.spyOn(requests, 'rejectRequest');
    const screen = await render();

    await screen.tap(rejectLabel(DIRECTED));
    await screen.tap(ANSWER.rejectConfirm);

    expect(reject).toHaveBeenCalledTimes(1);
    expect(reject).toHaveBeenCalledWith(DIRECTED.id);
    expect(screen.has('vendor-reject-dialog')).toBe(false);
    expect(screen.groupOf(DIRECTED.id)).toBeUndefined();
    expect(screen.headings()).toEqual([
      `${COPY.groupPending} 3`,
      `${COPY.groupActive} 2`,
      `${COPY.groupCompleted} 5`,
    ]);
    expect(screen.toast()).toBe(ANSWER.rejected);
    expect(screen.has('vendor-requests')).toBe(true);
    expect(screen.has('vendor-request-details')).toBe(false);
  });

  it('sends one rejection for five quick confirms, and keeps the dialog until the service answers', async () => {
    const call = held<VendorRequestDecisionResult<'rejected'>>();
    const reject = jest.spyOn(requests, 'rejectRequest').mockReturnValueOnce(call.promise);
    const screen = await render();

    await screen.tap(rejectLabel(DIRECTED));
    await screen.tap(ANSWER.rejectConfirm, 5);

    expect(reject).toHaveBeenCalledTimes(1);
    expect(screen.has('vendor-reject-dialog')).toBe(true);
    expect(screen.busy(ANSWER.rejectConfirm)).toBe(true);
    expect(screen.disabled(ANSWER.rejectCancel)).toBe(true);

    await act(async () => {
      call.land({ outcome: 'rejected', request: { ...(await requests.getRequest(DIRECTED.id)), status: 'REJECTED' } });
    });
    await screen.flush();

    expect(screen.has('vendor-reject-dialog')).toBe(false);
  });

  it('keeps the request when rejecting fails, and can try again', async () => {
    jest.spyOn(requests, 'rejectRequest').mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.tap(rejectLabel(DIRECTED));
    await screen.tap(ANSWER.rejectConfirm);

    expect(screen.has('vendor-reject-dialog')).toBe(false);
    expect(screen.groupOf(DIRECTED.id)).toBe('pending');
    expect(screen.toast()).toBe(`${ANSWER.rejectFailed} ${offline().userMessage}`);

    await screen.tap(rejectLabel(DIRECTED));
    await screen.tap(ANSWER.rejectConfirm);
    expect(screen.groupOf(DIRECTED.id)).toBeUndefined();
  });
});

describe('Answering from the list — too late', () => {
  it('says calmly that another professional took it, takes it off the list, and reads the list again', async () => {
    const list = jest.spyOn(requests, 'listRequests');
    const screen = await render();
    const readsBefore = list.mock.calls.length;
    expect(screen.groupOf(OPEN.id)).toBe('pending');

    // Meena accepts it on her phone while Ravi's list still shows it waiting.
    await meenaElsewhere.acceptRequest(OPEN.id);
    await screen.tap(acceptLabel(OPEN));

    expect(screen.toast()).toBe(ANSWER.taken);
    expect(screen.groupOf(OPEN.id)).toBeUndefined();
    expect(list.mock.calls.length).toBeGreaterThan(readsBefore);
    expect(screen.headings()).toEqual([
      `${COPY.groupPending} 3`,
      `${COPY.groupActive} 2`,
      `${COPY.groupCompleted} 5`,
    ]);
  });

  it('reads the list again when a rejection comes too late, too', async () => {
    const screen = await render();

    await meenaElsewhere.acceptRequest(OPEN_LONG.id);
    await screen.tap(rejectLabel(OPEN_LONG));
    await screen.tap(ANSWER.rejectConfirm);

    expect(screen.toast()).toBe(ANSWER.taken);
    expect(screen.groupOf(OPEN_LONG.id)).toBeUndefined();
  });
});

describe('Answering from the list — the card still opens', () => {
  it('answers without opening the request, and opens it from the card', async () => {
    const screen = await render();

    await screen.tap(rejectLabel(PLAIN));
    expect(screen.has('vendor-request-details')).toBe(false);
    await screen.tap(ANSWER.rejectCancel);

    await screen.tap(acceptLabel(PLAIN));
    expect(screen.has('vendor-request-details')).toBe(false);

    await screen.openCard(OPEN.id);
    expect(screen.has('vendor-request-details')).toBe(true);
  });
});

describe('Answering from the details', () => {
  async function opened(id: string, filter?: string) {
    const screen = await render();
    if (filter) {
      await screen.choose(filter);
    }
    await screen.openCard(id);
    return screen;
  }

  it('offers a waiting request’s answers right under its heading, with what accepting means', async () => {
    const screen = await opened(OPEN.id);

    expect(screen.has('vendor-request-answer')).toBe(true);
    expect(screen.text('vendor-request-answer')).toContain(ANSWER.promptBroadcast);
    expect(screen.buttons(acceptLabel(OPEN), DETAILS_SCREEN)).toHaveLength(1);
    expect(screen.buttons(rejectLabel(OPEN), DETAILS_SCREEN)).toHaveLength(1);
  });

  it('says a directed request was the customer’s choice', async () => {
    const screen = await opened(DIRECTED.id);

    expect(screen.text('vendor-request-answer')).toContain(ANSWER.promptDirected);
  });

  it('offers no answer on accepted work', async () => {
    const screen = await opened('REQ-30961', COPY.filterActive);

    expect(screen.heading()).toContain(`${DETAILS.statusLabel}: ${JOB.statusAccepted}`);
    expect(screen.has('vendor-request-answer')).toBe(false);
    expect(screen.answerLabels()).toEqual([]);
  });

  it('accepts and stays: the status becomes Accepted and the answers go', async () => {
    const screen = await opened(DIRECTED.id);

    await screen.tap(acceptLabel(DIRECTED), 1, DETAILS_SCREEN);

    expect(screen.has('vendor-request-details')).toBe(true);
    expect(screen.heading()).toContain(`${DETAILS.statusLabel}: ${JOB.statusAccepted}`);
    expect(screen.has('vendor-request-answer')).toBe(false);
    expect(screen.toast()).toBe(ANSWER.accepted);

    // The list underneath has caught up by the time the vendor goes back.
    await screen.tap(DETAILS.back);
    expect(screen.groupOf(DIRECTED.id)).toBe('active');
  });

  it('asks before rejecting, and Cancel keeps it waiting', async () => {
    const reject = jest.spyOn(requests, 'rejectRequest');
    const screen = await opened(DIRECTED.id);

    await screen.tap(rejectLabel(DIRECTED), 1, DETAILS_SCREEN);
    expect(screen.has('vendor-reject-dialog')).toBe(true);

    await screen.tap(ANSWER.rejectCancel);
    expect(screen.has('vendor-reject-dialog')).toBe(false);
    expect(reject).not.toHaveBeenCalled();
    expect(screen.has('vendor-request-answer')).toBe(true);
  });

  it('rejects once confirmed and stays, showing it rejected with no answers left', async () => {
    const screen = await opened(DIRECTED.id);

    await screen.tap(rejectLabel(DIRECTED), 1, DETAILS_SCREEN);
    await screen.tap(ANSWER.rejectConfirm);

    expect(screen.has('vendor-request-details')).toBe(true);
    expect(screen.heading()).toContain(`${DETAILS.statusLabel}: ${JOB.statusRejected}`);
    expect(screen.has('vendor-request-answer')).toBe(false);
    expect(screen.toast()).toBe(ANSWER.rejected);

    await screen.tap(DETAILS.back);
    expect(screen.has('vendor-requests')).toBe(true);
    expect(screen.groupOf(DIRECTED.id)).toBeUndefined();
  });

  it('keeps the request as it was when an answer fails, and can try again', async () => {
    jest.spyOn(requests, 'acceptRequest').mockRejectedValueOnce(offline());
    const screen = await opened(DIRECTED.id);

    await screen.tap(acceptLabel(DIRECTED), 1, DETAILS_SCREEN);

    expect(screen.has('vendor-request-answer')).toBe(true);
    expect(screen.heading()).toContain(`${DETAILS.statusLabel}: ${JOB.statusDirected}`);
    expect(screen.toast()).toBe(`${ANSWER.acceptFailed} ${offline().userMessage}`);

    await screen.tap(acceptLabel(DIRECTED), 1, DETAILS_SCREEN);
    expect(screen.heading()).toContain(`${DETAILS.statusLabel}: ${JOB.statusAccepted}`);
  });

  it('says calmly it is no longer available when another professional took it, and Back still works', async () => {
    const screen = await opened(OPEN.id);

    await meenaElsewhere.acceptRequest(OPEN.id);
    await screen.tap(acceptLabel(OPEN), 1, DETAILS_SCREEN);

    expect(screen.toast()).toBe(ANSWER.taken);
    expect(screen.has('vendor-request-not-found')).toBe(true);
    expect(screen.has('vendor-request-answer')).toBe(false);
    expect(screen.has('vendor-request-error')).toBe(false);

    await screen.tap(DETAILS.back);
    expect(screen.has('vendor-requests')).toBe(true);
    expect(screen.groupOf(OPEN.id)).toBeUndefined();
  });

  it('shows a failure, not the old waiting request, if reading it again fails after it moved on', async () => {
    const screen = await opened(OPEN.id);
    await meenaElsewhere.acceptRequest(OPEN.id);
    jest.spyOn(requests, 'getRequest').mockRejectedValueOnce(offline());

    await screen.tap(acceptLabel(OPEN), 1, DETAILS_SCREEN);

    expect(screen.has('vendor-request-error')).toBe(true);
    expect(screen.has('vendor-request-answer')).toBe(false);
  });

  it('sends one answer for five quick taps', async () => {
    const accept = jest.spyOn(requests, 'acceptRequest');
    const screen = await opened(DIRECTED.id);

    await screen.tap(acceptLabel(DIRECTED), 5, DETAILS_SCREEN);

    expect(accept).toHaveBeenCalledTimes(1);
  });
});

describe('The dashboard counts what was answered', () => {
  it('counts an accepted request as active and a rejected one not at all, when the vendor comes back', async () => {
    const screen = await render({ open: false });
    expect(screen.labelled(DASHBOARD.pendingSpoken(4)).length).toBeGreaterThan(0);
    expect(screen.labelled(DASHBOARD.activeSpoken(2)).length).toBeGreaterThan(0);

    await screen.tap('Requests');
    await screen.tap(acceptLabel(DIRECTED));
    await screen.tap(rejectLabel(PLAIN));
    await screen.tap(ANSWER.rejectConfirm);
    await screen.tap('Dashboard');

    expect(screen.labelled(DASHBOARD.pendingSpoken(2)).length).toBeGreaterThan(0);
    expect(screen.labelled(DASHBOARD.activeSpoken(3)).length).toBeGreaterThan(0);
    expect(screen.labelled(DASHBOARD.completedSpoken(5)).length).toBeGreaterThan(0);
  });

  it('counts an answer given on the details screen too', async () => {
    const screen = await render();
    await screen.openCard(DIRECTED.id);
    await screen.tap(acceptLabel(DIRECTED), 1, DETAILS_SCREEN);
    await screen.tap(DETAILS.back);
    await screen.tap('Dashboard');

    expect(screen.labelled(DASHBOARD.pendingSpoken(3)).length).toBeGreaterThan(0);
    expect(screen.labelled(DASHBOARD.activeSpoken(3)).length).toBeGreaterThan(0);
  });
});

describe('Whose requests', () => {
  it('shows another vendor only the open requests — and not the one this vendor took', async () => {
    const screen = await render();
    await screen.tap(acceptLabel(OPEN));

    await screen.switchTo(MEENA);
    await screen.tap('Requests');

    expect(screen.groupOf(OPEN_LONG.id)).toBe('pending');
    expect(screen.groupOf(OPEN.id)).toBeUndefined();
    expect(screen.groupOf(DIRECTED.id)).toBeUndefined();
    expect(screen.groupOf('REQ-30954')).toBeUndefined();
    expect(new Set(screen.answerLabels())).toEqual(new Set([acceptLabel(OPEN_LONG), rejectLabel(OPEN_LONG)]));
  });

  it('keeps one vendor’s rejection to themselves', async () => {
    current = MEENA;
    const screen = await render();
    await screen.tap(rejectLabel(OPEN_LONG));
    await screen.tap(ANSWER.rejectConfirm);
    expect(screen.groupOf(OPEN_LONG.id)).toBeUndefined();

    await screen.switchTo(RAVI);
    await screen.tap('Requests');

    expect(screen.groupOf(OPEN_LONG.id)).toBe('pending');
  });
});

/**
 * What the vendor declined, kept as their history under its own Rejected
 * filter (section 31; owner decision, 2026-10-21): listed once the service
 * confirms the rejection, the latest declined first, never under All, offered
 * nothing, opened read-only, never another vendor's, and kept after somebody
 * else takes the request.
 */
describe('The Rejected filter', () => {
  const rejectOnList = async (screen: Awaited<ReturnType<typeof render>>, job: { id: string; service: string }) => {
    await screen.tap(rejectLabel(job));
    await screen.tap(ANSWER.rejectConfirm);
  };

  it('lists what was declined once the service confirms it, the latest first — and never under All', async () => {
    const screen = await render();
    await rejectOnList(screen, DIRECTED);
    await rejectOnList(screen, PLAIN);

    // All is the work: neither is there, and no heading is drawn for them.
    expect(screen.groupOf(DIRECTED.id)).toBeUndefined();
    expect(screen.groupOf(PLAIN.id)).toBeUndefined();
    expect(screen.headings()).toEqual([
      `${COPY.groupPending} 2`,
      `${COPY.groupActive} 2`,
      `${COPY.groupCompleted} 5`,
    ]);

    await screen.choose(COPY.filterRejected);

    expect(screen.listed()).toEqual([PLAIN.id, DIRECTED.id]);
    expect(screen.headings()).toEqual([]);
    expect(screen.statusOf(PLAIN.id)).toBe('REJECTED');
    expect(screen.has('vendor-requests-empty')).toBe(false);
  });

  it('moves the card to Rejected at once, without waiting for the list to be read again', async () => {
    const screen = await render();
    const reread = held<Awaited<ReturnType<MockVendorRequestService['listRequests']>>>();
    jest.spyOn(requests, 'listRequests').mockReturnValueOnce(reread.promise);

    await rejectOnList(screen, DIRECTED);
    await screen.choose(COPY.filterRejected);

    // The service confirmed it; the re-read is still in the air.
    expect(screen.listed()).toEqual([DIRECTED.id]);
    expect(screen.statusOf(DIRECTED.id)).toBe('REJECTED');
  });

  it('offers nothing on a declined request: its card opens it, says it was rejected and when', async () => {
    const screen = await render();
    await rejectOnList(screen, DIRECTED);
    await screen.choose(COPY.filterRejected);

    const reference = `${JOB.referencePrefix} ${DIRECTED.id}`;
    for (const label of [
      acceptLabel(DIRECTED),
      rejectLabel(DIRECTED),
      VENDOR_COPY.work.startSpoken(DIRECTED.service, reference),
      VENDOR_COPY.work.completeSpoken(DIRECTED.service, reference),
    ]) {
      expect(screen.labelled(label)).toHaveLength(0);
    }
    expect(screen.answerLabels()).toEqual([]);

    const [card] = screen.renderer.root.findAll(
      node =>
        node.props?.testID === `vendor-request-${DIRECTED.id}` &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    );
    expect(card.props.accessibilityHint).toBe(JOB.openHint);
    expect(card.props.accessibilityLabel).toContain(`${JOB.statusLabel}: ${JOB.statusRejected}`);
    // Dated by when it was declined — the order the list is in — not by when it was raised.
    expect(card.props.accessibilityLabel).toContain(`${JOB.rejectedLabel} ${JOB.justNow}`);
    expect(card.props.accessibilityLabel).not.toContain(JOB.raisedLabel);
  });

  it('offers nothing under Rejected even if the backend still calls the request waiting', async () => {
    const real = await requests.listRequests();
    // A backend slip: a waiting record, listed among the declined.
    const waiting = real.pending.filter(job => job.id === DIRECTED.id).map(job => ({ ...job }));
    jest.spyOn(requests, 'listRequests').mockResolvedValueOnce({ ...real, rejected: waiting });
    const screen = await render();

    await screen.choose(COPY.filterRejected);

    expect(screen.listed()).toEqual([DIRECTED.id]);
    expect(screen.statusOf(DIRECTED.id)).toBe('PENDING_VENDOR');
    expect(screen.answerLabels()).toEqual([]);
  });

  it('opens a declined request read-only: Rejected, when it was declined, and only Back', async () => {
    const screen = await render();
    await rejectOnList(screen, DIRECTED);
    await screen.choose(COPY.filterRejected);

    await screen.openCard(DIRECTED.id);

    expect(screen.has(DETAILS_SCREEN)).toBe(true);
    expect(screen.heading()).toContain(`${DETAILS.statusLabel}: ${JOB.statusRejected}`);
    expect(screen.text('vendor-request-rejected')).toContain(DETAILS.rejectedLabel);
    expect(screen.text('vendor-request-rejected')).toContain('Just now');
    expect(screen.has('vendor-request-answer')).toBe(false);
    expect(screen.has('vendor-request-work')).toBe(false);
    expect(screen.pressablesIn(DETAILS_SCREEN)).toEqual([DETAILS.back]);

    await screen.tap(DETAILS.back);
    expect(screen.has(DETAILS_SCREEN)).toBe(false);
    expect(screen.listed()).toEqual([DIRECTED.id]);
  });

  it('lists a request rejected on its details there when the vendor goes back', async () => {
    const screen = await render();
    await screen.openCard(DIRECTED.id);
    await screen.tap(rejectLabel(DIRECTED), 1, DETAILS_SCREEN);
    await screen.tap(ANSWER.rejectConfirm);
    expect(screen.text('vendor-request-rejected')).toContain(DETAILS.rejectedLabel);

    await screen.tap(DETAILS.back);
    await screen.choose(COPY.filterRejected);

    expect(screen.listed()).toEqual([DIRECTED.id]);
  });

  it('keeps a declined request after another professional takes it', async () => {
    const screen = await render();
    await rejectOnList(screen, OPEN);
    await meenaElsewhere.acceptRequest(OPEN.id);

    await screen.choose(COPY.filterRejected);
    await screen.pull();

    expect(screen.listed()).toEqual([OPEN.id]);
    expect(screen.statusOf(OPEN.id)).toBe('REJECTED');

    await screen.openCard(OPEN.id);
    expect(screen.heading()).toContain(`${DETAILS.statusLabel}: ${JOB.statusRejected}`);
    expect(screen.has('vendor-request-not-found')).toBe(false);
  });

  it('keeps one vendor’s rejections to themselves', async () => {
    current = MEENA;
    const screen = await render();
    await rejectOnList(screen, OPEN_LONG);
    await screen.choose(COPY.filterRejected);
    expect(screen.listed()).toEqual([OPEN_LONG.id]);

    await screen.switchTo(RAVI);
    await screen.tap('Requests');
    await screen.choose(COPY.filterRejected);

    expect(screen.listed()).toEqual([]);
    expect(screen.text('vendor-requests-empty')).toContain(COPY.emptyRejectedTitle);
    expect(screen.text('vendor-requests-empty')).toContain(COPY.emptyRejectedMessage);
  });

  it('leaves the dashboard’s counts as they were: what was declined is not counted', async () => {
    const screen = await render();
    await rejectOnList(screen, DIRECTED);
    await screen.tap('Dashboard');

    expect(screen.labelled(DASHBOARD.pendingSpoken(3)).length).toBeGreaterThan(0);
    expect(screen.labelled(DASHBOARD.activeSpoken(2)).length).toBeGreaterThan(0);
    expect(screen.labelled(DASHBOARD.completedSpoken(5)).length).toBeGreaterThan(0);
  });
});

/**
 * Section 54's events as a vendor meets them on screen. The list and the
 * details pass on how a waiting request reached the vendor from the record
 * they already show — nothing is read for analytics — and the details count a
 * request viewed once per opening, never again for the reads that follow an
 * answer. Asserted with `toStrictEqual`, so a property that is present but
 * undefined fails as surely as one that should not be there.
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

  /** Nothing about the customer, the job or the vendor, in anything analytics was handed. */
  function expectNothingPersonal() {
    const serialised = JSON.stringify(track.mock.calls);
    for (const value of [
      'Asha Patel',
      'Rahul Menon',
      'Neha Sharma',
      'Koramangala',
      'HSR Layout',
      OPEN.service,
      DIRECTED.service,
      PLAIN.service,
      'Kumar Electricals',
      RAVI.firstName,
      RAVI.phone,
    ]) {
      expect(serialised).not.toContain(value);
    }
  }

  it('counts an accept from the list with how each request reached the vendor', async () => {
    const screen = await render();

    await screen.tap(acceptLabel(DIRECTED));
    await screen.tap(acceptLabel(OPEN));
    await screen.tap(acceptLabel(PLAIN));

    expect(sent('request_accepted')).toStrictEqual([
      { requestId: DIRECTED.id, dispatch: 'directed' },
      { requestId: OPEN.id, dispatch: 'broadcast' },
      // The backend did not say, so neither does the event.
      { requestId: PLAIN.id },
    ]);
    // Answering from a card is not opening the request.
    expect(sent('request_viewed')).toEqual([]);
    expectNothingPersonal();
  });

  it('counts a rejection from the list once it is confirmed, and nothing for one cancelled', async () => {
    const screen = await render();

    await screen.tap(rejectLabel(DIRECTED));
    await screen.tap(ANSWER.rejectCancel);
    expect(track).not.toHaveBeenCalled();

    await screen.tap(rejectLabel(OPEN));
    await screen.tap(ANSWER.rejectConfirm);

    expect(events()).toEqual(['request_rejected']);
    expect(sent('request_rejected')).toStrictEqual([{ requestId: OPEN.id, dispatch: 'broadcast' }]);
  });

  it('counts a race lost on the list as request_accept_lost, by its reference alone', async () => {
    const screen = await render();

    await meenaElsewhere.acceptRequest(OPEN.id);
    await screen.tap(acceptLabel(OPEN));

    expect(events()).toEqual(['request_accept_lost']);
    expect(sent('request_accept_lost')).toStrictEqual([{ requestId: OPEN.id }]);
  });

  it('counts nothing for a failed accept, and one for the retry that worked', async () => {
    jest.spyOn(requests, 'acceptRequest').mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.tap(acceptLabel(DIRECTED));
    expect(track).not.toHaveBeenCalled();

    await screen.tap(acceptLabel(DIRECTED));
    expect(events()).toEqual(['request_accepted']);
  });

  it('counts one accept for five quick taps', async () => {
    const screen = await render();

    await screen.tap(acceptLabel(DIRECTED), 5);

    expect(events()).toEqual(['request_accepted']);
  });

  it('counts a request viewed when its details first load, with how it arrived', async () => {
    const screen = await render();

    await screen.openCard(OPEN.id);

    expect(events()).toEqual(['request_viewed']);
    const [properties] = sent('request_viewed');
    expect(Object.keys(properties).sort()).toEqual(['dispatch', 'requestId']);
    expect(properties).toEqual({ requestId: OPEN.id, dispatch: 'broadcast' });
    expectNothingPersonal();
  });

  it('leaves the routing off a viewed request whose record has none', async () => {
    const screen = await render();

    await screen.openCard(PLAIN.id);
    await screen.tap(DETAILS.back);
    await screen.choose(COPY.filterActive);
    await screen.openCard('REQ-30961');

    expect(sent('request_viewed')).toStrictEqual([{ requestId: PLAIN.id }, { requestId: 'REQ-30961' }]);
  });

  it('counts each opening, not each read', async () => {
    const screen = await render();

    await screen.openCard(DIRECTED.id);
    await screen.tap(DETAILS.back);
    await screen.openCard(DIRECTED.id);

    expect(sent('request_viewed')).toStrictEqual([
      { requestId: DIRECTED.id, dispatch: 'directed' },
      { requestId: DIRECTED.id, dispatch: 'directed' },
    ]);
  });

  it('counts an accept on the details with its routing, and the viewing still once', async () => {
    const screen = await render();
    await screen.openCard(DIRECTED.id);

    await screen.tap(acceptLabel(DIRECTED), 1, DETAILS_SCREEN);

    expect(events()).toEqual(['request_viewed', 'request_accepted']);
    expect(sent('request_accepted')).toStrictEqual([{ requestId: DIRECTED.id, dispatch: 'directed' }]);
    expectNothingPersonal();
  });

  it('counts a rejection on the details with its routing', async () => {
    const screen = await render();
    await screen.openCard(OPEN.id);

    await screen.tap(rejectLabel(OPEN), 1, DETAILS_SCREEN);
    await screen.tap(ANSWER.rejectConfirm);

    expect(events()).toEqual(['request_viewed', 'request_rejected']);
    expect(sent('request_rejected')).toStrictEqual([{ requestId: OPEN.id, dispatch: 'broadcast' }]);
  });

  it('counts a race lost on the details, and not the read that follows it as a second viewing', async () => {
    const screen = await render();
    await screen.openCard(OPEN.id);

    await meenaElsewhere.acceptRequest(OPEN.id);
    await screen.tap(acceptLabel(OPEN), 1, DETAILS_SCREEN);

    expect(screen.has('vendor-request-not-found')).toBe(true);
    expect(events()).toEqual(['request_viewed', 'request_accept_lost']);
  });

  it('counts no viewing for a read that failed, and one for the retry that worked', async () => {
    jest.spyOn(requests, 'getRequest').mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.openCard(DIRECTED.id);
    expect(screen.has('vendor-request-error')).toBe(true);
    expect(track).not.toHaveBeenCalled();

    await screen.tap('Try again', 1, DETAILS_SCREEN);

    expect(screen.has('vendor-request-answer')).toBe(true);
    expect(sent('request_viewed')).toStrictEqual([{ requestId: DIRECTED.id, dispatch: 'directed' }]);
  });

  it('counts no viewing for a request that is not there', async () => {
    jest
      .spyOn(requests, 'getRequest')
      .mockRejectedValueOnce(new AppError({ kind: 'notFound', message: 'gone' }));
    const screen = await render();

    await screen.openCard(DIRECTED.id);

    expect(screen.has('vendor-request-not-found')).toBe(true);
    expect(track).not.toHaveBeenCalled();
  });
});
