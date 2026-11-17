/**
 * Section 24's "Rate Your Experience", pinned:
 *
 * - it trusts nothing but its services: the form appears only for a completed or
 *   closed request with no review, and every other answer — still under way,
 *   already reviewed, not found, failed — gets its own honest state
 * - the stars are one to five, each a named radio, with the rating said in words
 *   as well as drawn, and no rating is chosen for the customer
 * - the comment is optional, sent exactly as typed or not at all, and bounded
 *   only by the ceiling the app already uses
 * - one review per request: a double tap sends once, a refusal because a review
 *   already exists shows that review, and success replaces the form
 * - a failure keeps everything the customer entered, and the button retries
 * - nothing about the request changes, before, during or after
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { RequestReviewScreen } from '@/features/customer/screens/RequestReviewScreen';
import { REVIEW_COMMENT_MAX_LENGTH } from '@/features/customer/validation/reviewSchemas';
import { AsyncStorageMockRequestHistory } from '@/shared/services/mock/MockRequestHistoryStorage';
import { MockRequestService } from '@/shared/services/mock/MockRequestService';
import { MockReviewService } from '@/shared/services/mock/MockReviewService';
import { AsyncStorageMockReviewStorage } from '@/shared/services/mock/MockReviewStorage';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type {
  CustomerRequestDetails,
  RequestService,
} from '@/shared/services/types/RequestService';
import type {
  RequestReview,
  ReviewService,
  SubmitReviewInput,
} from '@/shared/services/types/ReviewService';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const COPY = CUSTOMER_COPY.review;

/** Shares no names with the mock seed, so a pass is a pass on what was returned. */
const REQUEST: CustomerRequestDetails = {
  id: 'REQ-7002',
  categoryId: 'cat_roofing',
  subCategoryId: 'sub_gutter',
  categoryName: 'Roof Repair',
  serviceName: 'Gutter Cleaning',
  status: 'COMPLETED',
  priority: 'HIGH',
  vendorName: 'Skyline Roofing',
  preferredVendor: { id: 'ven_skyline', name: 'Skyline Roofing' },
  address: { formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095' },
  createdAt: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString(),
};

function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  resetServices();
});

function textOf(node: ReactTestRendererJSON | ReactTestRendererJSON[] | null): string {
  if (node === null) {
    return '';
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join(' ');
  }
  return (node.children ?? [])
    .map(child => (typeof child === 'string' ? child : textOf(child)))
    .join(' ');
}

/** Lets every service call and the form's own validation finish. */
const settle = () =>
  act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });

async function mount(requestId: string = REQUEST.id) {
  const goBack = jest.fn();
  const navigate = jest.fn();
  const navigation = { goBack, navigate, addListener: jest.fn(() => jest.fn()) } as never;
  const route = {
    key: 'RequestReview',
    name: 'RequestReview' as const,
    params: { requestId },
  } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <RequestReviewScreen navigation={navigation} route={route} />
      </ThemeProvider>,
    );
  });
  await settle();

  mounted.push(renderer);

  const byTestID = (id: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id);

  const button = (label: string) =>
    renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === label &&
        typeof node.props?.onPress === 'function',
    )[0];

  const stars = () =>
    renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props?.accessibilityRole === 'radio' &&
        typeof node.props?.testID === 'string' &&
        node.props.testID.startsWith('request-review-rating-'),
    );

  return {
    renderer,
    goBack,
    navigate,
    byTestID,
    text: () => textOf(renderer.toJSON()),
    labelOf: (id: string): string | undefined => byTestID(id)[0]?.props.accessibilityLabel,
    buttons: () =>
      renderer.root
        .findAll(
          node =>
            node.props?.accessibilityRole === 'button' &&
            typeof node.props?.onPress === 'function',
        )
        .map(node => node.props.accessibilityLabel as string),
    stars,
    rate: async (value: number) => {
      const [star] = renderer.root.findAll(
        node =>
          node.props?.testID === `request-review-rating-${value}` &&
          typeof node.props?.onPress === 'function',
      );
      if (!star) {
        throw new Error(`No star ${value}`);
      }
      await act(async () => {
        star.props.onPress();
      });
    },
    type: async (value: string) => {
      const [field] = renderer.root.findAll(
        node => node.props?.accessibilityLabel === COPY.commentLabel && node.props?.onChangeText,
      );
      await act(async () => {
        field.props.onChangeText(value);
      });
    },
    commentValue: (): string =>
      renderer.root.findAll(
        node => node.props?.accessibilityLabel === COPY.commentLabel && node.props?.onChangeText,
      )[0]?.props.value,
    /** Presses a button; `settle` lets what it started finish. */
    press: async (label: string) => {
      const target = button(label);
      if (!target) {
        throw new Error(`No button labelled "${label}"`);
      }
      await act(async () => {
        target.props.onPress();
      });
      await settle();
    },
    button,
  };
}

