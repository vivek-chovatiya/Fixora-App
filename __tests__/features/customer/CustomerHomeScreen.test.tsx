/**
 * Customer Home has two independent sections and one job, and these tests pin
 * the edges of both:
 *
 * - every section shows a placeholder before its data arrives, and the screen is
 *   never blank while it waits
 * - the two sections fail separately: one going down must not take the other,
 *   nor the primary action, with it
 * - a failure shows the safe message and offers a retry that actually re-queries
 * - nothing on the screen knows a category name — what renders is what the
 *   service returned
 * - the primary action, "See all" and the empty state lead to Categories; a
 *   category tile leads to that category's own services, by id
 * - a request card is one thing to a screen reader, and its status is a word
 *   rather than only a colour
 * - a pull reads the bell's count again with both sections (3D-12); a count
 *   that cannot be read is no badge, never a failure on the page
 *
 * Stub services are registered so the screen is exercised through the same
 * abstraction the real ones will arrive behind.
 *
 * Copy is asserted through CUSTOMER_COPY rather than repeated as literals: the
 * point is that the screen renders centralised content, not that a particular
 * sentence was chosen.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { SessionPayload } from '@/features/auth/types';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { HOME_RECENT_REQUEST_LIMIT } from '@/features/customer/hooks/useCustomerHome';
import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import { CustomerHomeScreen } from '@/features/customer/screens/CustomerHomeScreen';
import { customerRequestsChanged } from '@/features/customer/state/customerRequestSync';
import {
  RequestDraftProvider,
  useRequestDraft,
} from '@/features/customer/state/RequestDraftContext';
import {
  setRequestDraftStorage,
  type RequestDraftStorage,
} from '@/features/customer/state/requestDraftStorage';
import { ToastProvider } from '@/shared/components';
import { AsyncStorageMockRequestHistory } from '@/shared/services/mock/MockRequestHistoryStorage';
import { MockRequestService } from '@/shared/services/mock/MockRequestService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService, ServiceCategory } from '@/shared/services/types/CategoryService';
import type { NotificationService } from '@/shared/services/types/NotificationService';
import type { CustomerRequest, RequestService } from '@/shared/services/types/RequestService';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const COPY = CUSTOMER_COPY.home;

const SESSION: SessionPayload = {
  token: 'token',
  user: {
    id: 'usr_1',
    firstName: 'Asha',
    lastName: 'Patel',
    phone: '9876543210',
    role: 'customer',
  },
};

/**
 * Deliberately nothing like the mock service's seed. If a test passes because
 * the screen happens to agree with a fixture it did not receive, the screen is
 * carrying a catalogue it is not allowed to have.
 */
const CATEGORIES: ServiceCategory[] = [
  { id: 'cat_a', name: 'Roof Repair', iconGlyph: 'home-roof' },
  { id: 'cat_b', name: 'Glazing' },
];

const REQUESTS: CustomerRequest[] = [
  {
    id: 'REQ-1',
    reference: 'REQ-1',
    serviceName: 'Roof Repair',
    vendorName: 'Skyline Roofing',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    createdAt: new Date(Date.now() - 90 * 60_000).toISOString(),
  },
  {
    id: 'REQ-2',
    reference: 'REQ-2',
    serviceName: 'Glazing',
    status: 'PENDING_VENDOR',
    priority: 'LOW',
    createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
  },
];

/** A promise a test can leave hanging, so the loading state is observable. */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

interface Stubs {
  categories?: () => Promise<ServiceCategory[]>;
  requests?: (limit: number) => Promise<CustomerRequest[]>;
  /**
   * The bell's count. Left out, no notification service is registered and the
   * bell draws no badge — a failed count is never an error on Home.
   */
  unread?: () => Promise<number>;
  /** Rendered beside Home inside the draft provider, to change the draft as a form would. */
  probe?: React.ReactNode;
}

