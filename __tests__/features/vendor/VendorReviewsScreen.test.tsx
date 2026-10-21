/**
 * The vendor's reviews (PROJECT_BIBLE.md section 41, Phase 3E-6), through the
 * real VendorNavigator and the real mock review service.
 *
 * Pinned here:
 *
 * - Reviews is reached from the Profile tab, and Back returns there; the tab
 *   bar is unchanged
 * - the summary shows the service's average and count — never a sum of its own
 *   — and says them as one sentence
 * - under it, the breakdown: five rows from five stars down, each one stop
 *   for a screen reader with its bar hidden, percentages adding up to 100,
 *   shared out from the service's counts; none for a vendor with no reviews,
 *   and none when the breakdown cannot be read
 * - every review is listed, newest first, each one block that says whose it
 *   is, the stars in words, when, which job and the comment; a review with no
 *   comment never announces one; a long comment is drawn whole
 * - nothing on the screen can change a review: Back is the only control
 * - no reviews says so calmly, with no summary
 * - loading, a failed first read and its retry — once, however often it is
 *   pressed, and again after failing at once
 * - a failed pull keeps the reviews and says they may be out of date — and
 *   keeps saying so, its Try again busy, while that read is out
 * - one vendor never sees another's reviews, and a route cannot point the
 *   screen at somebody else
 */

import React from 'react';
import { StyleSheet } from 'react-native';
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
import { MockReviewService } from '@/shared/services/mock/MockReviewService';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type { RequestService } from '@/shared/services/types/RequestService';
import type { VendorReviews } from '@/shared/services/types/ReviewService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const COPY = VENDOR_COPY.reviews;
const PROFILE = VENDOR_COPY.profile;

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

/** Ravi's reviews, newest first. */
const RAVI_ORDER = ['REQ-30912', 'REQ-30876', 'REQ-30833', 'REQ-30790'];

/** Anything that would answer, change or remove a review, or reach the customer. */
const MUTATION = /reply|respond|edit|delete|remove|report|flag|call|chat|message/i;

const offline = () => new AppError({ kind: 'network', message: 'offline' });

/** A breakdown from counts for 5, 4, 3, 2 and 1 stars. */
const breakdownOf = (...given: number[]) => given.map((count, index) => ({ stars: 5 - index, count }));

/** Ravi's rows as a screen reader hears them: two fives, a four and a three. */
const RAVI_BREAKDOWN = [
  '5 stars, 50 percent, 2 reviews',
  '4 stars, 25 percent, 1 review',
  '3 stars, 25 percent, 1 review',
  '2 stars, 0 percent, 0 reviews',
  '1 star, 0 percent, 0 reviews',
];

let current: AuthUser;
let reviews: MockReviewService;

beforeEach(async () => {
  resetServices();
  current = RAVI;
  const currentUser = async () => current;

  const profiles = new MockVendorProfileService({ latency: NO_LATENCY, currentUser });
  registerService('vendorProfile', profiles);
  registerService('vendorRequests', new MockVendorRequestService({ latency: NO_LATENCY, currentUser }));
  registerService('vendorDashboard', new MockVendorDashboardService({ latency: NO_LATENCY, currentUser }));
  registerService('category', {
    listServiceCategories: jest.fn(async () => [{ id: 'cat_electrician', name: 'Electrician' }]),
    listSubCategories: jest.fn(async () => []),
  } as CategoryService);

  reviews = new MockReviewService({
    // The vendor's side never reads a customer's request.
    requests: {
      getRequest: jest.fn(() => {
        throw new Error('getRequest must never be called for a vendor’s reviews');
      }),
    } as Pick<RequestService, 'getRequest'>,
    latency: NO_LATENCY,
    currentUser,
    // The real clock, as the cards use it, so a review a day old reads "1 day ago".
  });
  registerService('review', reviews);

  setSessionStorage({
    read: async () => ({ token: 'token', user: current }),
    write: async () => undefined,
    clear: async () => undefined,
  });

  // Both vendors have finished setup: this suite is about what comes after it.
  await profiles.saveProfile({ businessName: 'Kumar Electricals', serviceCategoryIds: ['cat_electrician'] });
  current = MEENA;
  await profiles.saveProfile({ businessName: 'Iyer Interiors', serviceCategoryIds: ['cat_electrician'] });
  current = RAVI;
});

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
});

