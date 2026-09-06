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
 * - the primary action, a category and the empty state all lead to Categories
 * - a request card is one thing to a screen reader, and its status is a word
 *   rather than only a colour
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

import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { SessionPayload } from '@/features/auth/types';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { CustomerHomeScreen } from '@/features/customer/screens/CustomerHomeScreen';
import { ToastProvider } from '@/shared/components';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService, ServiceCategory } from '@/shared/services/types/CategoryService';
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
    serviceName: 'Roof Repair',
    vendorName: 'Skyline Roofing',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    createdAt: new Date(Date.now() - 90 * 60_000).toISOString(),
  },
  {
    id: 'REQ-2',
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
}

async function render({ categories, requests }: Stubs = {}) {
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
  } as RequestService);

  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn(SESSION));

  const navigate = jest.fn();
  const navigation = { navigate } as never;
  const route = { key: 'Home', name: 'Home' as const, params: undefined } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <CustomerHomeScreen navigation={navigation} route={route} />
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });

  const hosts = (predicate: (props: Record<string, unknown>) => boolean) =>
    renderer.root.findAll(
      node => typeof node.type === 'string' && predicate(node.props as Record<string, unknown>),
    );

  return {
    renderer,
    navigate,
    listServiceCategories,
    listRecentRequests,
    text: () => textOf(renderer.toJSON()),
    byTestID: (id: string) => hosts(props => props.testID === id),
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

afterEach(() => {
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
      node =>
        typeof node.type === 'string' && node.props?.accessibilityRole === 'progressbar',
    );

    expect(busy).toHaveLength(2);
    expect(busy.every(node => node.props.accessibilityState?.busy === true)).toBe(true);
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

describe('CustomerHomeScreen — where it leads', () => {
  it('sends the primary action to Categories', async () => {
    const { press, navigate } = await render();

    await press(COPY.primaryAction);

    expect(navigate).toHaveBeenCalledWith('Categories');
  });

  it('sends a category to Categories', async () => {
    const { press, navigate } = await render();

    await press(CATEGORIES[0].name);

    expect(navigate).toHaveBeenCalledWith('Categories');
  });

  it('sends the empty state action to Categories', async () => {
    const { press, navigate } = await render({ requests: async () => [] });

    await press(COPY.primaryAction);

    expect(navigate).toHaveBeenCalledWith('Categories');
  });
});

describe('CustomerHomeScreen — how it is announced', () => {
  it('names every category tile as a button, with a hint', async () => {
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
      expect(tile.props.accessibilityHint).toBe(COPY.categoryHint);
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