async function render({ categories, requests, unread, probe }: Stubs = {}) {
  const listServiceCategories = jest.fn(categories ?? (async () => CATEGORIES));
  // The default honours `limit` the way the real service does, so the screen is
  // exercised against a stub that could not accidentally return more than it
  // was asked for.
  const listRecentRequests = jest.fn(
    requests ?? (async (limit: number) => REQUESTS.slice(0, limit)),
  );

  registerService('category', {
    listServiceCategories,
    // Part of the catalogue contract, and no business of this screen.
    listSubCategories: jest.fn(() => {
      throw new Error('listSubCategories must not be called from home');
    }),
  } as CategoryService);
  registerService('request', {
    listRecentRequests,
    // Part of the request contract, and no business of this screen.
    createRequest: jest.fn(() => {
      throw new Error('createRequest must not be called from home');
    }),
    // Home hands over a reference; the details screen does the reading.
    getRequest: jest.fn(() => {
      throw new Error('getRequest must not be called from home');
    }),
    // Home shows a short summary; paging through history is My Requests'.
    listRequests: jest.fn(() => {
      throw new Error('listRequests must not be called from home');
    }),
    // A card opens the request; only its details may cancel it.
    cancelRequest: jest.fn(() => {
      throw new Error('cancelRequest must never be called from home');
    }),
  } as RequestService);

  const getUnreadCount = jest.fn(unread ?? (async () => 0));
  if (unread) {
    registerService('notification', {
      getUnreadCount,
      // Home counts; listing and marking are the inbox's.
      list: jest.fn(() => {
        throw new Error('list must not be called from home');
      }),
      markAsRead: jest.fn(() => {
        throw new Error('markAsRead must not be called from home');
      }),
      markAllAsRead: jest.fn(() => {
        throw new Error('markAllAsRead must not be called from home');
      }),
    } as unknown as NotificationService);
  }

  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn(SESSION));

  const navigate = jest.fn();
  const reset = jest.fn();
  // Home reaches the stack around it to rebuild the request flow on resume.
  const navigation = { navigate, getParent: () => ({ reset }) } as never;
  const route = { key: 'Home', name: 'Home' as const, params: undefined } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <RequestDraftProvider>
              <CustomerHomeScreen navigation={navigation} route={route} />
              {probe}
            </RequestDraftProvider>
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  mounted.push(renderer);

  const hosts = (predicate: (props: Record<string, unknown>) => boolean) =>
    renderer.root.findAll(
      node => typeof node.type === 'string' && predicate(node.props as Record<string, unknown>),
    );

  return {
    renderer,
    navigate,
    reset,
    listServiceCategories,
    listRecentRequests,
    getUnreadCount,
    /** What the bell says, as a screen reader hears it. */
    bellLabel: () =>
      renderer.root.findAll(
        node =>
          node.props?.testID === 'home-notifications' &&
          node.props?.accessibilityRole === 'button' &&
          typeof node.props?.onPress === 'function',
      )[0]?.props.accessibilityLabel as string | undefined,
    text: () => textOf(renderer.toJSON()),
    byTestID: (id: string) => hosts(props => props.testID === id),
    /** Pull-to-refresh, as the scroll view's refresh control would. */
    pull: async () => {
      const [scroller] = renderer.root.findAll(node =>
        React.isValidElement(node.props?.refreshControl),
      );
      await act(async () => {
        scroller.props.refreshControl.props.onRefresh();
      });
    },
    /**
     * The press handler lives on the composite Pressable, while the
     * accessibility props land on the host view it renders — so a button is
     * found by asking for a node that has both.
     */
    press: async (label: string) => {
      const [target] = renderer.root.findAll(
        node =>
          node.props?.accessibilityRole === 'button' &&
          node.props?.accessibilityLabel === label &&
          typeof node.props?.onPress === 'function',
      );

      if (!target) {
        throw new Error(`No button labelled "${label}"`);
      }

      await act(async () => {
        target.props.onPress();
      });
    },
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

/**
 * No draft, unless a test says otherwise.
 *
 * Stubbed rather than left to AsyncStorage so the resume prompt's presence is a
 * decision each test makes, not a leftover from the one before it.
 */
let savedDraft: Awaited<ReturnType<RequestDraftStorage['read']>> = null;

beforeEach(() => {
  savedDraft = null;
  setRequestDraftStorage({
    read: async () => savedDraft,
    write: async () => true,
    clear: async () => undefined,
  });
});

/**
 * Every screen a test rendered, unmounted after it.
 *
 * Found tracing jest's "A worker process has failed to exit gracefully": the
 * tests that leave Home loading left its `Skeleton`s pulsing, and a pulse that
 * repeats forever only stops when the component unmounts and cancels it. With
 * nothing unmounted, this file's tests all passed and jest then never exited on
 * its own ("Jest did not exit one second after the test run has completed").
 */
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  resetServices();
});

describe('CustomerHomeScreen — while the data is still coming', () => {
  it('places a holder for each section rather than a blank page', async () => {
    const { byTestID } = await render({ categories: pending, requests: pending });

    expect(byTestID('home-category-grid-loading')).toHaveLength(1);
    expect(byTestID('home-recent-list-loading')).toHaveLength(1);
  });

  it('says it is busy once per section, not once per placeholder', async () => {
    const { renderer } = await render({ categories: pending, requests: pending });

    const busy = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.accessibilityState?.busy === true,
    );

    expect(busy.map(node => node.props.testID).sort()).toEqual([
      'home-category-grid',
      'home-recent-list',
    ]);
  });

  it('names each loading section, so busy is never all it says', async () => {
    const { byTestID } = await render({ categories: pending, requests: pending });

    const [recent] = byTestID('home-recent-list');
    const [grid] = byTestID('home-category-grid');

    // A region with a state and no name is announced as the bare word "busy".
    expect(recent.props.accessibilityLabel).toBe(COPY.recentLoadingLabel);
    expect(recent.props.accessibilityState).toEqual({ busy: true });
    expect(grid.props.accessibilityLabel).toBe(COPY.categoriesLoadingLabel);
    expect(grid.props.accessibilityState).toEqual({ busy: true });
  });

  it('still offers the primary action, because it needs no data', async () => {
    const { text } = await render({ categories: pending, requests: pending });

    expect(text()).toContain(COPY.prompt);
    expect(text()).toContain(COPY.primaryAction);
  });
});

describe('CustomerHomeScreen — what it draws', () => {
  it('greets the signed-in customer by the name they are called', async () => {
    const { text } = await render();

    expect(text()).toContain(SESSION.user.firstName);
    expect(text()).not.toContain(SESSION.user.lastName);
  });

  it('renders the categories the service returned, and knows none of its own', async () => {
    const { byTestID, text } = await render();

    for (const category of CATEGORIES) {
      expect(byTestID(`category-tile-${category.id}`)).toHaveLength(1);
      expect(text()).toContain(category.name);
    }
  });

  it('asks for only as many recent requests as it has room to show', async () => {
    const { listRecentRequests } = await render();

    expect(listRecentRequests).toHaveBeenCalledTimes(1);
    expect(listRecentRequests.mock.calls[0]?.[0]).toBeLessThanOrEqual(3);
  });

  it('shows a request as service, vendor, status, priority and reference', async () => {
    const { text } = await render();

    expect(text()).toContain('Roof Repair');
    expect(text()).toContain('Skyline Roofing');
    // The status is a word, not only a tone — the badge has to survive greyscale.
    expect(text()).toContain('In progress');
    expect(text()).toContain('High');
    expect(text()).toContain('REQ-1');
  });

  it('says a vendor is missing rather than leaving the row blank', async () => {
    const { text } = await render();

    expect(text()).toContain(CUSTOMER_COPY.request.vendorPending);
  });
});