type Instance = ReactTestRenderer.ReactTestInstance;

/*
  Unmounted after every test: a tree left loading leaves the placeholders
  animating, and switching tabs leaves work scheduled.
*/
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

/** The text drawn inside one rendered element. */
function textOf(node: Instance): string {
  return node.children.map(child => (typeof child === 'string' ? child : textOf(child))).join(' ');
}

/** Whether a node sits inside a part hidden from assistive technology, below `root`. */
function isHidden(node: Instance, root: Instance): boolean {
  for (let at: Instance | null = node.parent; at && at !== root; at = at.parent) {
    if (at.props?.importantForAccessibility === 'no-hide-descendants') {
      return true;
    }
  }
  return false;
}

async function flush() {
  for (let i = 0; i < 6; i += 1) {
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

/** Renders the vendor application and, unless told otherwise, opens Reviews from Profile. */
async function render({ open = true }: { open?: boolean } = {}) {
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

  /** Host nodes only, so one drawn element is counted once. */
  const hosts = (match: (id: string) => boolean, within: Instance = renderer.root) =>
    within.findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props?.testID === 'string' &&
        match(node.props.testID),
    );
  const host = (id: string) => hosts(testID => testID === id)[0];
  const has = (id: string) => hosts(testID => testID === id).length > 0;

  const pressable = (label: string, within: Instance = renderer.root) =>
    within
      .findAll(node => node.props?.accessibilityLabel === label)
      .filter(node => typeof node.props?.onPress === 'function');

  const press = async (label: string, within?: Instance) => {
    const [target] = pressable(label, within);
    if (!target) {
      throw new Error(`Nothing pressable labelled "${label}"`);
    }
    await act(async () => {
      target.props.onPress();
    });
    await flush();
  };

  const list = () =>
    renderer.root.findAll(
      node => node.props?.testID === 'vendor-reviews-list' && 'data' in (node.props ?? {}),
    )[0];

  /** The one accessible block a card is, by the review's reference. */
  const block = (reference: string) =>
    host(`vendor-review-${reference}`).findAll(
      node => typeof node.type === 'string' && node.props?.accessible === true,
    )[0];

  const screen = {
    renderer,
    navigation,
    hosts,
    host,
    has,
    pressable,
    press,
    list,
    block,
    flush,
    text: (id: string) => (has(id) ? textOf(host(id)) : ''),
    /*
      What the list holds, read from its data: a FlatList mounts only its first
      screenful in the test renderer, so the tree is not the whole list.
    */
    listed: (): string[] =>
      (list().props.data as Array<{ requestId: string }>).map(review => review.requestId),
    /** The card placeholders in the loading region, which is not the list. */
    placeholders: (): number =>
      has('vendor-reviews-loading') ? host('vendor-reviews-loading').children.length : 0,
    /**
     * The testID of every native view on this screen that says it is busy —
     * Profile is still mounted underneath, so only this screen's subtree is read.
     *
     * Ids, not the nodes: a failed match on a test instance makes jest print it,
     * and printing one walks the whole fiber tree — the run never finishes.
     */
    busy: (): Array<string | undefined> =>
      host('vendor-reviews')
        .findAll(
          node => typeof node.type === 'string' && node.props?.accessibilityState?.busy === true,
        )
        .map(node => node.props.testID),
    summaryLabel: () =>
      host('vendor-reviews-summary').findAll(
        node => typeof node.type === 'string' && node.props?.accessible === true,
      )[0]?.props.accessibilityLabel,
    /** The breakdown's rows, top to bottom — each the one accessible node it is. */
    breakdownRows: (): Instance[] => hosts(id => /^vendor-reviews-summary-breakdown-\d$/.test(id)),
    pull: async () => {
      await act(async () => {
        list().props.onRefresh();
      });
      await flush();
    },
    switchTo: async (user: AuthUser) => {
      current = user;
      await act(async () => {
        store.dispatch(signedIn({ token: 'token', user }));
      });
      await flush();
    },
    openReviews: async () => {
      await screen.press('Profile');
      await screen.press(PROFILE.reviews);
    },
  };

  if (open) {
    await screen.openReviews();
  }

  return screen;
}

describe('Vendor reviews — getting there', () => {
  it('is opened from the Profile tab, and Back returns to it', async () => {
    const screen = await render({ open: false });

    await screen.press('Profile');
    expect(screen.has('vendor-profile')).toBe(true);
    expect(screen.has('vendor-reviews')).toBe(false);

    await screen.press(PROFILE.reviews);
    expect(screen.has('vendor-reviews')).toBe(true);
    expect(screen.text('vendor-reviews-heading')).toBe(COPY.title);

    await screen.press(COPY.back);
    expect(screen.has('vendor-reviews')).toBe(false);
    expect(screen.has('vendor-profile')).toBe(true);
  });

  it('adds no tab: the bar is still Dashboard, Requests, Team and Profile', async () => {
    const screen = await render({ open: false });

    for (const tab of ['Dashboard', 'Requests', 'Team', 'Profile']) {
      expect(screen.pressable(tab).length).toBeGreaterThan(0);
    }
    expect(screen.pressable('Reviews')).toHaveLength(0);
  });

  it('says where the Profile button goes', async () => {
    const screen = await render({ open: false });
    await screen.press('Profile');

    const [button] = screen.pressable(PROFILE.reviews);
    expect(button.props.accessibilityHint).toBe(PROFILE.reviewsHint);
  });
});

describe('Vendor reviews — the summary', () => {
  it('shows the service’s average and count', async () => {
    const screen = await render();

    expect(screen.text('vendor-reviews-summary-average')).toBe('4.3');
    expect(screen.text('vendor-reviews-summary-count')).toBe('4 reviews');
  });

  it('says the rating as a number, in one sentence', async () => {
    const screen = await render();

    expect(screen.summaryLabel()).toBe('Rating 4.3 out of 5, based on 4 reviews.');
  });

  it('shows the figures it is given and never sums the list itself', async () => {
    // Two reviews on this page; the backend's figures cover twelve.
    const page: VendorReviews = {
      averageRating: 4.8,
      totalReviews: 12,
      ratingBreakdown: breakdownOf(10, 2, 0, 0, 0),
      reviews: [
        { requestId: 'REQ-1', rating: 5, submittedAt: new Date(Date.now() - 60_000).toISOString() },
        { requestId: 'REQ-2', rating: 3, submittedAt: new Date(Date.now() - 120_000).toISOString() },
      ],
    };
    jest.spyOn(reviews, 'getVendorReviews').mockResolvedValue(page);
    const screen = await render();

    expect(screen.text('vendor-reviews-summary-average')).toBe('4.8');
    expect(screen.text('vendor-reviews-summary-count')).toBe('12 reviews');
    expect(screen.summaryLabel()).toBe('Rating 4.8 out of 5, based on 12 reviews.');
    expect(screen.listed()).toEqual(['REQ-1', 'REQ-2']);
  });
});

describe('Vendor reviews — the breakdown', () => {
  it('draws five rows under the average, five stars first, each said as one sentence', async () => {
    const screen = await render();

    const rows = screen.breakdownRows();
    expect(rows.map(row => row.props.testID)).toEqual(
      [5, 4, 3, 2, 1].map(stars => `vendor-reviews-summary-breakdown-${stars}`),
    );
    expect(rows.map(row => row.props.accessibilityLabel)).toEqual(RAVI_BREAKDOWN);
    for (const row of rows) {
      expect(row.props.accessible).toBe(true);
      expect(row.props.accessibilityRole).toBe('text');
    }
  });

  it('shows percentages that add up to exactly 100, and fills each bar by its own', async () => {
    const screen = await render();

    const shown = [5, 4, 3, 2, 1].map(stars =>
      screen.text(`vendor-reviews-summary-breakdown-${stars}-percent`),
    );
    expect(shown).toEqual(['50%', '25%', '25%', '0%', '0%']);
    expect(shown.reduce((total, text) => total + Number.parseInt(text, 10), 0)).toBe(100);

    const fills = [5, 4, 3, 2, 1].map(stars =>
      StyleSheet.flatten(screen.host(`vendor-reviews-summary-breakdown-${stars}-fill`).props.style)
        .width,
    );
    expect(fills).toEqual(['50%', '25%', '25%', '0%', '0%']);
  });

  it('hides the bars and figures inside each row, so a row is said once', async () => {
    const screen = await render();
    const card = screen.host('vendor-reviews-summary');

    // The summary and the five rows: nothing else in the card can be reached.
    const reachable = card
      .findAll(node => typeof node.type === 'string' && node.props?.accessible === true)
      .filter(node => !isHidden(node, card));
    expect(reachable).toHaveLength(6);

    for (const stars of [5, 4, 3, 2, 1]) {
      const row = screen.host(`vendor-reviews-summary-breakdown-${stars}`);
      expect(isHidden(screen.host(`vendor-reviews-summary-breakdown-${stars}-fill`), row)).toBe(true);
      expect(isHidden(screen.host(`vendor-reviews-summary-breakdown-${stars}-percent`), row)).toBe(
        true,
      );
    }
  });

  it('is not drawn for a vendor with no reviews', async () => {
    current = MEENA;
    const screen = await render();

    expect(screen.has('vendor-reviews-summary-breakdown')).toBe(false);
    expect(screen.breakdownRows()).toHaveLength(0);
    expect(screen.text('vendor-reviews')).not.toContain('%');
  });

  it('shares out the service’s counts, never the reviews on screen', async () => {
    // Two reviews on this page; the counts cover ten — and disagree with the
    // total of twelve, which the breakdown trusts its counts over.
    const page: VendorReviews = {
      averageRating: 4.5,
      totalReviews: 12,
      ratingBreakdown: breakdownOf(6, 2, 1, 1, 0),
      reviews: [
        { requestId: 'REQ-1', rating: 1, submittedAt: new Date(Date.now() - 60_000).toISOString() },
        { requestId: 'REQ-2', rating: 1, submittedAt: new Date(Date.now() - 120_000).toISOString() },
      ],
    };
    jest.spyOn(reviews, 'getVendorReviews').mockResolvedValue(page);
    const screen = await render();

    expect(screen.breakdownRows().map(row => row.props.accessibilityLabel)).toEqual([
      '5 stars, 60 percent, 6 reviews',
      '4 stars, 20 percent, 2 reviews',
      '3 stars, 10 percent, 1 review',
      '2 stars, 10 percent, 1 review',
      '1 star, 0 percent, 0 reviews',
    ]);
    expect(screen.text('vendor-reviews-summary-count')).toBe('12 reviews');
  });

  it('keeps the average and leaves out a breakdown it cannot read', async () => {
    const answer = await reviews.getVendorReviews();
    jest.spyOn(reviews, 'getVendorReviews').mockResolvedValue({
      ...answer,
      ratingBreakdown: [...answer.ratingBreakdown, { stars: 6, count: 1 }],
    });
    const screen = await render();

    expect(screen.text('vendor-reviews-summary-average')).toBe('4.3');
    expect(screen.has('vendor-reviews-summary-breakdown')).toBe(false);
    expect(screen.breakdownRows()).toHaveLength(0);
  });
});

describe('Vendor reviews — the list', () => {
  it('lists every review, newest first, in the service’s order', async () => {
    const screen = await render();

    expect(screen.listed()).toEqual(RAVI_ORDER);
  });

  it('says each review as one block: whose, the stars, when, which job, what they wrote', async () => {
    const screen = await render();

    expect(screen.block('REQ-30912').props.accessibilityLabel).toBe(
      'Review from Karthik Iyer. 5 out of 5 stars. 1 day ago. Geyser wiring, Ref REQ-30912. ' +
        'Comment: Arrived on time, found the loose connection quickly and explained what had ' +
        'gone wrong. Left everything clean.',
    );
  });

  it('draws the customer, the job and the comment on the card', async () => {
    const screen = await render();

    expect(screen.text('vendor-review-REQ-30912-customer')).toBe('Karthik Iyer');
    expect(screen.text('vendor-review-REQ-30912-context')).toBe('Geyser wiring · Ref REQ-30912');
    expect(screen.text('vendor-review-REQ-30912-comment')).toContain('Arrived on time');
  });

  it('keeps the stars inside the block, so the rating is said once', async () => {
    const screen = await render();

    const card = screen.host('vendor-review-REQ-30912');
    const hidden = card.findAll(
      node => node.props?.importantForAccessibility === 'no-hide-descendants',
    );
    expect(hidden.length).toBeGreaterThan(0);

    // Only the block itself can be reached; the stars' own node is inside the hidden part.
    const reachable = card
      .findAll(node => typeof node.type === 'string' && node.props?.accessible === true)
      .filter(node => !isHidden(node, card));
    expect(reachable).toHaveLength(1);
    expect(reachable[0]).toBe(screen.block('REQ-30912'));
  });

  it('never announces a comment a review does not have', async () => {
    const screen = await render();

    const label = String(screen.block('REQ-30833').props.accessibilityLabel);
    expect(label).toBe('Review from Joseph Mathew. 5 out of 5 stars. 4 days ago. Socket replacement, Ref REQ-30833');
    expect(label).not.toContain(COPY.commentSpoken);
    expect(screen.has('vendor-review-REQ-30833-comment')).toBe(false);
  });

  it('draws a long comment whole, never cut short', async () => {
    const screen = await render();
    const [long] = (await reviews.getVendorReviews()).reviews.filter(
      review => review.requestId === 'REQ-30876',
    );

    const comment = screen.host('vendor-review-REQ-30876-comment');
    expect(textOf(comment)).toBe(long.comment);
    expect(comment.props.numberOfLines).toBeUndefined();
    expect(String(screen.block('REQ-30876').props.accessibilityLabel).endsWith(`${long.comment}`)).toBe(
      true,
    );
  });

  it('offers nothing to press but Back — a review cannot be changed from here', async () => {
    const screen = await render();

    const controls = screen
      .host('vendor-reviews')
      .findAll(node => typeof node.props?.onPress === 'function')
      .map(node => String(node.props.accessibilityLabel ?? ''));
    expect(new Set(controls)).toEqual(new Set([COPY.back]));

    // The app's own words, that is: a customer may well write "call" in a comment.
    const comments = screen
      .hosts(id => id.endsWith('-comment'))
      .map(node => textOf(node));
    const ours = comments.reduce(
      (rest, comment) => rest.replace(comment, ''),
      screen.text('vendor-reviews'),
    );
    expect(ours).not.toMatch(MUTATION);
  });

  it('leaves the list unnamed, so it is no stop of its own, with nothing busy', async () => {
    // The list used to be named on every render — "Your reviews" once loaded —
    // so TalkBack stopped on it to say what the heading had just said.
    const screen = await render();

    expect(screen.listed()).toEqual(RAVI_ORDER);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.list().props.accessibilityRole).toBeUndefined();
    expect(screen.busy()).toEqual([]);
  });
});

