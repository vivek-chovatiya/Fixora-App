/**
 * My Requests is section 23's screen, and these tests pin what section 23 and
 * the owner decided it must do — and what it must not:
 *
 * - it reads pages from `RequestService`, newest first as the service returns
 *   them, and adds nothing of its own: no sorting, no filtering, no storage
 * - the next page is asked for, and while it loads, fails or is retried the
 *   requests already shown stay shown; a page is never skipped or asked for twice
 *   at once, and a request repeated across pages is listed once
 * - section 23's four filters go to the service by name, and each starts the
 *   list again from its first page
 * - every state has a way forward: placeholders, a failure with a retry that
 *   really reads again, section 48's empty state, and a quieter one per filter
 * - a card opens Request Details with a reference and nothing else, and says
 *   the status in the words the details screen uses — including which wait a
 *   waiting request is in, off-path statuses and ones the app does not know
 * - shown again (the tab, or coming back from a request), it reads once more,
 *   quietly — not on arrival, never beside a read already out, with no
 *   placeholders and no spinner, the filter and the rows kept, every page on
 *   screen in one request — and a quiet read that fails keeps the rows
 *   (owner decision, 21/10/2026, Phase 3E-15)
 *
 * The fixture shares no names with the mock seed, so what passes has passed on
 * what the service returned.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContext } from '@react-navigation/native';

import { AppConfig } from '@/core/config/AppConfig';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { MyRequestsScreen } from '@/features/customer/screens/MyRequestsScreen';
import { customerRequestsChanged } from '@/features/customer/state/customerRequestSync';
import { AsyncStorageMockRequestHistory } from '@/shared/services/mock/MockRequestHistoryStorage';
import { MockRequestService } from '@/shared/services/mock/MockRequestService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type {
  CustomerRequest,
  RequestHistoryFilter,
  RequestService,
} from '@/shared/services/types/RequestService';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';
import { toPage, type Page, type PageRequest } from '@/shared/types/pagination';

const COPY = CUSTOMER_COPY.myRequests;
const HOME = CUSTOMER_COPY.home;
const STATUS = CUSTOMER_COPY.requestStatus;
const PAGE_SIZE = AppConfig.pagination.defaultPageSize;

/** One more than a page, so there is always a second one to ask for. */
const REQUESTS: CustomerRequest[] = Array.from({ length: PAGE_SIZE + 5 }, (_, index) => ({
  id: `REQ-${String(index + 1).padStart(3, '0')}`,
  reference: `REQ-${String(index + 1).padStart(3, '0')}`,
  serviceName: `Gutter Cleaning ${index + 1}`,
  status: 'IN_PROGRESS',
  priority: 'MEDIUM',
  vendorName: 'Skyline Roofing',
  createdAt: new Date(Date.now() - (index + 1) * 60 * 60_000).toISOString(),
}));

function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

/** A promise the test settles when it chooses. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

const failure = () =>
  new AppError({ kind: 'network', message: 'AxiosError: connect ECONNREFUSED 10.0.2.2:8080' });

/** Pages the fixture the way a backend would, the filter ignored unless given. */
const pageOf =
  (all: CustomerRequest[] = REQUESTS) =>
  async (_filter: RequestHistoryFilter, request: PageRequest): Promise<Page<CustomerRequest>> =>
    toPage(all, request);

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  // Unmounted so placeholders do not keep animating after the test.
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  resetServices();
});

type ListRequests = (
  filter: RequestHistoryFilter,
  request: PageRequest,
) => Promise<Page<CustomerRequest>>;

/**
 * Just enough of the tab's navigation object for focus: whether it is focused,
 * and listeners the test fires as the tab bar would when another tab is chosen
 * (blur) and this one again (focus). The screen's own `navigation` prop stays
 * the plain stub — focus is read from the context, as `useNavigationEvent` does.
 */
function fakeFocus() {
  const listeners: Record<'focus' | 'blur', Array<() => void>> = { focus: [], blur: [] };
  let focused = true;

  return {
    context: {
      isFocused: () => focused,
      addListener: (event: 'focus' | 'blur', listener: () => void) => {
        listeners[event] = [...listeners[event], listener];
        return () => {
          listeners[event] = listeners[event].filter(entry => entry !== listener);
        };
      },
    },
    /** Another tab, then this one again. */
    leaveAndReturn: async () => {
      await act(async () => {
        focused = false;
        listeners.blur.forEach(listener => listener());
      });
      await act(async () => {
        focused = true;
        listeners.focus.forEach(listener => listener());
      });
    },
    /** A focus event with no blur before it, as a navigator can send on arrival. */
    focusAgain: async () => {
      await act(async () => {
        listeners.focus.forEach(listener => listener());
      });
    },
  };
}

type FakeFocus = ReturnType<typeof fakeFocus>;