describe('CustomerHomeScreen — with nothing to show', () => {
  it('offers the roadmap empty state and its way out', async () => {
    const { byTestID, text } = await render({ requests: async () => [] });

    expect(byTestID('home-recent-list-empty')).toHaveLength(1);
    expect(text()).toContain(COPY.recentEmptyTitle);
    // An empty list with no next step leaves the user with nothing to do.
    expect(text()).toContain(COPY.primaryAction);
  });

  it('does not call an empty catalogue a failure', async () => {
    const { byTestID, text } = await render({ categories: async () => [] });

    expect(byTestID('home-category-grid-empty')).toHaveLength(1);
    expect(byTestID('home-category-grid-error')).toHaveLength(0);
    expect(text()).toContain(COPY.categoriesEmptyTitle);
  });
});

describe('CustomerHomeScreen — when a service fails', () => {
  const failure = new AppError({
    kind: 'network',
    message: 'ECONNREFUSED 10.0.2.2:8080',
  });

  it('shows the safe message and never the developer one', async () => {
    const { text } = await render({
      categories: async () => {
        throw failure;
      },
    });

    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain(failure.message);
  });

  it('keeps the rest of the screen working', async () => {
    const { byTestID, text } = await render({
      categories: async () => {
        throw failure;
      },
    });

    expect(byTestID('home-category-grid-error')).toHaveLength(1);
    // The section that did load is untouched, and so is the primary action.
    expect(text()).toContain('Skyline Roofing');
    expect(text()).toContain(COPY.primaryAction);
  });

  it('retries the query that failed, not the one that did not', async () => {
    const { press, listServiceCategories, listRecentRequests } = await render({
      categories: async () => {
        throw failure;
      },
    });

    expect(listServiceCategories).toHaveBeenCalledTimes(1);

    await press('Try again');

    expect(listServiceCategories).toHaveBeenCalledTimes(2);
    expect(listRecentRequests).toHaveBeenCalledTimes(1);
  });

  it('reports a failed history in place, leaving discovery alone', async () => {
    const { byTestID, text } = await render({
      requests: async () => {
        throw failure;
      },
    });

    expect(byTestID('home-recent-list-error')).toHaveLength(1);
    expect(byTestID('home-category-grid')).toHaveLength(1);
    expect(text()).toContain('Roof Repair');
  });
});

/**
 * A pull that fails. It used to replace a working section with an error — the
 * shared query keeps the old data but reports the failure, and both sections
 * drew the failure first — so a customer lost a grid and their own requests to
 * a dropped connection. Now what was there stays, and one notice says it may be
 * out of date.
 */
describe('CustomerHomeScreen — when a pull fails', () => {
  const failure = new AppError({
    kind: 'network',
    message: 'ECONNREFUSED 10.0.2.2:8080',
  });

  /** Answers, then fails once, then answers again. */
  function failingSecondTime<T>(value: T) {
    let calls = 0;
    return async () => {
      calls += 1;
      if (calls === 2) {
        throw failure;
      }
      return value;
    };
  }

  /** The control with this label inside one node's subtree. */
  function buttonWithin(node: ReactTestRenderer.ReactTestInstance, label: string) {
    const [target] = node.findAll(
      candidate =>
        candidate.props?.accessibilityRole === 'button' &&
        candidate.props?.accessibilityLabel === label &&
        typeof candidate.props?.onPress === 'function',
    );
    return target;
  }

  it('keeps both sections and says once that they may be out of date', async () => {
    const { pull, byTestID, text } = await render({
      categories: failingSecondTime(CATEGORIES),
      requests: failingSecondTime(REQUESTS),
    });
    expect(byTestID('home-stale')).toHaveLength(0);

    await pull();

    expect(byTestID('home-stale')).toHaveLength(1);
    // What was there is still there, and neither section became an error.
    expect(byTestID(`category-tile-${CATEGORIES[0].id}`)).toHaveLength(1);
    expect(byTestID('recent-request-REQ-1').length).toBeGreaterThan(0);
    expect(byTestID('home-category-grid-error')).toHaveLength(0);
    expect(byTestID('home-recent-list-error')).toHaveLength(0);

    expect(text()).toContain(COPY.staleTitle);
    expect(text()).toContain(COPY.staleMessage);
    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain(failure.message);
  });

  it('says so when only one section failed to refresh', async () => {
    const { pull, byTestID } = await render({
      requests: failingSecondTime(REQUESTS),
    });

    await pull();

    expect(byTestID('home-stale')).toHaveLength(1);
    expect(byTestID('recent-request-REQ-2').length).toBeGreaterThan(0);
    expect(byTestID('home-recent-list-error')).toHaveLength(0);
  });

  it('clears the notice once a later pull succeeds', async () => {
    const { pull, byTestID, listServiceCategories, listRecentRequests } = await render({
      categories: failingSecondTime(CATEGORIES),
      requests: failingSecondTime(REQUESTS),
    });

    await pull();
    expect(byTestID('home-stale')).toHaveLength(1);

    await pull();

    expect(byTestID('home-stale')).toHaveLength(0);
    expect(listServiceCategories).toHaveBeenCalledTimes(3);
    expect(listRecentRequests).toHaveBeenCalledTimes(3);
  });

  it('tries again from the notice by pulling again, keeping the sections on screen', async () => {
    const { pull, byTestID, listServiceCategories, listRecentRequests } = await render({
      categories: failingSecondTime(CATEGORIES),
      requests: failingSecondTime(REQUESTS),
    });
    await pull();

    const [notice] = byTestID('home-stale');
    const retry = buttonWithin(notice, COPY.staleRetry);
    expect(retry).toBeDefined();
    expect(retry.props.accessibilityHint).toBe(COPY.staleRetryHint);

    await act(async () => {
      retry.props.onPress();
    });

    expect(listServiceCategories).toHaveBeenCalledTimes(3);
    expect(listRecentRequests).toHaveBeenCalledTimes(3);
    expect(byTestID('home-stale')).toHaveLength(0);
    // Never back to placeholders: a refresh, not a first load.
    expect(byTestID('home-category-grid-loading')).toHaveLength(0);
    expect(byTestID(`category-tile-${CATEGORIES[1].id}`)).toHaveLength(1);
  });

  it('still shows a failed first read as the section’s own error, with no notice', async () => {
    const { byTestID } = await render({
      categories: async () => {
        throw failure;
      },
    });

    expect(byTestID('home-category-grid-error')).toHaveLength(1);
    expect(byTestID('home-stale')).toHaveLength(0);
  });

  it('announces the notice in single sentences', async () => {
    const { pull, byTestID } = await render({
      requests: failingSecondTime(REQUESTS),
    });

    await pull();

    const [notice] = byTestID('home-stale');
    const [spoken] = notice.findAll(
      node => typeof node.type === 'string' && node.props?.accessibilityRole === 'alert',
    );
    expect(spoken.props.accessibilityLabel).toBe(
      `${COPY.staleTitle}. ${COPY.staleMessage} ${failure.userMessage}`,
    );
    expect(spoken.props.accessibilityLabel).not.toContain('..');
  });
});