describe('Vendor reviews — none yet', () => {
  it('says so calmly, with no summary and no rating of zero', async () => {
    current = MEENA;
    const screen = await render();

    expect(screen.has('vendor-reviews-empty')).toBe(true);
    expect(screen.text('vendor-reviews-empty')).toContain(COPY.emptyTitle);
    expect(screen.text('vendor-reviews-empty')).toContain(COPY.emptyMessage);
    expect(screen.has('vendor-reviews-summary')).toBe(false);
    expect(screen.text('vendor-reviews')).not.toContain('0.0');
    expect(screen.listed()).toEqual([]);
    // Its own words, under a list that is still no stop of its own.
    expect(screen.has('vendor-reviews-loading')).toBe(false);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.busy()).toEqual([]);
  });

  it('can still be pulled to read again', async () => {
    current = MEENA;
    const getVendorReviews = jest.spyOn(reviews, 'getVendorReviews');
    const screen = await render();

    await screen.pull();

    expect(getVendorReviews).toHaveBeenCalledTimes(2);
    expect(screen.has('vendor-reviews-empty')).toBe(true);
  });
});

describe('Vendor reviews — loading', () => {
  it('fills the screen with placeholders, named and busy, until the reviews arrive', async () => {
    const answer = held<VendorReviews>();
    const getVendorReviews = jest.spyOn(reviews, 'getVendorReviews');
    getVendorReviews.mockReturnValueOnce(answer.promise);
    const screen = await render();

    expect(screen.placeholders()).toBeGreaterThan(0);
    // One region says the wait once, named and busy — not the list itself.
    const waiting = screen.host('vendor-reviews-loading');
    expect(waiting.props.accessibilityLabel).toBe(COPY.loading);
    expect(waiting.props.accessibilityState).toEqual({ busy: true });
    expect(screen.busy()).toEqual(['vendor-reviews-loading']);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.list().props.accessibilityRole).toBeUndefined();
    expect(screen.has('vendor-reviews-summary')).toBe(false);
    expect(screen.has('vendor-reviews-empty')).toBe(false);

    getVendorReviews.mockRestore();
    await act(async () => {
      answer.land(await reviews.getVendorReviews());
    });
    await screen.flush();

    expect(screen.placeholders()).toBe(0);
    expect(screen.listed()).toEqual(RAVI_ORDER);
    // Not hidden or emptied: no longer in the tree at all, so its busy cannot outlive it.
    expect(screen.has('vendor-reviews-loading')).toBe(false);
    expect(screen.list() === waiting).toBe(false);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.list().props.accessibilityRole).toBeUndefined();
    // Nothing anywhere on the loaded screen still says busy.
    expect(screen.busy()).toEqual([]);
  });
});