async function render(listRequests: ListRequests = pageOf(), focus?: FakeFocus) {
  const list = jest.fn(listRequests);

  registerService('request', {
    listRequests: list,
    listRecentRequests: jest.fn(() => {
      throw new Error('listRecentRequests is Home’s, not My Requests’');
    }),
    // A card hands over a reference; the details screen does the reading.
    getRequest: jest.fn(() => {
      throw new Error('getRequest must not be called from My Requests');
    }),
    createRequest: jest.fn(() => {
      throw new Error('createRequest must never be called from My Requests');
    }),
    // Section 23 gives a card no actions; only a request's details may cancel it.
    cancelRequest: jest.fn(() => {
      throw new Error('cancelRequest must never be called from My Requests');
    }),
  } as RequestService);

  return { ...(await mount(focus)), list };
}

async function mount(focus?: FakeFocus) {
  const navigate = jest.fn();
  const navigation = { navigate } as never;
  const route = { key: 'Requests', name: 'Requests' as const, params: undefined } as never;

  const screen = <MyRequestsScreen navigation={navigation} route={route} />;
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        {focus ? (
          <NavigationContext.Provider value={focus.context as never}>{screen}</NavigationContext.Provider>
        ) : (
          screen
        )}
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  const hosts = (id: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id);

  /**
   * Every request in the list, in order, by reference.
   *
   * Read from the list's own data rather than from what is drawn: a FlatList
   * draws only its first rows until it is scrolled, so counting drawn cards
   * would under-count a full page.
   */
  const cards = (): string[] => {
    const [list] = renderer.root.findAll(
      node => node.props?.testID === 'my-requests-list' && Array.isArray(node.props?.data),
    );
    return (list?.props.data ?? []).map((request: CustomerRequest) => request.id);
  };

  /**
   * The testID of every native view on screen that says it is busy.
   *
   * Ids, not the nodes: a failed match on a test instance makes jest print it,
   * and printing one walks the whole fiber tree — the run never finishes.
   */
  const busy = (): Array<string | undefined> =>
    renderer.root
      .findAll(
        node => typeof node.type === 'string' && node.props?.accessibilityState?.busy === true,
      )
      .map(node => node.props.testID);

  /** Presses a card the way a finger does: the button it draws, not its props. */
  const open = async (requestId: string) => {
    const [card] = renderer.root.findAll(
      node =>
        node.props?.testID === `my-request-${requestId}` &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    );
    await act(async () => {
      card.props.onPress();
    });
  };

  const pressable = (role: string, label: string) =>
    renderer.root.find(
      node =>
        node.props?.accessibilityRole === role &&
        node.props?.accessibilityLabel === label &&
        typeof node.props?.onPress === 'function',
    );

  const settle = () =>
    act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });

  return {
    renderer,
    navigate,
    hosts,
    cards,
    busy,
    open,
    settle,
    text: () => textOf(renderer.toJSON()),
    buttons: () =>
      renderer.root
        .findAll(
          node =>
            node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function',
        )
        .map(node => node.props.accessibilityLabel as string),
    press: async (label: string) => {
      const target = pressable('button', label);
      await act(async () => {
        target.props.onPress();
      });
      await settle();
    },
    choose: async (label: string) => {
      const target = pressable('radio', label);
      await act(async () => {
        target.props.onPress();
      });
      await settle();
    },
    pull: async () => {
      const [scroller] = renderer.root.findAll(node => typeof node.props?.onRefresh === 'function');
      await act(async () => {
        scroller.props.onRefresh();
      });
      await settle();
    },
    canPull: () =>
      renderer.root.findAll(node => typeof node.props?.onRefresh === 'function').length > 0,
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

describe('MyRequestsScreen — the list', () => {
  it('is named My Requests, as a heading', async () => {
    const { hosts } = await render();

    const [heading] = hosts('my-requests-heading');

    expect(heading.props.children).toBe(COPY.title);
    expect(heading.props.accessibilityRole).toBe('header');
  });

  it('asks for the first page of every request', async () => {
    const { list } = await render();

    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith('all', { page: 1, pageSize: PAGE_SIZE });
  });

  it('shows the requests in the order the service returned them', async () => {
    const { cards } = await render();

    expect(cards()).toEqual(REQUESTS.slice(0, PAGE_SIZE).map(request => request.id));
  });

  it('holds the page’s shape while the first page is on its way, and says so once', async () => {
    const { hosts, renderer, cards, busy } = await render(() => pending());

    const [list] = hosts('my-requests-list');

    expect(cards()).toEqual([]);
    // One region says the wait once, named and busy — not the list itself.
    const [region] = hosts('my-requests-loading');
    expect(region.props.accessibilityLabel).toBe(COPY.loadingLabel);
    expect(region.props.accessibilityState).toEqual({ busy: true });
    expect(busy()).toEqual(['my-requests-loading']);
    expect(list.props.accessibilityLabel).toBeUndefined();
    expect(list.props.accessibilityState).toBeUndefined();
    expect(list.props.accessibilityRole).toBeUndefined();
    // The heading and the filters are there before anything has loaded.
    expect(hosts('my-requests-heading')).toHaveLength(1);
    expect(hosts('my-requests-filters')).toHaveLength(1);
    // Placeholders, not a spinner over a blank page.
    expect(
      renderer.root.findAll(node => node.props?.radiusToken === 'lg' && node.props?.height),
    ).not.toHaveLength(0);
  });

  it('replaces the busy region once the first page lands, and leaves the list unnamed', async () => {
    // The list used to be named on every render — "Loading your requests", then
    // "Your requests" — so loaded, TalkBack stopped on it to say what the
    // heading had just said. Now the wait is its own region, and it is gone,
    // not updated, when the requests arrive.
    const first = deferred<Page<CustomerRequest>>();
    const { hosts, cards, busy } = await render(() => first.promise);

    const [waiting] = hosts('my-requests-loading');
    expect(waiting.props.accessibilityState).toEqual({ busy: true });

    await act(async () => {
      first.resolve(toPage(REQUESTS, { page: 1, pageSize: PAGE_SIZE }));
    });

    expect(cards()).toHaveLength(PAGE_SIZE);
    // Not hidden or emptied: no longer in the tree at all, so its busy cannot outlive it.
    expect(hosts('my-requests-loading')).toHaveLength(0);
    const [list] = hosts('my-requests-list');
    expect(list === waiting).toBe(false);
    expect(list.props.accessibilityLabel).toBeUndefined();
    expect(list.props.accessibilityState).toBeUndefined();
    expect(list.props.accessibilityRole).toBeUndefined();
    // Nothing anywhere on the loaded screen still says busy.
    expect(busy()).toEqual([]);
  });

  it('says the wait again when a view is chosen, and replaces it when the view arrives', async () => {
    const active = deferred<Page<CustomerRequest>>();
    const list: ListRequests = async (filter, request) =>
      filter === 'active' ? active.promise : pageOf()(filter, request);
    const { choose, hosts, busy } = await render(list);
    expect(busy()).toEqual([]);

    await choose(COPY.filterActive);

    expect(hosts('my-requests-loading')).toHaveLength(1);
    expect(busy()).toEqual(['my-requests-loading']);

    await act(async () => {
      active.resolve(toPage(REQUESTS.slice(0, 2), { page: 1, pageSize: PAGE_SIZE }));
    });

    expect(hosts('my-requests-loading')).toHaveLength(0);
    expect(busy()).toEqual([]);
  });
});

describe('MyRequestsScreen — the next page', () => {
  it('offers more while there is more, and loads the next page when asked', async () => {
    const { buttons, press, list, cards } = await render();

    expect(buttons()).toContain(COPY.showMore);

    await press(COPY.showMore);

    expect(list).toHaveBeenLastCalledWith('all', { page: 2, pageSize: PAGE_SIZE });
    expect(cards()).toEqual(REQUESTS.map(request => request.id));
  });

  it('offers no more once the last page has arrived', async () => {
    const { buttons, press, list } = await render();

    await press(COPY.showMore);

    expect(buttons()).not.toContain(COPY.showMore);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('offers no more when the first page was the only one', async () => {
    const { buttons } = await render(pageOf(REQUESTS.slice(0, 3)));

    expect(buttons()).not.toContain(COPY.showMore);
  });

  it('keeps what is shown while the next page loads, and says it is loading', async () => {
    const next = deferred<Page<CustomerRequest>>();
    const list: ListRequests = async (filter, request) =>
      request.page === 1 ? pageOf()(filter, request) : next.promise;

    const { press, cards, renderer, buttons } = await render(list);

    await press(COPY.showMore);

    expect(cards()).toHaveLength(PAGE_SIZE);
    const loaders = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props?.accessibilityRole === 'progressbar' &&
        node.props?.accessibilityLabel === COPY.loadingMoreLabel,
    );
    expect(loaders).toHaveLength(1);
    // Nothing to press twice while it is on its way.
    expect(buttons()).not.toContain(COPY.showMore);

    await act(async () => {
      next.resolve(toPage(REQUESTS, { page: 2, pageSize: PAGE_SIZE }));
    });

    expect(cards()).toHaveLength(REQUESTS.length);
  });

  it('asks for the next page once, however quickly it is asked for twice', async () => {
    const next = deferred<Page<CustomerRequest>>();
    const list = jest.fn<ReturnType<ListRequests>, Parameters<ListRequests>>(
      async (filter, request) => (request.page === 1 ? pageOf()(filter, request) : next.promise),
    );

    const { renderer } = await render(list);

    const showMore = renderer.root.find(
      node =>
        node.props?.accessibilityLabel === COPY.showMore && typeof node.props?.onPress === 'function',
    );
    await act(async () => {
      showMore.props.onPress();
      showMore.props.onPress();
    });

    expect(list.mock.calls.filter(([, request]) => request.page === 2)).toHaveLength(1);
  });

  it('lists a request once when two pages both carry it', async () => {
    // A request raised between the two reads shifts the second page by one.
    const list: ListRequests = async (_filter, request) =>
      request.page === 1
        ? toPage(REQUESTS, request)
        : { ...toPage(REQUESTS, request), items: [REQUESTS[PAGE_SIZE - 1], ...REQUESTS.slice(PAGE_SIZE)] };

    const { press, cards } = await render(list);

    await press(COPY.showMore);

    expect(cards()).toEqual(REQUESTS.map(request => request.id));
  });

  it('keeps the requests shown when the next page fails, and says the next page failed', async () => {
    const list: ListRequests = async (filter, request) => {
      if (request.page === 2) {
        throw failure();
      }
      return pageOf()(filter, request);
    };

    const { press, cards, hosts, text } = await render(list);

    await press(COPY.showMore);

    expect(cards()).toHaveLength(PAGE_SIZE);
    expect(hosts('my-requests-more-error')).toHaveLength(1);
    expect(hosts('my-requests-error')).toHaveLength(0);
    expect(text()).toContain(COPY.moreFailedTitle);
    expect(text()).not.toContain('ECONNREFUSED');
  });

  it('retries the page that failed — not the first — and carries on from there', async () => {
    const list = jest
      .fn<ReturnType<ListRequests>, Parameters<ListRequests>>()
      .mockImplementationOnce(pageOf())
      .mockRejectedValueOnce(failure())
      .mockImplementation(pageOf());

    const { press, cards, hosts } = await render(list);

    await press(COPY.showMore);
    await press('Try again');

    expect(list.mock.calls.map(([, request]) => request.page)).toEqual([1, 2, 2]);
    expect(cards()).toEqual(REQUESTS.map(request => request.id));
    expect(hosts('my-requests-more-error')).toHaveLength(0);
  });
});

describe('MyRequestsScreen — the filters', () => {
  it('puts them on one row that scrolls sideways, with no scroll indicator (T134)', async () => {
    const { hosts } = await render();

    const [group] = hosts('my-requests-filters');
    expect(group.props.horizontal).toBe(true);
    expect(group.props.showsHorizontalScrollIndicator).toBe(false);
    // Every chip is in that one row.
    expect(
      group.findAll(
        node => node.props?.accessibilityRole === 'radio' && typeof node.props?.onPress === 'function',
      ),
    ).toHaveLength(4);
  });

  it('offers section 23’s four, as one choice, with All chosen', async () => {
    const { hosts, renderer } = await render();

    const [group] = hosts('my-requests-filters');
    const chips = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props?.accessibilityRole === 'radio' &&
        typeof node.props?.testID === 'string',
    );

    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityLabel).toBe(COPY.filtersLabel);
    expect(chips.map(chip => chip.props.accessibilityLabel)).toEqual([
      COPY.filterAll,
      COPY.filterActive,
      COPY.filterCompleted,
      COPY.filterCancelled,
    ]);
    expect(chips.map(chip => chip.props.accessibilityState.selected)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it('asks the service for a view by name, from its first page', async () => {
    const { choose, list, press } = await render();

    await press(COPY.showMore);
    await choose(COPY.filterCompleted);

    expect(list).toHaveBeenLastCalledWith('completed', { page: 1, pageSize: PAGE_SIZE });
  });

  it('shows only what the service returned for the view, never the last view’s requests', async () => {
    const list: ListRequests = async (filter, request) =>
      filter === 'cancelled'
        ? toPage([{ ...REQUESTS[3], status: 'CANCELLED' }], request)
        : pageOf()(filter, request);

    const { choose, cards } = await render(list);

    await choose(COPY.filterCancelled);

    expect(cards()).toEqual([REQUESTS[3].id]);
  });

  it('answers the latest choice when the choices come faster than the answers', async () => {
    const slowActive = deferred<Page<CustomerRequest>>();
    const list: ListRequests = async (filter, request) => {
      if (filter === 'active') {
        return slowActive.promise;
      }
      if (filter === 'completed') {
        return toPage([{ ...REQUESTS[7], status: 'COMPLETED' }], request);
      }
      return pageOf()(filter, request);
    };

    const { choose, cards } = await render(list);

    await choose(COPY.filterActive);
    await choose(COPY.filterCompleted);
    // The slower, older answer lands last and is ignored.
    await act(async () => {
      slowActive.resolve(toPage(REQUESTS, { page: 1, pageSize: PAGE_SIZE }));
    });

    expect(cards()).toEqual([REQUESTS[7].id]);
  });

  it('shows a failed view as a failure, not as the last view’s requests', async () => {
    const list: ListRequests = async (filter, request) => {
      if (filter === 'active') {
        throw failure();
      }
      return pageOf()(filter, request);
    };

    const { choose, cards, hosts } = await render(list);

    await choose(COPY.filterActive);

    expect(cards()).toEqual([]);
    expect(hosts('my-requests-error')).toHaveLength(1);
  });

  it('says a view with nothing in it is empty, and offers nothing to fix', async () => {
    const list: ListRequests = async (filter, request) =>
      filter === 'completed' ? toPage([], request) : pageOf()(filter, request);

    const { choose, text, hosts, buttons } = await render(list);

    await choose(COPY.filterCompleted);

    expect(hosts('my-requests-empty')).toHaveLength(1);
    expect(text()).toContain(COPY.emptyCompletedTitle);
    expect(text()).not.toContain(HOME.recentEmptyTitle);
    expect(buttons()).not.toContain(HOME.primaryAction);
  });
});

describe('MyRequestsScreen — with nothing to show', () => {
  it('uses section 48’s words when there are no requests at all, and leads to a new one', async () => {
    const { text, press, navigate, hosts, busy } = await render(pageOf([]));

    expect(text()).toContain(HOME.recentEmptyTitle);
    // Its own words, under a list that is still no stop of its own.
    expect(hosts('my-requests-loading')).toHaveLength(0);
    const [list] = hosts('my-requests-list');
    expect(list.props.accessibilityLabel).toBeUndefined();
    expect(list.props.accessibilityState).toBeUndefined();
    expect(busy()).toEqual([]);

    await press(HOME.primaryAction);

    expect(navigate).toHaveBeenCalledWith('Categories');
  });

  it('shows the safe message when the first page fails, and never the developer one', async () => {
    const { hosts, text, cards, busy } = await render(async () => {
      throw failure();
    });

    expect(hosts('my-requests-error')).toHaveLength(1);
    expect(text()).toContain(failure().userMessage);
    expect(text()).not.toContain('ECONNREFUSED');
    expect(cards()).toEqual([]);
    // The heading and filters are still there to orient by.
    expect(hosts('my-requests-heading')).toHaveLength(1);
    // Its own words, under a list that is still no stop of its own.
    expect(hosts('my-requests-loading')).toHaveLength(0);
    const [list] = hosts('my-requests-list');
    expect(list.props.accessibilityLabel).toBeUndefined();
    expect(list.props.accessibilityState).toBeUndefined();
    expect(busy()).toEqual([]);
  });

  it('retries by reading the first page again, and shows it when it arrives', async () => {
    const list = jest
      .fn<ReturnType<ListRequests>, Parameters<ListRequests>>()
      .mockRejectedValueOnce(failure())
      .mockImplementation(pageOf());

    const { press, cards, hosts } = await render(list);

    await press('Try again');

    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenLastCalledWith('all', { page: 1, pageSize: PAGE_SIZE });
    expect(cards()).toHaveLength(PAGE_SIZE);
    expect(hosts('my-requests-error')).toHaveLength(0);
  });

  it('offers no pull over a failure with nothing behind it — the retry is right there', async () => {
    const { canPull } = await render(async () => {
      throw failure();
    });

    expect(canPull()).toBe(false);
  });
});

describe('MyRequestsScreen — pulling to refresh', () => {
  it('reads the first page again and shows it in the service’s order, once each', async () => {
    let answers = 0;
    const fresh: CustomerRequest = { ...REQUESTS[0], id: 'REQ-NEW', createdAt: new Date().toISOString() };
    const list = jest.fn<ReturnType<ListRequests>, Parameters<ListRequests>>(async (_filter, request) => {
      answers += 1;
      return toPage(answers === 1 ? REQUESTS : [fresh, ...REQUESTS], request);
    });

    const { pull, cards } = await render(list);

    await pull();

    expect(list).toHaveBeenLastCalledWith('all', { page: 1, pageSize: PAGE_SIZE });
    const shown = cards();
    expect(shown[0]).toBe('REQ-NEW');
    expect(new Set(shown).size).toBe(shown.length);
    expect(shown).toHaveLength(PAGE_SIZE);
  });

  it('keeps the list when a refresh fails, and retries the refresh', async () => {
    const list = jest
      .fn<ReturnType<ListRequests>, Parameters<ListRequests>>()
      .mockImplementationOnce(pageOf())
      .mockRejectedValueOnce(failure())
      .mockImplementation(pageOf());

    const { pull, press, cards, hosts } = await render(list);

    await pull();

    expect(cards()).toHaveLength(PAGE_SIZE);
    expect(hosts('my-requests-more-error')).toHaveLength(1);

    await press('Try again');

    expect(list.mock.calls.map(([, request]) => request.page)).toEqual([1, 1, 1]);
    expect(hosts('my-requests-more-error')).toHaveLength(0);
    expect(cards()).toHaveLength(PAGE_SIZE);
  });
});

describe('MyRequestsScreen — opening a request', () => {
  it('opens Request Details with the reference and nothing else', async () => {
    const { open, navigate } = await render();

    await open(REQUESTS[4].id);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('RequestDetails', { requestId: REQUESTS[4].id });
    const [, params] = navigate.mock.calls[0];
    expect(Object.keys(params)).toEqual(['requestId']);
  });

  it('announces each card as one button that opens, naming the request', async () => {
    const { hosts } = await render();

    const [card] = hosts(`my-request-${REQUESTS[0].id}`);

    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityHint).toBe(CUSTOMER_COPY.request.openHint);
    expect(card.props.accessibilityLabel).toContain(REQUESTS[0].serviceName);
    expect(card.props.accessibilityLabel).toContain(`Ref ${REQUESTS[0].id}`);
  });

  it('names a card by the backend’s quotable reference and opens it by its id', async () => {
    // The real backend: `REQ-…` for people, its database id for calls (Phase 4A).
    const live: CustomerRequest = { ...REQUESTS[0], id: '6afc3ea3c2951ec40c9a177a', reference: 'REQ-0031002405' };
    const { hosts, open, navigate } = await render(pageOf([live]));

    const [card] = hosts(`my-request-${live.id}`);
    expect(card.props.accessibilityLabel).toContain('Ref REQ-0031002405');
    expect(card.props.accessibilityLabel).not.toContain(live.id);

    await open(live.id);

    expect(navigate).toHaveBeenCalledWith('RequestDetails', { requestId: live.id });
  });

  it('offers nothing on a card but opening it', async () => {
    const { buttons } = await render(pageOf(REQUESTS.slice(0, 2)));

    // Two cards, and no action a customer does not have (3D-3).
    expect(buttons().filter(label => label !== undefined)).toHaveLength(2);
  });
});

describe('MyRequestsScreen — how each status reads', () => {
  const cases: Array<{ status: string; directed?: boolean; label: string }> = [
    { status: 'CREATED', label: STATUS.submitted.label },
    { status: 'PENDING_VENDOR', label: STATUS.searching.label },
    { status: 'PENDING_VENDOR', directed: true, label: STATUS.awaiting_vendor.label },
    { status: 'ACCEPTED', label: STATUS.assigned.label },
    { status: 'IN_PROGRESS', label: STATUS.in_progress.label },
    { status: 'COMPLETED', label: STATUS.completed.label },
    { status: 'CLOSED', label: STATUS.completed.label },
    { status: 'CANCELLED', label: STATUS.cancelled.label },
    { status: 'REJECTED', label: STATUS.rejected.label },
    { status: 'ON_HOLD', label: STATUS.on_hold.label },
    { status: 'ESCALATED_TO_REGION', label: STATUS.unknown.label },
  ];

  it('says each one in the details screen’s words, never the backend’s constant', async () => {
    for (const { status, directed, label } of cases) {
      const request = {
        ...REQUESTS[0],
        status,
        ...(directed ? { preferredVendor: { id: 'ven_skyline', name: 'Skyline Roofing' } } : {}),
      };

      const { hosts, text } = await render(pageOf([request]));
      const [card] = hosts(`my-request-${request.id}`);

      expect(card.props.accessibilityLabel).toContain(
        `${CUSTOMER_COPY.request.statusLabel}: ${label}`,
      );
      expect(text()).not.toContain(status);
    }
  });

  it('never shows a status it does not know as completed', async () => {
    const { hosts } = await render(pageOf([{ ...REQUESTS[0], status: 'ESCALATED_TO_REGION' }]));

    const [card] = hosts(`my-request-${REQUESTS[0].id}`);

    expect(card.props.accessibilityLabel).toContain(STATUS.unknown.label);
    expect(card.props.accessibilityLabel).not.toContain(STATUS.completed.label);
  });

  it('shows the status as a word and a glyph, not a colour alone', async () => {
    const { renderer } = await render(pageOf([{ ...REQUESTS[0], status: 'CANCELLED' }]));

    // The badge, not the Cancelled filter chip, which carries the same word.
    const badges = renderer.root.findAll(
      node =>
        typeof node.type !== 'string' &&
        node.props?.label === STATUS.cancelled.label &&
        node.props?.tone !== undefined,
    );

    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0].props.icon).toBeDefined();
  });
});