/**
 * The bell's count on a pull (open item, Phase 3F-2). It was read on arrival,
 * on every return and after every mark — never by the pull, so a pull left the
 * badge as it was until the next focus. The pull is the page's, so it reads the
 * badge with everything else; the badge still draws no spinner and no failure
 * of its own.
 */
describe('CustomerHomeScreen — the bell on a pull', () => {
  const BELL = NOTIFICATIONS_COPY.bell;

  it('reads the unread count again with the sections, and draws the new count', async () => {
    let count = 2;
    const { pull, getUnreadCount, listServiceCategories, listRecentRequests, bellLabel } =
      await render({ unread: async () => count });
    expect(getUnreadCount).toHaveBeenCalledTimes(1);
    expect(bellLabel()).toBe(BELL.unreadSpoken(2));

    count = 5;
    await pull();

    expect(getUnreadCount).toHaveBeenCalledTimes(2);
    expect(listServiceCategories).toHaveBeenCalledTimes(2);
    expect(listRecentRequests).toHaveBeenCalledTimes(2);
    expect(bellLabel()).toBe(BELL.unreadSpoken(5));
  });

  it('reads it again from the stale notice’s Try again, which pulls again', async () => {
    let calls = 0;
    const { pull, press, getUnreadCount, byTestID } = await render({
      unread: async () => 1,
      requests: async limit => {
        calls += 1;
        if (calls === 2) {
          throw new AppError({ kind: 'network', message: 'offline' });
        }
        return REQUESTS.slice(0, limit);
      },
    });

    await pull();
    expect(byTestID('home-stale')).toHaveLength(1);
    expect(getUnreadCount).toHaveBeenCalledTimes(2);

    await press(COPY.staleRetry);

    expect(getUnreadCount).toHaveBeenCalledTimes(3);
  });

  it('never turns a count it could not read into a failure on the page', async () => {
    let calls = 0;
    const { pull, byTestID, bellLabel } = await render({
      unread: async () => {
        calls += 1;
        if (calls === 2) {
          throw new AppError({ kind: 'network', message: 'offline' });
        }
        return 3;
      },
    });
    expect(bellLabel()).toBe(BELL.unreadSpoken(3));

    await pull();

    // No badge — never a notice, an error or a retry for a hint.
    expect(bellLabel()).toBe(BELL.label);
    expect(byTestID('home-stale')).toHaveLength(0);
    expect(byTestID('home-category-grid-error')).toHaveLength(0);
    expect(byTestID('home-recent-list-error')).toHaveLength(0);
  });

  it('does not hold the pull’s spinner for the badge', async () => {
    let calls = 0;
    const { renderer, pull } = await render({
      // The second read — the pull's — never answers.
      unread: () => {
        calls += 1;
        return calls === 1 ? Promise.resolve(1) : pending<number>();
      },
    });

    await pull();

    const [scroller] = renderer.root.findAll(node =>
      React.isValidElement(node.props?.refreshControl),
    );
    // The sections answered; a badge still being read is not the page refreshing.
    expect(scroller.props.refreshControl.props.refreshing).toBe(false);
  });
});