describe('Vendor reviews — a failed read', () => {
  it('says it failed, with a way to try again and no pull over it', async () => {
    jest.spyOn(reviews, 'getVendorReviews').mockRejectedValueOnce(offline());
    const screen = await render();

    expect(screen.has('vendor-reviews-error')).toBe(true);
    expect(screen.text('vendor-reviews-error')).toContain(COPY.failedTitle);
    expect(screen.text('vendor-reviews-error')).not.toContain('offline');
    expect(screen.has('vendor-reviews-summary')).toBe(false);
    expect(screen.has('vendor-reviews-empty')).toBe(false);
    expect(screen.list().props.onRefresh).toBeUndefined();
    // Its own words, under a list that is still no stop of its own.
    expect(screen.has('vendor-reviews-loading')).toBe(false);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.busy()).toEqual([]);
  });

  it('reads the reviews when Try again is pressed', async () => {
    const getVendorReviews = jest.spyOn(reviews, 'getVendorReviews').mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.press('Try again');

    expect(getVendorReviews).toHaveBeenCalledTimes(2);
    expect(screen.has('vendor-reviews-error')).toBe(false);
    expect(screen.listed()).toEqual(RAVI_ORDER);
  });

  it('still tries again after failing at once, twice', async () => {
    const getVendorReviews = jest
      .spyOn(reviews, 'getVendorReviews')
      .mockRejectedValueOnce(offline())
      .mockRejectedValueOnce(offline())
      .mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.press('Try again');
    expect(screen.has('vendor-reviews-error')).toBe(true);
    await screen.press('Try again');
    expect(screen.has('vendor-reviews-error')).toBe(true);
    await screen.press('Try again');

    expect(getVendorReviews).toHaveBeenCalledTimes(4);
    expect(screen.has('vendor-reviews-error')).toBe(false);
    expect(screen.listed()).toEqual(RAVI_ORDER);
  });

  it('tries again once, however often Try again is pressed', async () => {
    const getVendorReviews = jest.spyOn(reviews, 'getVendorReviews').mockRejectedValueOnce(offline());
    const screen = await render();
    expect(getVendorReviews).toHaveBeenCalledTimes(1);

    const [retry] = screen.pressable('Try again');
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        retry.props.onPress();
      }
    });
    await screen.flush();

    expect(getVendorReviews).toHaveBeenCalledTimes(2);
    expect(screen.listed()).toEqual(RAVI_ORDER);
  });

  it('shows the failure, not the reviews, when the session is not a vendor’s', async () => {
    jest
      .spyOn(reviews, 'getVendorReviews')
      .mockRejectedValueOnce(new AppError({ kind: 'unauthorized', message: 'no vendor session' }));
    const screen = await render();

    expect(screen.has('vendor-reviews-error')).toBe(true);
    expect(screen.listed()).toEqual([]);
    expect(screen.has('vendor-reviews-summary')).toBe(false);
  });
});