interface Stubs {
  getRequest?: (requestId: string) => Promise<CustomerRequestDetails | null>;
  getReview?: (requestId: string) => Promise<RequestReview | null>;
  submitReview?: (input: SubmitReviewInput) => Promise<RequestReview>;
}

/** Stub services; the request service can only be read. */
async function render({ getRequest, getReview, submitReview }: Stubs = {}) {
  const read = jest.fn(getRequest ?? (async () => REQUEST));
  const readReview = jest.fn(getReview ?? (async () => null));
  const send = jest.fn(
    submitReview ??
      (async (input: SubmitReviewInput): Promise<RequestReview> => ({
        ...input,
        submittedAt: new Date().toISOString(),
      })),
  );

  registerService('request', {
    getRequest: read,
    listRecentRequests: jest.fn(() => {
      throw new Error('listRecentRequests must not be called from the review screen');
    }),
    listRequests: jest.fn(() => {
      throw new Error('listRequests must not be called from the review screen');
    }),
    createRequest: jest.fn(() => {
      throw new Error('createRequest must never be called from the review screen');
    }),
    // Reviewing a finished request never changes it.
    cancelRequest: jest.fn(() => {
      throw new Error('cancelRequest must never be called from the review screen');
    }),
  } as RequestService);

  registerService('review', {
    getReview: readReview,
    submitReview: send,
    // A vendor's read (Phase 3E-6); a customer screen has no business with it.
    getVendorReviews: jest.fn(() => {
      throw new Error('getVendorReviews must never be called from a customer screen');
    }),
  } as ReviewService);

  return { ...(await mount()), read, readReview, send };
}