describe('CustomerHomeScreen — where it leads', () => {
  it('sends the primary action to Categories', async () => {
    const { press, navigate } = await render();

    await press(COPY.primaryAction);

    expect(navigate).toHaveBeenCalledWith('Categories');
  });

  it('opens a category at its own services, not at the whole catalogue', async () => {
    const { press, navigate } = await render();

    await press(CATEGORIES[1].name);

    // The tile that was tapped, with exactly what the catalogue screen sends.
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('SubCategories', { categoryId: CATEGORIES[1].id });
    expect(navigate).not.toHaveBeenCalledWith('Categories');
  });

  it('hands Sub Categories the id and nothing it could read for itself', async () => {
    const { press, navigate } = await render();

    await press(CATEGORIES[0].name);

    // The name is the backend's to change; a route keyed on it is a link that
    // breaks the day somebody corrects a typo in the catalogue.
    const [, params] = navigate.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(params)).toEqual(['categoryId']);
    expect(JSON.stringify(params)).not.toContain(CATEGORIES[0].name);
    expect(JSON.stringify(params)).not.toContain(String(CATEGORIES[0].iconGlyph));
  });

  it('still sends "See all" to the whole catalogue', async () => {
    const { press, navigate } = await render();

    await press(`${COPY.categoriesAction} ${COPY.categoriesTitle.toLowerCase()}`);

    expect(navigate).toHaveBeenCalledWith('Categories');
  });

  it('sends the empty state action to Categories', async () => {
    const { press, navigate } = await render({ requests: async () => [] });

    await press(COPY.primaryAction);

    expect(navigate).toHaveBeenCalledWith('Categories');
  });

  it('opens a request from its card', async () => {
    const { press, navigate, byTestID } = await render();

    const [card] = byTestID('recent-request-REQ-2');
    await press(card.props.accessibilityLabel);

    // The request that was tapped, not the first one on the list.
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('RequestDetails', { requestId: 'REQ-2' });
  });

  it('hands the details screen a reference and nothing it could have read itself', async () => {
    const { press, navigate, byTestID } = await render();

    const [card] = byTestID('recent-request-REQ-1');
    await press(card.props.accessibilityLabel);

    // Not the summary: the details screen fetches the record, so what it shows
    // cannot depend on which list it was opened from.
    const [, params] = navigate.mock.calls[0];
    expect(Object.keys(params)).toEqual(['requestId']);
    expect(JSON.stringify(params)).not.toContain('Skyline Roofing');
  });
});

/**
 * Section 54's `category_selected` from Home's tiles: the same event, with the
 * same single key, that the catalogue sends — and nothing for the ways into
 * the catalogue, which open it without choosing from it.
 */
describe('CustomerHomeScreen — what analytics is told (section 54)', () => {
  let track: jest.Mock;

  beforeEach(() => {
    track = jest.fn();
    registerService('analytics', { track, identify: jest.fn() });
  });

  it('counts a tile as the category chosen, by its id alone', async () => {
    const { press } = await render();

    await press(CATEGORIES[1].name);

    expect(track).toHaveBeenCalledTimes(1);
    const [event, properties] = track.mock.calls[0];
    expect(event).toBe('category_selected');
    expect(Object.keys(properties).sort()).toEqual(['categoryId']);
    expect(properties).toEqual({ categoryId: CATEGORIES[1].id });

    const serialised = JSON.stringify(track.mock.calls);
    expect(serialised).not.toContain(CATEGORIES[1].name);
    expect(serialised).not.toContain(SESSION.user.firstName);
    expect(serialised).not.toContain(SESSION.user.phone);
  });

  it('counts nothing for "See all", the primary action, a request card or a pull', async () => {
    const { press, byTestID, pull } = await render();

    await press(`${COPY.categoriesAction} ${COPY.categoriesTitle.toLowerCase()}`);
    await press(COPY.primaryAction);
    const [card] = byTestID('recent-request-REQ-1');
    await press(card.props.accessibilityLabel);
    await pull();

    expect(track).not.toHaveBeenCalled();
  });
});

describe('CustomerHomeScreen — how it is announced', () => {
  it('names every category tile as a button, with the catalogue’s hint', async () => {
    const { renderer } = await render();

    const tiles = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props?.testID === 'string' &&
        node.props.testID.startsWith('category-tile-'),
    );

    expect(tiles).toHaveLength(CATEGORIES.length);
    for (const tile of tiles) {
      expect(tile.props.accessibilityRole).toBe('button');
      expect(CATEGORIES.map(category => category.name)).toContain(
        tile.props.accessibilityLabel,
      );
      // A tile here does what a tile on the catalogue does, so it says the same.
      expect(tile.props.accessibilityHint).toBe(CUSTOMER_COPY.categories.itemHint);
    }
  });

  it('announces a request as one thing rather than six loose fragments', async () => {
    const { renderer } = await render();

    const [card] = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props?.accessible === true &&
        typeof node.props?.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.includes('REQ-1'),
    );

    expect(card).toBeDefined();
    expect(card.props.accessibilityLabel).toContain('Roof Repair');
    expect(card.props.accessibilityLabel).toContain('In progress');
    expect(card.props.accessibilityLabel).toContain('High');
  });

  it('announces every card as something that opens, and says where', async () => {
    const { byTestID } = await render();

    for (const request of REQUESTS) {
      const [card] = byTestID(`recent-request-${request.id}`);

      expect(card.props.accessibilityRole).toBe('button');
      expect(card.props.accessibilityHint).toBe(CUSTOMER_COPY.request.openHint);
    }
  });

  it('does not announce the status badge a second time inside the card', async () => {
    const { renderer } = await render();

    // The card's own label already says the status. A badge left focusable
    // inside it is a second stop repeating one word.
    const badges = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props?.accessible === true &&
        node.props?.accessibilityLabel === 'In progress',
    );

    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) {
      expect(isHiddenFromReaders(badge)).toBe(true);
    }
  });
});