describe('Vendor reviews — pull to refresh', () => {
  it('reads again and keeps the reviews on screen', async () => {
    const getVendorReviews = jest.spyOn(reviews, 'getVendorReviews');
    const screen = await render();

    await screen.pull();

    expect(getVendorReviews).toHaveBeenCalledTimes(2);
    expect(screen.listed()).toEqual(RAVI_ORDER);
    expect(screen.has('vendor-reviews-stale')).toBe(false);
  });

  it('sends one read for two pulls in a row', async () => {
    const getVendorReviews = jest.spyOn(reviews, 'getVendorReviews');
    const screen = await render();

    await act(async () => {
      screen.list().props.onRefresh();
      screen.list().props.onRefresh();
    });
    await screen.flush();

    expect(getVendorReviews).toHaveBeenCalledTimes(2);
  });

  it('keeps the reviews and says they may be out of date when a pull fails', async () => {
    const screen = await render();
    jest.spyOn(reviews, 'getVendorReviews').mockRejectedValueOnce(offline());

    await screen.pull();

    expect(screen.listed()).toEqual(RAVI_ORDER);
    expect(screen.text('vendor-reviews-summary-average')).toBe('4.3');
    expect(screen.has('vendor-reviews-error')).toBe(false);
    expect(screen.has('vendor-reviews-stale')).toBe(true);
    expect(screen.text('vendor-reviews-stale')).toContain(COPY.staleTitle);
    expect(screen.text('vendor-reviews-stale')).toContain(COPY.staleMessage);
    expect(screen.text('vendor-reviews-stale')).not.toContain('offline');
  });

  it('clears the notice once the reviews have been read again', async () => {
    const screen = await render();
    jest.spyOn(reviews, 'getVendorReviews').mockRejectedValueOnce(offline());
    await screen.pull();
    expect(screen.has('vendor-reviews-stale')).toBe(true);

    await screen.press(COPY.staleRetry, screen.host('vendor-reviews-stale'));

    expect(screen.has('vendor-reviews-stale')).toBe(false);
    expect(screen.listed()).toEqual(RAVI_ORDER);
  });

  /*
    Found in review: the query clears its failure as a refresh starts, so the
    notice vanished the moment Try again was pressed — its spinner never seen —
    and a second failure put it back from nothing, to be announced again.
  */
  it('keeps the notice with Try again busy while it reads, and says a same failure once', async () => {
    const screen = await render();
    const getVendorReviews = jest
      .spyOn(reviews, 'getVendorReviews')
      .mockRejectedValueOnce(offline());
    await screen.pull();
    const spoken = () =>
      screen
        .host('vendor-reviews-stale')
        .findAll(node => typeof node.type === 'string' && node.props?.accessibilityRole === 'alert')[0];
    const tryAgain = () => screen.pressable(COPY.staleRetry, screen.host('vendor-reviews-stale'))[0];
    const before = spoken();
    const said = before.props.accessibilityLabel;

    const answer = held<VendorReviews>();
    getVendorReviews.mockReturnValueOnce(answer.promise);
    await act(async () => {
      tryAgain().props.onPress();
    });

    expect(screen.has('vendor-reviews-stale')).toBe(true);
    expect(spoken()).toBe(before);
    expect(tryAgain().props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.listed()).toEqual(RAVI_ORDER);

    await act(async () => {
      answer.fail(offline());
    });
    await screen.flush();

    // The same notice, never taken down: nothing new for a screen reader to say.
    expect(spoken()).toBe(before);
    expect(spoken().props.accessibilityLabel).toBe(said);
    expect(tryAgain().props.accessibilityState).toMatchObject({ busy: false });
    // The pull and the one Try again, spied on after the first read.
    expect(getVendorReviews).toHaveBeenCalledTimes(2);
  });
});

describe('Vendor reviews — whose reviews', () => {
  it('shows each vendor their own, and never the last vendor’s', async () => {
    const screen = await render();
    expect(screen.listed()).toEqual(RAVI_ORDER);

    await screen.switchTo(MEENA);
    await screen.openReviews();
    expect(screen.listed()).toEqual([]);
    expect(screen.has('vendor-reviews-empty')).toBe(true);
    expect(screen.text('vendor-reviews')).not.toContain('Karthik Iyer');

    await screen.switchTo(RAVI);
    await screen.openReviews();
    expect(screen.listed()).toEqual(RAVI_ORDER);
  });

  it('ignores anything a route tries to say about whose reviews to show', async () => {
    current = MEENA;
    const screen = await render({ open: false });

    // A hand-built route naming another vendor: the session decides, not this.
    await act(async () => {
      screen.navigation.dispatch(
        CommonActions.navigate({ name: 'VendorReviews', params: { vendorId: RAVI.id } }),
      );
    });
    await screen.flush();

    expect(screen.has('vendor-reviews')).toBe(true);
    expect(screen.listed()).toEqual([]);
    expect(screen.has('vendor-reviews-empty')).toBe(true);
  });
});
