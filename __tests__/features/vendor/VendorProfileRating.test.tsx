/**
 * The rating on the Profile tab (PROJECT_BIBLE.md section 38; lead decision,
 * 21/10/2026, Phase 3E-15), through the real VendorNavigator and the real mock
 * review service.
 *
 * Pinned here:
 *
 * - under "Customer reviews", the figure the dashboard shows: stars, average
 *   and "N reviews" — or "No reviews yet", never "0.0" — and the button says
 *   it, so a screen reader hears the figure with the way in
 * - its own read: one call when Profile opens, waited for by nothing — the
 *   profile is drawn while it is out, with no placeholder in its place
 * - a failed read leaves the profile whole: no figure, no error and no retry
 *   here, the button's plain name, and the button still opens Reviews
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
import { MockReviewService } from '@/shared/services/mock/MockReviewService';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type { RequestService } from '@/shared/services/types/RequestService';
import type { VendorReviews } from '@/shared/services/types/ReviewService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const PROFILE = VENDOR_COPY.profile;
const REVIEWS = VENDOR_COPY.reviews;

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

const offline = () => new AppError({ kind: 'network', message: 'offline' });

let current: AuthUser;
let reviews: MockReviewService;

beforeEach(async () => {
  resetServices();
  current = RAVI;
  const currentUser = async () => current;

  const profiles = new MockVendorProfileService({ latency: NO_LATENCY, currentUser });
  registerService('vendorProfile', profiles);
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
  });
  registerService('review', reviews);

  setSessionStorage({
    read: async () => ({ token: 'token', user: current }),
    write: async () => undefined,
    clear: async () => undefined,
  });

  await profiles.saveProfile({ businessName: 'Kumar Electricals', serviceCategoryIds: ['cat_electrician'] });
  current = MEENA;
  await profiles.saveProfile({ businessName: 'Iyer Interiors', serviceCategoryIds: ['cat_electrician'] });
  current = RAVI;
});

type Instance = ReactTestRenderer.ReactTestInstance;

/* Unmounted after every test: switching tabs leaves work scheduled. */
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
});

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {});
  }
}

function textOf(node: Instance): string {
  return node.children.map(child => (typeof child === 'string' ? child : textOf(child))).join(' ');
}

function held<T>() {
  let land!: (value: T) => void;
  const promise = new Promise<T>(resolve => {
    land = resolve;
  });
  return { promise, land };
}

/** Renders the vendor application on its dashboard; `openProfile` goes to the tab. */
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
  const text = (id: string) => (has(id) ? textOf(hosts(id)[0]).trim() : '');

  const press = async (target: Instance | undefined) => {
    if (!target) {
      throw new Error('Nothing to press');
    }
    await act(async () => {
      target.props.onPress();
    });
    await flush();
  };

  /**
   * The Profile tab's way in to Reviews: found by its hint, whatever its spoken
   * name — the pressable that carries the role, the label and the press.
   */
  const reviewsButton = (): Instance | undefined =>
    renderer.root.findAll(
      node =>
        node.props?.accessibilityHint === PROFILE.reviewsHint &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    )[0];

  return {
    has,
    hosts,
    text,
    reviewsButton,
    openProfile: async () => {
      const [tab] = renderer.root
        .findAll(node => node.props?.accessibilityLabel === 'Profile')
        .filter(node => typeof node.props?.onPress === 'function');
      await press(tab);
    },
    openReviews: () => press(reviewsButton()),
  };
}

describe('Vendor profile — the rating under Customer reviews (Phase 3E-15)', () => {
  it('shows the stars, the average and how many reviews, as the dashboard does', async () => {
    const screen = await render();
    await screen.openProfile();

    expect(screen.text('vendor-profile-rating-average')).toBe('4.3');
    expect(screen.text('vendor-profile-rating-count')).toBe('4 reviews');
    const [line] = screen.hosts('vendor-profile-rating');
    expect(
      line.findAll(
        node =>
          typeof node.type === 'string' && node.props?.accessibilityLabel === 'Rating: 4 out of 5 stars',
      ),
    ).toHaveLength(1);
    // Hidden from a screen reader: the button says it.
    expect(line.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('says the figure with the way in, the button’s own words first', async () => {
    const screen = await render();
    await screen.openProfile();

    expect(screen.reviewsButton()?.props.accessibilityLabel).toBe(
      PROFILE.reviewsWithRating('Rating 4.3 out of 5, based on 4 reviews.'),
    );
    expect(String(screen.reviewsButton()?.props.accessibilityLabel).startsWith(PROFILE.reviews)).toBe(true);
  });

  it('says "No reviews yet" for a vendor nobody has reviewed — never 0.0', async () => {
    current = MEENA;
    const screen = await render();
    await screen.openProfile();

    expect(screen.text('vendor-profile-rating-note')).toBe(REVIEWS.figureNone);
    expect(screen.has('vendor-profile-rating-average')).toBe(false);
    expect(screen.text('vendor-profile-rating')).not.toMatch(/0\.0/);
    expect(screen.reviewsButton()?.props.accessibilityLabel).toBe(
      PROFILE.reviewsWithRating(REVIEWS.figureNoneSpoken),
    );
  });

  it('opens Reviews from the button with the figure on it', async () => {
    const screen = await render();
    await screen.openProfile();

    await screen.openReviews();

    expect(screen.has('vendor-reviews')).toBe(true);
  });

  it('reads the rating once when Profile opens, and draws the profile without waiting for it', async () => {
    const screen = await render();
    const answer = held<VendorReviews>();
    const getVendorReviews = jest.spyOn(reviews, 'getVendorReviews').mockReturnValueOnce(answer.promise);

    await screen.openProfile();

    expect(getVendorReviews).toHaveBeenCalledTimes(1);
    expect(screen.text('vendor-profile-business')).toBe('Kumar Electricals');
    expect(screen.has('vendor-profile-rating')).toBe(false);
    // No placeholder in its place, and the button is already there, by its own name.
    const [row] = screen.hosts('vendor-profile-reviews');
    expect(row.findAll(node => node.props?.radiusToken !== undefined)).toHaveLength(0);
    expect(screen.reviewsButton()?.props.accessibilityLabel).toBe(PROFILE.reviews);

    await act(async () => {
      answer.land({ averageRating: 4.8, totalReviews: 12, ratingBreakdown: [], reviews: [] });
    });
    await flush();

    expect(screen.text('vendor-profile-rating-average')).toBe('4.8');
    expect(screen.text('vendor-profile-rating-count')).toBe('12 reviews');
  });

  it('leaves the profile whole when the read fails: no figure, no error, and the way in still works', async () => {
    jest.spyOn(reviews, 'getVendorReviews').mockRejectedValue(offline());
    const screen = await render();
    await screen.openProfile();

    expect(screen.text('vendor-profile-business')).toBe('Kumar Electricals');
    expect(screen.has('vendor-profile-rating')).toBe(false);
    expect(screen.reviewsButton()?.props.accessibilityLabel).toBe(PROFILE.reviews);
    // Nothing of the failure on the profile: no title, no reason, no retry.
    const profile = screen.text('vendor-profile');
    expect(profile).not.toContain(offline().userMessage);
    expect(profile).not.toContain('Try again');

    await screen.openReviews();

    // The Reviews screen is where the failure and its retry live.
    expect(screen.has('vendor-reviews')).toBe(true);
    expect(screen.has('vendor-reviews-error')).toBe(true);
  });
});