/**
 * Found on device: once loaded, the recent requests announced themselves as the
 * bare word "busy". The placeholders' view was updated into the list's rather
 * than replaced, and Android does not unset a prop that merely disappears. The
 * first fix named the region and stated its busy state on every render — which
 * left the loaded region labelled with its section's title, a TalkBack stop
 * that says the heading again. Now the loading region and the loaded one are
 * different views (different keys): only the loading one is named and busy, and
 * the loaded one is a new host view with no name, role or state to inherit.
 */
describe('CustomerHomeScreen — how its sections are announced in every state', () => {
  /** A read the test answers when it chooses. */
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(settle => {
      resolve = settle;
    });
    return { promise, resolve };
  }

  /** A loaded region: no name, no role and no state — the heading above names it. */
  function expectUnannounced(region: ReactTestRenderer.ReactTestInstance) {
    expect(region.props.accessibilityLabel).toBeUndefined();
    expect(region.props.accessibilityRole).toBeUndefined();
    expect(region.props.accessibilityState).toBeUndefined();
  }

  it('replaces the busy region with a new, unnamed one when the cards arrive', async () => {
    const categoriesRead = deferred<ServiceCategory[]>();
    const requestsRead = deferred<CustomerRequest[]>();
    const { byTestID } = await render({
      categories: () => categoriesRead.promise,
      requests: () => requestsRead.promise,
    });

    const [loadingRecent] = byTestID('home-recent-list');
    const [loadingGrid] = byTestID('home-category-grid');
    expect(loadingRecent.props.accessibilityState).toEqual({ busy: true });
    expect(loadingGrid.props.accessibilityState).toEqual({ busy: true });

    await act(async () => {
      categoriesRead.resolve(CATEGORIES);
      requestsRead.resolve(REQUESTS);
    });

    const [recent] = byTestID('home-recent-list');
    const [grid] = byTestID('home-category-grid');

    // A different host view, not the loading one updated in place — so there is
    // no native view left holding the old `busy`, whatever the platform does
    // with a prop that disappears.
    expect(recent).not.toBe(loadingRecent);
    expect(grid).not.toBe(loadingGrid);
    expectUnannounced(recent);
    expectUnannounced(grid);
    expect(byTestID('recent-request-REQ-1').length).toBeGreaterThan(0);
  });

  it('is not its own stop, nor busy, when it is empty or has failed', async () => {
    const failure = new AppError({ kind: 'network', message: 'ECONNREFUSED' });
    const { byTestID } = await render({
      categories: async () => [],
      requests: async () => {
        throw failure;
      },
    });

    const [recent] = byTestID('home-recent-list');
    const [grid] = byTestID('home-category-grid');

    expect(byTestID('home-recent-list-error')).toHaveLength(1);
    expectUnannounced(recent);
    expect(byTestID('home-category-grid-empty')).toHaveLength(1);
    expectUnannounced(grid);
  });

  it('names the wait again, busy, on a new host view when Try again reads from the start', async () => {
    const failure = new AppError({ kind: 'network', message: 'ECONNREFUSED' });
    const retried = deferred<CustomerRequest[]>();
    let calls = 0;
    const { byTestID, press } = await render({
      requests: () => {
        calls += 1;
        return calls === 1 ? Promise.reject(failure) : retried.promise;
      },
    });

    const [failed] = byTestID('home-recent-list');
    expectUnannounced(failed);

    await press('Try again');

    const [waiting] = byTestID('home-recent-list');
    expect(waiting).not.toBe(failed);
    expect(waiting.props.accessibilityLabel).toBe(COPY.recentLoadingLabel);
    expect(waiting.props.accessibilityState).toEqual({ busy: true });

    await act(async () => {
      retried.resolve(REQUESTS);
    });

    const [loaded] = byTestID('home-recent-list');
    expect(loaded).not.toBe(waiting);
    expectUnannounced(loaded);
  });

  it('gives no placeholder a role or a name of its own', async () => {
    const { renderer } = await render({ categories: pending, requests: pending });

    // The old placeholder views were progress bars; the role would have been
    // the next prop left behind on the loaded list.
    const progress = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.accessibilityRole === 'progressbar',
    );
    expect(progress).toHaveLength(0);
  });
});

/** Whether something above this node takes it out of the accessibility tree. */
function isHiddenFromReaders(node: ReactTestRenderer.ReactTestInstance): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if (current.props?.importantForAccessibility === 'no-hide-descendants') {
      return true;
    }
  }
  return false;
}

describe('CustomerHomeScreen — how its request cards are announced', () => {
  it('keeps the whole request in the card label', async () => {
    const { byTestID } = await render();

    const [card] = byTestID('recent-request-REQ-2');

    expect(card.props.accessibilityLabel).toContain('Glazing');
    expect(card.props.accessibilityLabel).toContain('REQ-2');
  });

  it('words a waiting request by which wait it is, as the details screen does', async () => {
    const STATUS = CUSTOMER_COPY.requestStatus;
    const { byTestID } = await render({
      requests: async () => [
        // Nobody chosen: open dispatch, so Fixora is searching.
        { ...REQUESTS[1], id: 'REQ-OPEN' },
        // Somebody chosen and not yet answered.
        {
          ...REQUESTS[1],
          id: 'REQ-DIRECTED',
          preferredVendor: { id: 'ven_clear_view', name: 'Clear View Glazing' },
        },
      ],
    });

    const [open] = byTestID('recent-request-REQ-OPEN');
    const [directed] = byTestID('recent-request-REQ-DIRECTED');

    // The same wording the details screen's table owns — not a second copy.
    expect(open.props.accessibilityLabel).toContain(STATUS.searching.label);
    expect(directed.props.accessibilityLabel).toContain(STATUS.awaiting_vendor.label);
    // Waiting is not assigned, whoever was asked for.
    expect(directed.props.accessibilityLabel).not.toContain('Clear View Glazing');
  });

  it('shows a status it does not know as unavailable, not as a raw constant', async () => {
    const { text } = await render({
      requests: async () => [{ ...REQUESTS[0], status: 'ESCALATED_TO_REGION' }],
    });

    expect(text()).toContain(CUSTOMER_COPY.requestStatus.unknown.label);
    expect(text()).not.toContain('ESCALATED_TO_REGION');
  });

  it('does not read the decorative avatar out over the name beside it', async () => {
    const { renderer } = await render();

    const [avatar] = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.testID === 'home-greeting-avatar',
    );

    expect(avatar).toBeDefined();

    const hidden = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props?.accessibilityElementsHidden === true &&
        node.props?.importantForAccessibility === 'no-hide-descendants',
    );

    expect(hidden.length).toBeGreaterThan(0);
  });
});