/**
 * Against the real mock and device storage: what a customer raised before the
 * app closed is on My Requests after it opens, first, once.
 */
describe('MyRequestsScreen — requests raised before a restart', () => {
  it('lists them newest first, once, and opens the same one', async () => {
    await AsyncStorage.clear();

    const launch = () =>
      new MockRequestService({
        latency: NO_LATENCY,
        history: new AsyncStorageMockRequestHistory(),
        currentCustomerId: async () => 'usr_customer_1',
      });

    const created = await launch().createRequest({
      categoryId: 'cat_electrician',
      subCategoryId: 'sub_fan_repair',
      priority: 'HIGH',
      address: { formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095' },
    });

    registerService('request', launch());
    const { cards, settle, open, navigate, hosts } = await mount();
    await settle();

    const shown = cards();
    expect(shown[0]).toBe(created.id);
    expect(shown.filter(id => id === created.id)).toHaveLength(1);
    expect(new Set(shown).size).toBe(shown.length);
    // Open dispatch, still waiting: searching, in the details screen's words.
    const [card] = hosts(`my-request-${created.id}`);
    expect(card.props.accessibilityLabel).toContain(STATUS.searching.label);

    await open(created.id);

    expect(navigate).toHaveBeenCalledWith('RequestDetails', { requestId: created.id });
  });
});

/**
 * A request cancelled on Request Details (owner decision, 21/10/2026). This tab
 * stays mounted under it, so it is told (`customerRequestSync`) and reads
 * again — or a cancelled request would come back to a card still saying
 * "Searching", and the Cancelled view to "No cancelled requests".
 */
describe('MyRequestsScreen — a request changed on Request Details', () => {
  it('reads the first page again, keeping the list on screen meanwhile', async () => {
    const answer = deferred<Page<CustomerRequest>>();
    const list = jest
      .fn<Promise<Page<CustomerRequest>>, [RequestHistoryFilter, PageRequest]>()
      .mockImplementationOnce(pageOf())
      .mockImplementationOnce(() => answer.promise);
    const { cards, settle } = await render(list);
    await settle();
    const before = cards();

    await act(async () => {
      customerRequestsChanged();
    });

    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenLastCalledWith('all', { page: 1, pageSize: PAGE_SIZE });
    // The list stays while the newer answer is on its way, as under a pull.
    expect(cards()).toEqual(before);

    await act(async () => {
      answer.resolve(toPage(REQUESTS.slice(1), { page: 1, pageSize: PAGE_SIZE }));
    });

    expect(cards()[0]).toBe(REQUESTS[1].id);
  });

  it('reads from the start under placeholders when it had nothing to show', async () => {
    const answer = deferred<Page<CustomerRequest>>();
    const list = jest
      .fn<Promise<Page<CustomerRequest>>, [RequestHistoryFilter, PageRequest]>()
      .mockImplementationOnce(pageOf([]))
      .mockImplementationOnce(() => answer.promise);
    const { hosts, settle, cards, busy } = await render(list);
    await settle();
    expect(hosts('my-requests-empty')).toHaveLength(1);

    await act(async () => {
      customerRequestsChanged();
    });

    // Never "no requests" drawn over the read that may find one.
    expect(hosts('my-requests-empty')).toHaveLength(0);
    expect(cards()).toEqual([]);
    expect(hosts('my-requests-loading')).toHaveLength(1);
    expect(busy()).toEqual(['my-requests-loading']);

    await act(async () => {
      answer.resolve(toPage(REQUESTS.slice(0, 1), { page: 1, pageSize: PAGE_SIZE }));
    });
    await settle();
  });

  it('hears nothing once it is gone', async () => {
    const { list, renderer, settle } = await render();
    await settle();

    act(() => {
      renderer.unmount();
    });
    mounted.splice(mounted.indexOf(renderer), 1);
    customerRequestsChanged();

    expect(list).toHaveBeenCalledTimes(1);
  });

  it('shows a cancelled request under Cancelled and no longer under Active, against the mock', async () => {
    const requests = new MockRequestService({ latency: NO_LATENCY });
    registerService('request', requests);
    const { cards, choose, settle, hosts } = await mount();
    await settle();

    await choose(COPY.filterCancelled);
    expect(cards()).toEqual(['REQ-24020']);

    // What Request Details does: the service cancels, and the lists are told.
    await requests.cancelRequest('REQ-24081');
    await act(async () => {
      customerRequestsChanged();
    });
    await settle();

    expect(cards()).toEqual(['REQ-24081', 'REQ-24020']);
    const [card] = hosts('my-request-REQ-24081');
    expect(card.props.accessibilityLabel).toContain(STATUS.cancelled.label);

    await choose(COPY.filterActive);
    expect(cards()).not.toContain('REQ-24081');
  });
});

describe('MyRequestsScreen — shown again (owner decision, 21/10/2026, Phase 3E-15)', () => {
  it('reads nothing more on arrival than its first page', async () => {
    const focus = fakeFocus();
    const { list, settle } = await render(pageOf(), focus);

    await focus.focusAgain();
    await settle();

    expect(list).toHaveBeenCalledTimes(1);
  });

  it('reads once more, exactly once, each time the tab is shown again', async () => {
    const focus = fakeFocus();
    const { list, settle } = await render(pageOf(), focus);

    await focus.leaveAndReturn();
    await settle();
    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenLastCalledWith('all', { page: 1, pageSize: PAGE_SIZE });

    await focus.leaveAndReturn();
    await settle();
    expect(list).toHaveBeenCalledTimes(3);
  });

  it('reads quietly: no placeholders, no spinner, the rows kept until the answer', async () => {
    const focus = fakeFocus();
    const quiet = deferred<Page<CustomerRequest>>();
    const list = jest
      .fn<ReturnType<ListRequests>, Parameters<ListRequests>>()
      .mockImplementationOnce(pageOf())
      .mockImplementationOnce(() => quiet.promise);
    const { cards, busy, hosts, settle } = await render(list, focus);

    await focus.leaveAndReturn();

    expect(list).toHaveBeenCalledTimes(2);
    expect(busy()).toEqual([]);
    expect(hosts('my-requests-loading')).toHaveLength(0);
    const [scroller] = hosts('my-requests-list');
    expect(scroller.props.refreshing).toBe(false);
    expect(cards()).toEqual(REQUESTS.slice(0, PAGE_SIZE).map(request => request.id));

    const fresh: CustomerRequest = { ...REQUESTS[0], id: 'REQ-NEW', createdAt: new Date().toISOString() };
    await act(async () => {
      quiet.resolve(toPage([fresh, ...REQUESTS], { page: 1, pageSize: PAGE_SIZE }));
    });
    await settle();

    expect(cards()[0]).toBe('REQ-NEW');
    expect(cards()).toHaveLength(PAGE_SIZE);
  });

  it('keeps the chosen filter, and reads that view again', async () => {
    const focus = fakeFocus();
    const { list, choose, renderer, settle } = await render(pageOf(), focus);

    await choose(COPY.filterActive);
    await focus.leaveAndReturn();
    await settle();

    expect(list).toHaveBeenLastCalledWith('active', { page: 1, pageSize: PAGE_SIZE });
    const [active] = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props?.accessibilityRole === 'radio' &&
        node.props?.accessibilityLabel === COPY.filterActive,
    );
    expect(active.props.accessibilityState.selected).toBe(true);
  });

  it('sends no second read when shown again while one is still out', async () => {
    const focus = fakeFocus();
    const quiet = deferred<Page<CustomerRequest>>();
    const list = jest
      .fn<ReturnType<ListRequests>, Parameters<ListRequests>>()
      .mockImplementationOnce(pageOf())
      .mockImplementationOnce(() => quiet.promise)
      .mockImplementation(pageOf());
    const { settle } = await render(list, focus);

    await focus.leaveAndReturn();
    await focus.leaveAndReturn();
    await focus.leaveAndReturn();
    expect(list).toHaveBeenCalledTimes(2);

    await act(async () => {
      quiet.resolve(toPage(REQUESTS, { page: 1, pageSize: PAGE_SIZE }));
    });
    await settle();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('sends none while the first page is still out either', async () => {
    const focus = fakeFocus();
    const first = deferred<Page<CustomerRequest>>();
    const list = jest.fn<ReturnType<ListRequests>, Parameters<ListRequests>>(() => first.promise);
    await render(list, focus);

    await focus.leaveAndReturn();

    expect(list).toHaveBeenCalledTimes(1);
  });

  it('keeps the rows when a quiet read fails, and says so under them as a failed pull does', async () => {
    const focus = fakeFocus();
    const list = jest
      .fn<ReturnType<ListRequests>, Parameters<ListRequests>>()
      .mockImplementationOnce(pageOf())
      .mockRejectedValueOnce(failure())
      .mockImplementation(pageOf());
    const { cards, hosts, press, settle } = await render(list, focus);

    await focus.leaveAndReturn();
    await settle();

    expect(cards()).toEqual(REQUESTS.slice(0, PAGE_SIZE).map(request => request.id));
    expect(hosts('my-requests-error')).toHaveLength(0);
    expect(hosts('my-requests-more-error')).toHaveLength(1);

    // Its retry is the pull it stood in for.
    await press('Try again');
    expect(list.mock.calls.map(([, request]) => request)).toEqual([
      { page: 1, pageSize: PAGE_SIZE },
      { page: 1, pageSize: PAGE_SIZE },
      { page: 1, pageSize: PAGE_SIZE },
    ]);
    expect(hosts('my-requests-more-error')).toHaveLength(0);
  });

  it('reads every page on screen, page by page, so the list is not cut back to its first', async () => {
    const many: CustomerRequest[] = Array.from({ length: PAGE_SIZE * 2 + 5 }, (_, index) => ({
      ...REQUESTS[0],
      id: `REQ-M${String(index + 1).padStart(3, '0')}`,
    }));
    const focus = fakeFocus();
    const { list, press, cards, settle } = await render(pageOf(many), focus);

    await press(COPY.showMore);
    expect(cards()).toHaveLength(PAGE_SIZE * 2);

    list.mockClear();
    await focus.leaveAndReturn();
    await settle();

    // The requests a scroll makes, at the list's own page size — never one long page.
    expect(list.mock.calls).toEqual([
      ['all', { page: 1, pageSize: PAGE_SIZE }],
      ['all', { page: 2, pageSize: PAGE_SIZE }],
    ]);
    expect(cards()).toEqual(many.slice(0, PAGE_SIZE * 2).map(request => request.id));

    // The next page is still the one after what is on screen.
    await press(COPY.showMore);
    expect(list).toHaveBeenLastCalledWith('all', { page: 3, pageSize: PAGE_SIZE });
    expect(cards()).toEqual(many.map(request => request.id));
  });
});