describe('RequestReviewScreen — what it reads before offering anything', () => {
  it('names itself as section 24 does, in every state', async () => {
    const { byTestID } = await render({ getRequest: () => pending() });

    expect(byTestID('request-review-heading')[0].props.children).toBe(COPY.title);
    expect(byTestID('request-review-heading')[0].props.accessibilityRole).toBe('header');
  });

  it('shows the shape of the page while it reads, announced once', async () => {
    const { byTestID, buttons } = await render({ getRequest: () => pending() });

    const [loading] = byTestID('request-review-loading');
    expect(loading.props.accessibilityLabel).toBe(COPY.loadingLabel);
    expect(loading.props.accessibilityState).toEqual({ busy: true });
    expect(buttons()).not.toContain(COPY.submit);
  });

  it('keeps loading while the review is still being checked', async () => {
    const { byTestID, buttons } = await render({ getReview: () => pending() });

    expect(byTestID('request-review-loading')).toHaveLength(1);
    expect(buttons()).not.toContain(COPY.submit);
  });

  it('says a request that does not exist is not there, and offers the way back', async () => {
    const { byTestID, press, goBack, readReview } = await render({ getRequest: async () => null });

    expect(byTestID('request-review-not-found')).toHaveLength(1);
    expect(readReview).not.toHaveBeenCalled();

    await press(COPY.back);
    expect(goBack).toHaveBeenCalled();
  });

  it('offers a retry when the request cannot be read', async () => {
    let fail = true;
    const { byTestID, press, read } = await render({
      getRequest: async () => {
        if (fail) {
          throw new AppError({ kind: 'network', message: 'offline' });
        }
        return REQUEST;
      },
    });

    expect(byTestID('request-review-error')).toHaveLength(1);

    fail = false;
    await press('Try again');

    expect(read).toHaveBeenCalledTimes(2);
    expect(byTestID('request-review-rating')).toHaveLength(1);
  });

  it('offers a retry, and no form, when the review cannot be checked', async () => {
    let fail = true;
    const { byTestID, buttons, press } = await render({
      getReview: async () => {
        if (fail) {
          throw new AppError({ kind: 'server', message: 'down' });
        }
        return null;
      },
    });

    expect(byTestID('request-review-error')).toHaveLength(1);
    expect(buttons()).not.toContain(COPY.submit);

    fail = false;
    await press('Try again');

    expect(buttons()).toContain(COPY.submit);
  });

  for (const status of [
    'CREATED',
    'PENDING_VENDOR',
    'ACCEPTED',
    'IN_PROGRESS',
    'REJECTED',
    'CANCELLED',
    'ON_HOLD',
    'ESCALATED_TO_REGION',
  ]) {
    it(`offers no form for a request that is ${status}`, async () => {
      const { byTestID, buttons, press, goBack, readReview, send } = await render({
        getRequest: async () => ({ ...REQUEST, status }),
      });

      expect(byTestID('request-review-unavailable')).toHaveLength(1);
      expect(byTestID('request-review-rating')).toHaveLength(0);
      expect(buttons()).not.toContain(COPY.submit);
      expect(readReview).not.toHaveBeenCalled();

      await press(COPY.backToRequest);
      expect(goBack).toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });
  }

  for (const status of ['COMPLETED', 'CLOSED']) {
    it(`offers the form for a request that is ${status} with no review`, async () => {
      const { byTestID, buttons } = await render({ getRequest: async () => ({ ...REQUEST, status }) });

      expect(byTestID('request-review-rating')).toHaveLength(1);
      expect(buttons()).toContain(COPY.submit);
    });
  }

  it('shows a review that already exists read-only, and no form', async () => {
    const existing: RequestReview = {
      requestId: REQUEST.id,
      rating: 2,
      comment: 'Left the ladder behind.',
      submittedAt: new Date().toISOString(),
    };
    const { byTestID, labelOf, buttons } = await render({ getReview: async () => existing });

    expect(labelOf('request-review-read-only-rating')).toBe(`${COPY.ratingLabel}: 2 out of 5 stars`);
    expect(labelOf('request-review-read-only-comment')).toBe(
      `${COPY.commentLabelReadOnly}: ${existing.comment}`,
    );
    expect(buttons()).not.toContain(COPY.submit);
    // Not just sent, so nothing announces that it was.
    expect(byTestID('request-review-success')).toHaveLength(0);
  });

  it('says which request is being rated, and who did the work', async () => {
    const { renderer } = await render();

    const [summary] = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props?.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith(`${COPY.requestLabel}:`),
    );
    expect(summary.props.accessibilityLabel).toBe(
      `${COPY.requestLabel}: Gutter Cleaning, ${COPY.vendorPrefix} Skyline Roofing`,
    );
  });
});