describe('CustomerHomeScreen — an unfinished request', () => {
  const ADDRESS = { formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095' };

  /** Details and an address answered; the vendor question still open. */
  const DRAFT = {
    categoryId: CATEGORIES[0].id,
    subCategoryId: 'sub_fan',
    values: { priority: 'HIGH', preferredDate: '', preferredTime: '', notes: 'It rattles.' },
    imageUrls: [],
    address: ADDRESS,
    vendor: { kind: 'none' as const },
  };

  it('offers nothing when there is nothing to resume', async () => {
    const { byTestID } = await render();

    expect(byTestID('home-resume')).toHaveLength(0);
  });

  /** Every answer the form can clear, cleared. */
  const EMPTIED = {
    values: { priority: '', preferredDate: '', preferredTime: '', notes: '' },
    imageUrls: [],
    address: null,
    vendor: { kind: 'none' as const },
  };

  /** The draft context Home reads, held the way the request form holds it. */
  function draftProbe() {
    const handle: { current: ReturnType<typeof useRequestDraft> | null } = { current: null };
    function Probe() {
      handle.current = useRequestDraft();
      return null;
    }
    return { handle, probe: <Probe /> };
  }

  it('stops offering a request once every answer in it has been cleared', async () => {
    savedDraft = { draft: DRAFT, savedAt: new Date().toISOString() };
    const { handle, probe } = draftProbe();
    const { byTestID, text } = await render({ probe });
    expect(byTestID('home-resume').length).toBeGreaterThan(0);

    // What the form does as the customer clears what they had answered.
    await act(async () => {
      handle.current!.updateDraft(EMPTIED);
    });

    // Still held — the form that emptied it may still be writing to it — but
    // not something to come back to.
    expect(handle.current!.draft).not.toBeNull();
    expect(byTestID('home-resume')).toHaveLength(0);
    expect(text()).not.toContain(CUSTOMER_COPY.home.resumeTitle);

    // One answer given again, and it is a request worth coming back to.
    await act(async () => {
      handle.current!.updateDraft({ values: { ...EMPTIED.values, notes: 'It rattles.' } });
    });
    expect(byTestID('home-resume').length).toBeGreaterThan(0);
  });

  it('offers nothing for a draft with nothing in it, however it arrived', async () => {
    savedDraft = { draft: { ...DRAFT, ...EMPTIED }, savedAt: new Date().toISOString() };

    const { byTestID, text } = await render();

    expect(byTestID('home-resume')).toHaveLength(0);
    expect(text()).not.toContain(CUSTOMER_COPY.home.resumeTitle);
  });

  it('offers to continue a request that was left behind', async () => {
    savedDraft = { draft: DRAFT, savedAt: new Date().toISOString() };

    const { byTestID, text } = await render();

    expect(byTestID('home-resume').length).toBeGreaterThan(0);
    expect(text()).toContain(CUSTOMER_COPY.home.resumeTitle);
    // Named by its category, so it is obvious which request is waiting.
    expect(text()).toContain(CATEGORIES[0].name);
  });

  it('puts the customer back where they stopped, with the way back intact', async () => {
    savedDraft = { draft: DRAFT, savedAt: new Date().toISOString() };

    const { press, reset } = await render();

    await press(`${CUSTOMER_COPY.home.resumeTitle}. ${CATEGORIES[0].name} · Just now`);

    const [args] = reset.mock.calls[0];
    expect(args.routes.map((route: { name: string }) => route.name)).toEqual([
      'CustomerTabs',
      'CreateRequest',
      'ServiceAddress',
      'PreferredVendor',
    ]);
    // Only identifiers travel; the notes, photos and the address itself stay on
    // the draft. An address in navigation params is an address in devtools.
    expect(Object.keys(args.routes[3].params).sort()).toEqual(['categoryId', 'subCategoryId']);
  });

  it('resumes at the address when that is the step still missing', async () => {
    savedDraft = {
      draft: { ...DRAFT, address: null, vendor: { kind: 'open' as const } },
      savedAt: new Date().toISOString(),
    };

    const { press, reset } = await render();

    await press(`${CUSTOMER_COPY.home.resumeTitle}. ${CATEGORIES[0].name} · Just now`);

    // The vendor question is answered and the address is not, so the flow stops
    // at the address rather than running past it to the summary.
    expect(reset.mock.calls[0][0].routes.map((route: { name: string }) => route.name)).toEqual([
      'CustomerTabs',
      'CreateRequest',
      'ServiceAddress',
    ]);
  });

  it('resumes at the details when the urgency was never answered', async () => {
    savedDraft = {
      draft: { ...DRAFT, values: { ...DRAFT.values, priority: '' } },
      savedAt: new Date().toISOString(),
    };

    const { press, reset } = await render();

    await press(`${CUSTOMER_COPY.home.resumeTitle}. ${CATEGORIES[0].name} · Just now`);

    expect(reset.mock.calls[0][0].routes.map((route: { name: string }) => route.name)).toEqual([
      'CustomerTabs',
      'CreateRequest',
    ]);
  });

  it('resumes at the summary when everything has been answered', async () => {
    savedDraft = {
      draft: { ...DRAFT, vendor: { kind: 'open' as const } },
      savedAt: new Date().toISOString(),
    };

    const { press, reset } = await render();

    await press(`${CUSTOMER_COPY.home.resumeTitle}. ${CATEGORIES[0].name} · Just now`);

    expect(reset.mock.calls[0][0].routes.map((route: { name: string }) => route.name)).toEqual([
      'CustomerTabs',
      'CreateRequest',
      'ServiceAddress',
      'PreferredVendor',
      'RequestConfirmation',
    ]);
  });
});

/**
 * What Home shows once the app has been closed and opened again: the requests
 * the customer raised before, read back by a new service, newest first — and no
 * more of them than Home has ever shown.
 */
describe('CustomerHomeScreen — requests raised before a restart', () => {
  it('lists them newest first, within the same limit', async () => {
    await AsyncStorage.clear();

    const launch = () =>
      new MockRequestService({
        latency: NO_LATENCY,
        history: new AsyncStorageMockRequestHistory(),
        currentCustomerId: async () => SESSION.user.id,
      });

    const before = launch();
    const first = await before.createRequest({
      categoryId: 'cat_carpenter',
      subCategoryId: 'sub_door_repair',
      priority: 'MEDIUM',
      address: { formattedAddress: '17 Cross Lane, Devanahalli, Bengaluru 562110' },
    });
    const second = await before.createRequest({
      categoryId: 'cat_electrician',
      subCategoryId: 'sub_fan_repair',
      priority: 'HIGH',
      address: { formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095' },
    });

    // The app closes and opens: Home reads from a brand-new service.
    const restarted = launch();
    const { renderer, listRecentRequests } = await render({
      requests: limit => restarted.listRecentRequests(limit),
    });
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });

    const cards = [
      ...new Set(
        renderer.root
          .findAll(
            node =>
              typeof node.type === 'string' &&
              typeof node.props?.testID === 'string' &&
              /^recent-request-REQ-\d+$/.test(node.props.testID),
          )
          .map(node => node.props.testID as string),
      ),
    ];

    expect(cards).toEqual([
      `recent-request-${second.id}`,
      `recent-request-${first.id}`,
      'recent-request-REQ-24081',
    ]);
    expect(cards).toHaveLength(HOME_RECENT_REQUEST_LIMIT);
    expect(listRecentRequests).toHaveBeenCalledWith(HOME_RECENT_REQUEST_LIMIT);
  });
});

/**
 * A request cancelled on Request Details (owner decision, 21/10/2026). Home
 * stays mounted under it, so it is told (`customerRequestSync`) and reads its
 * recent requests again — or the card would come back still saying
 * "Searching".
 */
describe('CustomerHomeScreen — a request changed on Request Details', () => {
  it('reads its recent requests again, and only those', async () => {
    const { listRecentRequests, listServiceCategories } = await render();

    await act(async () => {
      customerRequestsChanged();
    });

    expect(listRecentRequests).toHaveBeenCalledTimes(2);
    expect(listRecentRequests).toHaveBeenLastCalledWith(HOME_RECENT_REQUEST_LIMIT);
    // A cancellation does not change the catalogue.
    expect(listServiceCategories).toHaveBeenCalledTimes(1);
  });

  it('reads from the start under placeholders when the section had nothing to show', async () => {
    let answer!: (requests: CustomerRequest[]) => void;
    const requests = jest
      .fn<Promise<CustomerRequest[]>, [number]>()
      .mockRejectedValueOnce(new AppError({ kind: 'network', message: 'offline' }))
      .mockImplementationOnce(
        () =>
          new Promise<CustomerRequest[]>(resolve => {
            answer = resolve;
          }),
      );
    const { byTestID } = await render({ requests });
    expect(byTestID('home-recent-list-error')).toHaveLength(1);

    await act(async () => {
      customerRequestsChanged();
    });

    // Never "no requests yet" drawn over the read that may find some.
    expect(byTestID('home-recent-list-empty')).toHaveLength(0);
    expect(byTestID('home-recent-list-loading')).toHaveLength(1);

    await act(async () => {
      answer(REQUESTS);
    });

    expect(byTestID('recent-request-REQ-1').length).toBeGreaterThan(0);
  });

  it('shows a cancelled request as cancelled, against the mock', async () => {
    const service = new MockRequestService({ latency: NO_LATENCY });
    const { byTestID } = await render({ requests: limit => service.listRecentRequests(limit) });
    await act(async () => {});

    const label = () =>
      byTestID('recent-request-REQ-24081')[0]?.props.accessibilityLabel as string | undefined;
    expect(label()).toContain(CUSTOMER_COPY.requestStatus.awaiting_vendor.label);

    // What Request Details does: the service cancels, and the lists are told.
    await service.cancelRequest('REQ-24081');
    await act(async () => {
      customerRequestsChanged();
    });
    await act(async () => {});

    expect(label()).toContain(CUSTOMER_COPY.requestStatus.cancelled.label);
  });
});