describe('RequestReviewScreen — the stars', () => {
  it('offers five stars as one named group, each named for what it sets', async () => {
    const { byTestID, stars } = await render();

    const [group] = byTestID('request-review-rating');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityLabel).toBe(COPY.ratingLabel);

    expect(stars().map(star => star.props.accessibilityLabel)).toEqual([
      '1 out of 5 stars',
      '2 out of 5 stars',
      '3 out of 5 stars',
      '4 out of 5 stars',
      '5 out of 5 stars',
    ]);
  });

  it('chooses no rating for the customer', async () => {
    const { stars, byTestID } = await render();

    expect(stars().every(star => star.props.accessibilityState.checked === false)).toBe(true);
    expect(byTestID('request-review-rating-value')[0].props.children).toBe(COPY.ratingNone);
  });

  it('marks the chosen star checked, and says the rating in words', async () => {
    const { stars, rate, byTestID } = await render();

    await rate(4);

    expect(stars().map(star => star.props.accessibilityState.checked)).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(byTestID('request-review-rating-value')[0].props.children).toBe('4 out of 5 stars');
  });

  it('draws chosen stars as a different shape, not only a different colour', async () => {
    const { rate, renderer } = await render();

    await rate(2);

    const glyphs = renderer.root
      .findAll(
        node =>
          typeof node.props?.testID === 'string' &&
          node.props.testID.startsWith('request-review-rating-') &&
          node.props.accessibilityRole === 'radio' &&
          typeof node.type === 'string',
      )
      .map(star => star.findAll(node => node.props?.name !== undefined && typeof node.type !== 'string')[0]?.props.name);

    expect(glyphs).toEqual(['star', 'star', 'starOutline', 'starOutline', 'starOutline']);
  });

  it('lets the rating be changed before sending', async () => {
    const { rate, press, send } = await render();

    await rate(5);
    await rate(1);
    await press(COPY.submit);

    expect(send).toHaveBeenCalledWith({ requestId: REQUEST.id, rating: 1 });
  });

  it('gives every star a full minimum touch target', async () => {
    const { stars } = await render();

    for (const star of stars()) {
      const style = [star.props.style].flat(Infinity).reduce(
        (all: Record<string, unknown>, entry: unknown) =>
          entry && typeof entry === 'object' ? { ...all, ...(entry as object) } : all,
        {},
      ) as { width: number; height: number };
      expect(style.width).toBeGreaterThanOrEqual(44);
      expect(style.height).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('RequestReviewScreen — validation', () => {
  it('refuses to send without a rating, and says why', async () => {
    const { press, byTestID, send } = await render();

    await press(COPY.submit);

    const [error] = byTestID('request-review-rating-error');
    expect(error.props.children).toBe(COPY.ratingRequired);
    expect(error.props.accessibilityLiveRegion).toBe('polite');
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the lowest rating on the scale', async () => {
    const { rate, press, send } = await render();

    await rate(1);
    await press(COPY.submit);

    expect(send).toHaveBeenCalledWith({ requestId: REQUEST.id, rating: 1 });
  });

  it('sends the highest rating on the scale', async () => {
    const { rate, press, send } = await render();

    await rate(5);
    await press(COPY.submit);

    expect(send).toHaveBeenCalledWith({ requestId: REQUEST.id, rating: 5 });
  });

  it('sends a rating alone when no comment was written', async () => {
    const { rate, press, send } = await render();

    await rate(3);
    await press(COPY.submit);

    expect(send.mock.calls[0][0]).toEqual({ requestId: REQUEST.id, rating: 3 });
  });

  it('treats a comment of only spaces as no comment', async () => {
    const { rate, type, press, send } = await render();

    await rate(3);
    await type('    ');
    await press(COPY.submit);

    expect(send.mock.calls[0][0]).toEqual({ requestId: REQUEST.id, rating: 3 });
  });

  it('sends a comment exactly as it was typed', async () => {
    const { rate, type, press, send } = await render();
    const comment = ' Cleared every gutter.\nShowed me the blockage. ';

    await rate(4);
    await type(comment);
    await press(COPY.submit);

    expect(send).toHaveBeenCalledWith({ requestId: REQUEST.id, rating: 4, comment });
  });

  it('refuses a comment over the ceiling, and sends one at it', async () => {
    const { rate, type, press, send, text } = await render();

    await rate(4);
    await type('a'.repeat(REVIEW_COMMENT_MAX_LENGTH + 1));
    await press(COPY.submit);

    expect(send).not.toHaveBeenCalled();
    expect(text()).toContain(
      COPY.commentTooLong.replace('{count}', String(REVIEW_COMMENT_MAX_LENGTH)),
    );

    await type('a'.repeat(REVIEW_COMMENT_MAX_LENGTH));
    await press(COPY.submit);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('labels the comment box and says it is optional', async () => {
    const { renderer, text } = await render();

    const fields = renderer.root.findAll(
      node => node.props?.accessibilityLabel === COPY.commentLabel && node.props?.onChangeText,
    );
    expect(fields.length).toBeGreaterThan(0);
    expect(text()).toContain(COPY.commentSupport);
  });
});

describe('RequestReviewScreen — sending', () => {
  it('replaces the form with the review as sent, and announces it once', async () => {
    const { rate, type, press, byTestID, labelOf, buttons } = await render();

    await rate(5);
    await type('Great work.');
    await press(COPY.submit);

    const [success] = byTestID('request-review-success');
    expect(success).toBeDefined();
    const [announcement] = success.findAll(
      node => typeof node.type === 'string' && node.props?.accessibilityLiveRegion === 'polite',
    );
    expect(announcement.props.accessibilityLabel).toBe(`${COPY.successTitle}. ${COPY.successMessage}`);
    expect(announcement.props.accessibilityRole).toBe('alert');

    expect(labelOf('request-review-read-only-rating')).toBe(`${COPY.ratingLabel}: 5 out of 5 stars`);
    expect(labelOf('request-review-read-only-comment')).toBe(`${COPY.commentLabelReadOnly}: Great work.`);
    // Nothing left to press twice.
    expect(buttons()).not.toContain(COPY.submit);
    expect(byTestID('request-review-rating')).toHaveLength(0);
  });

  it('returns to the request from the review it just sent', async () => {
    const { rate, press, goBack } = await render();

    await rate(4);
    await press(COPY.submit);
    await press(COPY.backToRequest);

    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('sends once however quickly the button is pressed twice', async () => {
    let resolve!: (review: RequestReview) => void;
    const { rate, send, button } = await render({
      submitReview: () =>
        new Promise<RequestReview>(done => {
          resolve = done;
        }),
    });

    await rate(4);
    const submit = button(COPY.submit);
    await act(async () => {
      submit.props.onPress();
      submit.props.onPress();
    });
    await settle();

    // And the button, re-rendered, is locked while the call is out.
    expect(button(COPY.submit)?.props.accessibilityState).toMatchObject({ busy: true });
    await act(async () => {
      button(COPY.submit)?.props.onPress();
    });
    await settle();

    expect(send).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ requestId: REQUEST.id, rating: 4, submittedAt: new Date().toISOString() });
    });
    await settle();
  });

  it('keeps everything entered after a failure, and retries from the same button', async () => {
    let fail = true;
    const { rate, type, press, byTestID, stars, commentValue, send } = await render({
      submitReview: async input => {
        if (fail) {
          throw new AppError({ kind: 'network', message: 'offline' });
        }
        return { ...input, submittedAt: new Date().toISOString() };
      },
    });

    await rate(3);
    await type('Fine, a little late.');
    await press(COPY.submit);

    expect(byTestID('request-review-submit-error')).toHaveLength(1);
    // Still here, still filled in.
    expect(stars()[2].props.accessibilityState.checked).toBe(true);
    expect(commentValue()).toBe('Fine, a little late.');
    expect(byTestID('request-review-success')).toHaveLength(0);

    fail = false;
    await press(COPY.submit);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({
      requestId: REQUEST.id,
      rating: 3,
      comment: 'Fine, a little late.',
    });
    expect(byTestID('request-review-success')).toHaveLength(1);
    expect(byTestID('request-review-submit-error')).toHaveLength(0);
  });

  it('shows the review that already exists when the service says there is one', async () => {
    const existing: RequestReview = {
      requestId: REQUEST.id,
      rating: 5,
      submittedAt: new Date().toISOString(),
    };
    let stored: RequestReview | null = null;
    const { rate, press, byTestID, labelOf, readReview } = await render({
      getReview: async () => stored,
      submitReview: async () => {
        // Sent from somewhere else a moment ago.
        stored = existing;
        throw new AppError({ kind: 'conflict', message: 'already reviewed' });
      },
    });

    await rate(2);
    await press(COPY.submit);
    await settle();

    expect(readReview).toHaveBeenCalledTimes(2);
    expect(labelOf('request-review-read-only-rating')).toBe(`${COPY.ratingLabel}: 5 out of 5 stars`);
    expect(byTestID('request-review-rating')).toHaveLength(0);
    // Not this screen's review, so not announced as just sent.
    expect(byTestID('request-review-success')).toHaveLength(0);
  });

  it('goes back from the header whatever state it is in', async () => {
    const { renderer, goBack } = await render();

    const [back] = renderer.root.findAll(
      node => node.props?.testID === 'request-review-back' && typeof node.props?.onPress === 'function',
    );
    await act(async () => {
      back.props.onPress();
    });

    expect(goBack).toHaveBeenCalled();
  });
});

/**
 * Against the real mocks and the device's storage: the review is its own record,
 * the request is untouched, and a restart keeps the one-review rule.
 */
describe('RequestReviewScreen — with the mock backend', () => {
  const CUSTOMER = 'usr_customer_1';
  /** The seed's completed request. */
  const COMPLETED_ID = 'REQ-24048';

  function launch() {
    const requests = new MockRequestService({
      latency: NO_LATENCY,
      history: new AsyncStorageMockRequestHistory(),
      currentCustomerId: async () => CUSTOMER,
    });
    const reviews = new MockReviewService({
      requests,
      latency: NO_LATENCY,
      storage: new AsyncStorageMockReviewStorage(),
      currentCustomerId: async () => CUSTOMER,
    });
    registerService('request', requests);
    registerService('review', reviews);
    return { requests, reviews };
  }

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('sends a review without changing the request, and keeps it across a restart', async () => {
    const { requests, reviews } = launch();
    const before = await requests.getRequest(COMPLETED_ID);

    const screen = await mount(COMPLETED_ID);
    await screen.rate(4);
    await screen.type('Switch works again.');
    await screen.press(COPY.submit);

    expect(screen.byTestID('request-review-success')).toHaveLength(1);
    expect(await requests.getRequest(COMPLETED_ID)).toEqual(before);
    expect(await reviews.getReview(COMPLETED_ID)).toMatchObject({
      rating: 4,
      comment: 'Switch works again.',
    });

    // Closed and opened again: brand-new services, reading only the device.
    launch();
    const reopened = await mount(COMPLETED_ID);

    expect(reopened.labelOf('request-review-read-only-rating')).toBe(
      `${COPY.ratingLabel}: 4 out of 5 stars`,
    );
    expect(reopened.buttons()).not.toContain(COPY.submit);
    expect(reopened.byTestID('request-review-success')).toHaveLength(0);
  });

  it('refuses the seed’s request still in progress, whatever the route says', async () => {
    launch();

    const screen = await mount('REQ-24076');

    expect(screen.byTestID('request-review-unavailable')).toHaveLength(1);
    expect(screen.buttons()).not.toContain(COPY.submit);
  });
});

/**
 * Section 54's `review_submitted`: sent once the service has accepted the
 * review, with the request and the stars — never the customer's words, never
 * for a refusal or a failure, and only once for a double tap.
 */
describe('RequestReviewScreen — what analytics is told (section 54)', () => {
  let track: jest.Mock;

  beforeEach(() => {
    track = jest.fn();
    registerService('analytics', { track, identify: jest.fn() });
  });

  it('counts the review once it is accepted, by the request and the stars alone', async () => {
    const { rate, type, press } = await render();

    await rate(4);
    await type('Skyline Roofing came on time and cleared the gutter.');
    await press(COPY.submit);

    expect(track).toHaveBeenCalledTimes(1);
    const [[event, properties]] = track.mock.calls;
    expect(event).toBe('review_submitted');
    expect(Object.keys(properties).sort()).toEqual(['rating', 'requestId']);
    expect(properties).toEqual({ requestId: REQUEST.id, rating: 4 });

    const serialised = JSON.stringify(track.mock.calls);
    for (const value of [
      'came on time',
      'Skyline Roofing',
      'ven_skyline',
      'Gutter Cleaning',
      'Roof Repair',
      'Koramangala',
    ]) {
      expect(serialised).not.toContain(value);
    }
  });

  it('counts nothing for a failed send, and once for the retry that worked', async () => {
    let fail = true;
    const { rate, press } = await render({
      submitReview: async input => {
        if (fail) {
          throw new AppError({ kind: 'network', message: 'offline' });
        }
        return { ...input, submittedAt: new Date().toISOString() };
      },
    });

    await rate(2);
    await press(COPY.submit);
    expect(track).not.toHaveBeenCalled();

    fail = false;
    await press(COPY.submit);

    expect(track.mock.calls.map(call => call[0])).toEqual(['review_submitted']);
    expect(track.mock.calls[0][1]).toEqual({ requestId: REQUEST.id, rating: 2 });
  });

  it('counts nothing when the service refuses because a review already exists', async () => {
    let stored: RequestReview | null = null;
    const { rate, press } = await render({
      getReview: async () => stored,
      submitReview: async () => {
        stored = { requestId: REQUEST.id, rating: 5, submittedAt: new Date().toISOString() };
        throw new AppError({ kind: 'conflict', message: 'already reviewed' });
      },
    });

    await rate(3);
    await press(COPY.submit);

    expect(track).not.toHaveBeenCalled();
  });

  it('counts one review for a double tap', async () => {
    let resolve!: (review: RequestReview) => void;
    const { rate, button } = await render({
      submitReview: () =>
        new Promise<RequestReview>(done => {
          resolve = done;
        }),
    });

    await rate(5);
    const submit = button(COPY.submit);
    await act(async () => {
      submit.props.onPress();
      submit.props.onPress();
    });
    await settle();
    expect(track).not.toHaveBeenCalled();

    await act(async () => {
      resolve({ requestId: REQUEST.id, rating: 5, submittedAt: new Date().toISOString() });
    });
    await settle();

    expect(track.mock.calls.map(call => call[0])).toEqual(['review_submitted']);
  });
});
