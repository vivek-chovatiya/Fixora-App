/**
 * Request details is a record, not a step, and these tests pin what makes it one:
 *
 * - it reads the request from `RequestService` by reference and needs nothing
 *   else — not the draft, not the submission record — so the same request reads
 *   the same whether it was sent a second ago or last week
 * - each of its states is reachable and has a way out: loading, the record, a
 *   failure with a retry, and a reference that matches nothing, which is not a
 *   failure and does not pretend to be one
 * - it shows what the record says and nothing it does not: dates as a person
 *   reads them, the address without its coordinates, who was asked for apart
 *   from who has the job, and no reference it was not given
 * - it changes nothing but what the owner allowed: no edit or other action the
 *   roadmap does not give a customer, nothing that could raise a request — and
 *   Cancel request only while no professional has accepted it (owner decision,
 *   21/10/2026), asked first, sent once, and settled from the service's answer
 * - a finished request shows the payment its professional recorded (sections
 *   36 and 37) — and only a finished one that has a record — as their record,
 *   never as something Fixora processed
 *
 * The fixture deliberately shares no names with the mock seed, so a test that
 * passes has passed on what the service returned.
 */

import React, { type ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setClipboard } from '@/core/clipboard/Clipboard';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { formatDateValue, formatTimeValue } from '@/features/customer/constants/requestScheduling';
import { RequestDetailsScreen } from '@/features/customer/screens/RequestDetailsScreen';
import { onCustomerRequestsChanged } from '@/features/customer/state/customerRequestSync';
import {
  RequestDraftProvider,
  useRequestDraft,
  type RequestDraft,
} from '@/features/customer/state/RequestDraftContext';
import type { SubmittedRequest } from '@/features/customer/state/requestDraft';
import { setRequestDraftStorage } from '@/features/customer/state/requestDraftStorage';
import { AsyncStorageMockRequestHistory } from '@/shared/services/mock/MockRequestHistoryStorage';
import { MockRequestService } from '@/shared/services/mock/MockRequestService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type {
  CancelRequestResult,
  CustomerRequestDetails,
  RequestService,
} from '@/shared/services/types/RequestService';
import type { RequestReview, ReviewService } from '@/shared/services/types/ReviewService';
import { ToastProvider } from '@/shared/components';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const COPY = CUSTOMER_COPY.requestDetails;
const CANCEL = CUSTOMER_COPY.cancelRequest;
const SUMMARY = CUSTOMER_COPY.confirmation;
const REFERENCE = CUSTOMER_COPY.requestSubmitted;
/** The copy button's spoken name for the fixture's reference (T135: it names what it copies). */
const COPY_REFERENCE = REFERENCE.copyReference('REQ-7001');
const STATUS = CUSTOMER_COPY.requestStatus;
const REVIEW = CUSTOMER_COPY.review;

const DETAILS: CustomerRequestDetails = {
  id: 'REQ-7001',
  reference: 'REQ-7001',
  categoryId: 'cat_roofing',
  subCategoryId: 'sub_gutter',
  categoryName: 'Roof Repair',
  serviceName: 'Gutter Cleaning',
  status: 'PENDING_VENDOR',
  priority: 'HIGH',
  preferredDate: '2026-09-11',
  preferredTime: '18:00',
  notes: 'Water pours over the gutter above the back door whenever it rains hard.',
  imageUrls: ['https://cdn.example.test/one.jpg', 'https://cdn.example.test/two.jpg'],
  address: {
    formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
    latitude: 12.9352,
    longitude: 77.6245,
    placeId: 'place_koramangala_5th',
  },
  preferredVendor: { id: 'ven_skyline', name: 'Skyline Roofing' },
  createdAt: new Date(Date.now() - 35 * 60_000).toISOString(),
};

/** A promise a test can leave hanging, so the loading state is observable. */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

let copiedValue: string | null = null;

beforeEach(() => {
  copiedValue = null;
  setClipboard({
    copy: async value => {
      copiedValue = value;
    },
  });
  setRequestDraftStorage({
    read: async () => null,
    write: async () => true,
    clear: async () => undefined,
  });
});

afterEach(() => {
  // Unmounted so a screen left loading does not leave its placeholders animating.
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  resetServices();
});

/**
 * Mounts the screen with only the toast around it unless a test adds more —
 * cancelling says how it went in a toast.
 *
 * ⚠️ Deliberately without `RequestDraftProvider`. `useRequestDraft` throws
 * outside one, so every test in this file that renders a record is also proof
 * that the screen does not reach for the draft.
 */
async function mount(
  requestId: string,
  wrap: (screen: ReactElement) => ReactElement = screen => screen,
) {
  const goBack = jest.fn();
  const navigate = jest.fn();
  /** What the screen asked to hear about, so a test can bring it back into focus. */
  const listeners: Record<string, Array<() => void>> = {};
  const addListener = jest.fn((event: string, listener: () => void) => {
    (listeners[event] ??= []).push(listener);
    return () => {
      listeners[event] = (listeners[event] ?? []).filter(entry => entry !== listener);
    };
  });
  const navigation = { goBack, navigate, addListener } as never;
  const route = {
    key: 'RequestDetails',
    name: 'RequestDetails' as const,
    params: { requestId },
  } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <ToastProvider>
          {wrap(<RequestDetailsScreen navigation={navigation} route={route} />)}
        </ToastProvider>
      </ThemeProvider>,
    );
  });

  mounted.push(renderer);

  const byTestID = (id: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id);

  return {
    renderer,
    goBack,
    navigate,
    /** The customer coming back to this screen — from the review screen, say. */
    focus: async () => {
      await act(async () => {
        for (const listener of listeners.focus ?? []) {
          listener();
        }
      });
      await act(async () => {});
    },
    text: () => textOf(renderer.toJSON()),
    byTestID,
    labelOf: (id: string): string | undefined => byTestID(id)[0]?.props.accessibilityLabel,
    /** Every control a finger could press, by its accessible name. */
    buttons: () =>
      renderer.root
        .findAll(
          node =>
            node.props?.accessibilityRole === 'button' &&
            typeof node.props?.onPress === 'function',
        )
        .map(node => node.props.accessibilityLabel as string),
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
      await act(async () => {});
    },
    /** The cancel confirmation, when it is open. */
    dialog: () =>
      renderer.root.findAll(
        node =>
          typeof node.type === 'string' && node.props?.testID === 'request-details-cancel-dialog',
      )[0],
    /**
     * A button inside the confirmation, by its accessible name. Scoped, because
     * the page's own "Cancel request" is still mounted under the dialog.
     */
    dialogButton: (label: string) => {
      const [dialog] = renderer.root.findAll(
        node =>
          typeof node.type === 'string' && node.props?.testID === 'request-details-cancel-dialog',
      );
      if (!dialog) {
        throw new Error('The cancel confirmation is not open');
      }
      const [target] = dialog.findAll(
        node =>
          node.props?.accessibilityRole === 'button' &&
          node.props?.accessibilityLabel === label &&
          typeof node.props?.onPress === 'function',
      );
      if (!target) {
        throw new Error(`No button labelled "${label}" in the confirmation`);
      }
      return target;
    },
    /**
     * The page's own Cancel request. The first by that name: the page is drawn
     * before the confirmation, which repeats the words on its own button.
     */
    cancelButton: () =>
      renderer.root.findAll(
        node =>
          node.props?.accessibilityRole === 'button' &&
          node.props?.accessibilityLabel === CANCEL.action &&
          typeof node.props?.onPress === 'function',
      )[0],
  };
}

interface Stubs {
  getRequest?: (requestId: string) => Promise<CustomerRequestDetails | null>;
  getReview?: (requestId: string) => Promise<RequestReview | null>;
  cancelRequest?: (requestId: string) => Promise<CancelRequestResult>;
  requestId?: string;
  wrap?: (screen: ReactElement) => ReactElement;
}

async function render({
  getRequest,
  getReview,
  cancelRequest,
  requestId = DETAILS.id,
  wrap,
}: Stubs = {}) {
  const read = jest.fn(getRequest ?? (async (_requestId: string) => DETAILS));
  const readReview = jest.fn(getReview ?? (async (_requestId: string) => null));
  /*
    Throws unless a test says otherwise: every test that does not press Cancel
    request is also proof that nothing else on the page cancels anything.
  */
  const cancel = jest.fn(
    cancelRequest ??
      ((_requestId: string): Promise<CancelRequestResult> => {
        throw new Error('cancelRequest must not be called unless Cancel request is confirmed');
      }),
  );

  registerService('review', {
    getReview: readReview,
    // Details only ever reads a review; sending one is the review screen's.
    submitReview: jest.fn(() => {
      throw new Error('submitReview must never be called from request details');
    }),
    // A vendor's read (Phase 3E-6); a customer screen has no business with it.
    getVendorReviews: jest.fn(() => {
      throw new Error('getVendorReviews must never be called from a customer screen');
    }),
  } as ReviewService);

  registerService('request', {
    listRecentRequests: jest.fn(() => {
      throw new Error('listRecentRequests must not be called from request details');
    }),
    // A record cannot raise a request, however it is pressed or retried.
    createRequest: jest.fn(() => {
      throw new Error('createRequest must never be called from request details');
    }),
    getRequest: read,
    listRequests: jest.fn(() => {
      throw new Error('listRequests must not be called from request details');
    }),
    cancelRequest: cancel,
  } as RequestService);

  return { ...(await mount(requestId, wrap)), read, readReview, cancel };
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

describe('RequestDetailsScreen — reading the request', () => {
  it('asks the service for the request it was handed, once', async () => {
    const { read, byTestID } = await render();

    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith('REQ-7001');
    expect(byTestID('request-details-record')).toHaveLength(1);
  });

  it('holds the shape of the page while the request is on its way', async () => {
    const { byTestID, renderer, text } = await render({ getRequest: () => pending() });

    expect(byTestID('request-details-loading')).toHaveLength(1);
    expect(byTestID('request-details-record')).toHaveLength(0);

    const busy = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.accessibilityRole === 'progressbar',
    );

    // Once, with a name — never the bare word "busy".
    expect(busy).toHaveLength(1);
    expect(busy[0].props.accessibilityLabel).toBe(COPY.loadingLabel);
    expect(busy[0].props.accessibilityState).toEqual({ busy: true });
    // Named before anything has loaded.
    expect(text()).toContain(COPY.title);
  });

  it('names the screen as a heading', async () => {
    const { byTestID } = await render();

    const [heading] = byTestID('request-details-heading');

    expect(heading.props.accessibilityRole).toBe('header');
  });

  it('goes back the way it came', async () => {
    const { press, goBack } = await render();

    await press(COPY.back);

    expect(goBack).toHaveBeenCalledTimes(1);
  });
});

describe('RequestDetailsScreen — a reference that matches nothing', () => {
  it('says so plainly, without calling it a failure', async () => {
    const { byTestID, text, buttons } = await render({ getRequest: async () => null });

    expect(byTestID('request-details-not-found')).toHaveLength(1);
    expect(byTestID('request-details-error')).toHaveLength(0);
    expect(text()).toContain(COPY.notFoundTitle);
    // Retrying a reference that matches nothing is offering to fail again.
    expect(buttons()).not.toContain('Try again');
  });

  it('offers the way home', async () => {
    const { press, navigate } = await render({ getRequest: async () => null });

    await press(COPY.home);

    expect(navigate).toHaveBeenCalledWith('CustomerTabs', { screen: 'Home' });
  });
});

describe('RequestDetailsScreen — when the service fails', () => {
  const failure = new AppError({
    kind: 'network',
    message: 'AxiosError: connect ECONNREFUSED 10.0.2.2:8080',
  });

  it('shows the safe message and never the developer one', async () => {
    const { byTestID, text } = await render({
      getRequest: async () => {
        throw failure;
      },
    });

    expect(byTestID('request-details-error')).toHaveLength(1);
    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain('ECONNREFUSED');
    expect(text()).not.toContain('AxiosError');
  });

  it('offers a retry and the way home', async () => {
    const { buttons } = await render({
      getRequest: async () => {
        throw failure;
      },
    });

    expect(buttons()).toEqual(expect.arrayContaining(['Try again', COPY.home]));
  });

  it('retries by reading again, and shows the request when it arrives', async () => {
    const getRequest = jest
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(DETAILS);

    const { press, read, byTestID } = await render({ getRequest });

    expect(read).toHaveBeenCalledTimes(1);

    await press('Try again');

    // The same reference, read again — the stub's createRequest throws, so a
    // retry that raised anything would have failed this test on the spot.
    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenLastCalledWith('REQ-7001');
    expect(byTestID('request-details-error')).toHaveLength(0);
    expect(byTestID('request-details-record')).toHaveLength(1);
  });

  it('still offers Home for a failure that is not worth retrying', async () => {
    const { buttons, press, navigate } = await render({
      getRequest: async () => {
        throw new AppError({ kind: 'forbidden', message: '403' });
      },
    });

    expect(buttons()).not.toContain('Try again');

    await press(COPY.home);

    expect(navigate).toHaveBeenCalledWith('CustomerTabs', { screen: 'Home' });
  });
});

describe('RequestDetailsScreen — status and reference', () => {
  it('states the current status in words', async () => {
    const { labelOf, text } = await render();

    // A chosen professional who has not responded (the fixture is directed).
    expect(text()).toContain(STATUS.awaiting_vendor.title);
    expect(labelOf('request-details-status')).toContain(
      `${STATUS.summaryPrefix}: ${STATUS.awaiting_vendor.title}.`,
    );
  });

  it('does not rest the status on colour alone', async () => {
    const { renderer } = await render();

    const glyphs = renderer.root.findAll(
      node => typeof node.type !== 'string' && node.props?.name === 'pending',
    );

    expect(glyphs.length).toBeGreaterThan(0);
  });

  it('shows a status it does not know as unavailable, and keeps the rest', async () => {
    const { byTestID, text } = await render({
      getRequest: async () => ({ ...DETAILS, status: 'ESCALATED_TO_REGION' }),
    });

    // Section 21: the app invents no statuses, and it does not guess at one.
    expect(text()).toContain(STATUS.unknown.title);
    expect(text()).toContain(STATUS.unknown.description);
    expect(text()).not.toContain(STATUS.completed.title);
    expect(byTestID('request-status-progress')).toHaveLength(0);
    // The record is still a record.
    expect(byTestID('details-address').length).toBeGreaterThan(0);
    expect(byTestID('request-details-reference').length).toBeGreaterThan(0);
  });

  it('shows the reference the record carries, and copies it', async () => {
    const { labelOf, press, text } = await render();

    expect(labelOf('request-details-reference')).toBe(`${REFERENCE.referenceLabel}: REQ-7001`);

    await press(COPY_REFERENCE);

    expect(copiedValue).toBe('REQ-7001');
    expect(text()).toContain(REFERENCE.copied);
  });

  it('names its copy button for the reference it copies, as a button beside it (T135)', async () => {
    const { renderer } = await render();

    const [button] = renderer.root.findAll(
      node =>
        node.props?.testID === 'request-details-reference-copy' &&
        typeof node.props?.onPress === 'function',
    );
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe(COPY_REFERENCE);
    expect(button.props.accessibilityHint).toBe(REFERENCE.copyHint);
  });

  it('shows and copies the backend’s quotable reference, never its database id', async () => {
    const { labelOf, press, text } = await render({
      getRequest: async () => ({ ...DETAILS, id: '6afc3ea3c2951ec40c9a177a', reference: 'REQ-0031002405' }),
    });

    expect(labelOf('request-details-reference')).toBe(`${REFERENCE.referenceLabel}: REQ-0031002405`);
    expect(text()).not.toContain('6afc3ea3c2951ec40c9a177a');

    await press(REFERENCE.copyReference('REQ-0031002405'));

    expect(copiedValue).toBe('REQ-0031002405');
  });

  it('draws no reference block when the record has none — never the id in its place', async () => {
    const { byTestID, text } = await render({ getRequest: async () => ({ ...DETAILS, reference: undefined }) });

    expect(byTestID('request-details-reference')).toHaveLength(0);
    expect(text()).not.toContain(REFERENCE.referenceLabel);
    expect(text()).not.toContain('undefined');
    expect(text()).not.toContain('null');
    // The rest of the record is still a record.
    expect(text()).toContain('Gutter Cleaning');
  });
});

/**
 * The status card makes claims about something the app cannot see, so each stage
 * is rendered from a record and checked for exactly what it says: its heading,
 * its sentence, which steps are complete, which is current — and that nothing
 * after the current step is drawn as having happened.
 */
describe('RequestDetailsScreen — the lifecycle status', () => {
  const OPEN = { ...DETAILS, preferredVendor: undefined };

  const cases = [
    { name: 'a submitted request', record: { ...OPEN, status: 'CREATED' }, state: 'submitted' },
    { name: 'open dispatch', record: { ...OPEN, status: 'PENDING_VENDOR' }, state: 'searching' },
    {
      name: 'a chosen professional',
      record: { ...DETAILS, status: 'PENDING_VENDOR' },
      state: 'awaiting_vendor',
    },
    {
      name: 'an assigned request',
      record: { ...DETAILS, status: 'ACCEPTED', vendorName: 'Skyline Roofing' },
      state: 'assigned',
    },
    {
      name: 'a request in progress',
      record: { ...OPEN, status: 'IN_PROGRESS', vendorName: 'Skyline Roofing' },
      state: 'in_progress',
    },
    {
      name: 'a completed request',
      record: { ...OPEN, status: 'COMPLETED', vendorName: 'Skyline Roofing' },
      state: 'completed',
    },
  ] as const;

  for (const { name, record, state } of cases) {
    it(`heads ${name} with its status and what it means`, async () => {
      const { byTestID, text, labelOf } = await render({ getRequest: async () => record });

      const [title] = byTestID('request-status-title');
      const [description] = byTestID('request-status-description');

      expect(title.props.children).toBe(STATUS[state].title);
      expect(description.props.children).toBe(STATUS[state].description);
      expect(labelOf('request-details-status')).toContain(STATUS[state].description);
      expect(text()).not.toContain(record.status);
    });
  }

  it('draws open dispatch as submitted, then searching, with the rest to come', async () => {
    const { byTestID } = await render({
      getRequest: async () => ({ ...OPEN, status: 'PENDING_VENDOR' }),
    });

    expect(byTestID('request-status-step-submitted-complete')).toHaveLength(1);
    expect(byTestID('request-status-step-searching-current')).toHaveLength(1);
    expect(byTestID('request-status-step-assigned-upcoming')).toHaveLength(1);
    expect(byTestID('request-status-step-in_progress-upcoming')).toHaveLength(1);
    expect(byTestID('request-status-step-completed-upcoming')).toHaveLength(1);
    // Never waiting on a professional nobody chose.
    expect(byTestID('request-status-step-awaiting_vendor-current')).toHaveLength(0);
  });

  it('draws a chosen professional as awaiting their response, not searching', async () => {
    const { byTestID } = await render();

    expect(byTestID('request-status-step-awaiting_vendor-current')).toHaveLength(1);
    expect(byTestID('request-status-step-searching-current')).toHaveLength(0);
    expect(byTestID('request-status-step-assigned-upcoming')).toHaveLength(1);
  });

  it('never draws a step after the current one as complete', async () => {
    const { renderer } = await render({
      getRequest: async () => ({ ...DETAILS, status: 'ACCEPTED', vendorName: 'Skyline Roofing' }),
    });

    const steps = renderer.root
      .findAll(
        node =>
          typeof node.type === 'string' &&
          typeof node.props?.testID === 'string' &&
          node.props.testID.startsWith('request-status-step-'),
      )
      .map(node => node.props.testID as string);

    expect(steps).toEqual([
      'request-status-step-submitted-complete',
      'request-status-step-awaiting_vendor-complete',
      'request-status-step-assigned-current',
      'request-status-step-in_progress-upcoming',
      'request-status-step-completed-upcoming',
    ]);
  });

  it('marks every step of a completed request complete', async () => {
    const { renderer } = await render({
      getRequest: async () => ({ ...OPEN, status: 'COMPLETED', vendorName: 'Skyline Roofing' }),
    });

    const steps = renderer.root
      .findAll(
        node =>
          typeof node.type === 'string' &&
          typeof node.props?.testID === 'string' &&
          node.props.testID.startsWith('request-status-step-'),
      )
      .map(node => node.props.testID as string);

    expect(steps).toHaveLength(5);
    expect(steps.every(id => id.endsWith('-complete'))).toBe(true);
  });

  it('tells a screen reader what is complete and what is current, in one node', async () => {
    const { labelOf, byTestID } = await render({
      getRequest: async () => ({ ...OPEN, status: 'PENDING_VENDOR' }),
    });

    expect(labelOf('request-details-status')).toBe(
      `${STATUS.summaryPrefix}: ${STATUS.searching.title}. ${STATUS.searching.description} ` +
        `${STATUS.submitted.title} ${STATUS.stepComplete}. ` +
        `${STATUS.searching.title} ${STATUS.stepCurrent}.`,
    );

    // The markers are decoration; the summary above is what is heard.
    const [progress] = byTestID('request-status-progress');
    expect(progress.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(progress.props.accessibilityElementsHidden).toBe(true);
  });

  it('draws no path for a cancelled request, only what happened', async () => {
    const { byTestID, text } = await render({
      getRequest: async () => ({ ...DETAILS, status: 'CANCELLED' }),
    });

    expect(text()).toContain(STATUS.cancelled.title);
    expect(byTestID('request-status-progress')).toHaveLength(0);
  });

  it('keeps a professional unassigned while the status says nobody has the job', async () => {
    const { byTestID, labelOf, text } = await render({
      // A record can carry a vendor name before acceptance; the status decides.
      getRequest: async () => ({ ...OPEN, status: 'PENDING_VENDOR', vendorName: 'Skyline Roofing' }),
    });

    expect(labelOf('details-vendor')).toBe(`${COPY.requestedLabel}: ${SUMMARY.vendorOpen}`);
    expect(byTestID('details-assigned')).toHaveLength(0);
    expect(text()).not.toContain('Skyline Roofing');
    expect(text()).toContain(STATUS.searching.title);
  });

  it('names the assigned professional once the status says they have the job', async () => {
    const { labelOf } = await render({
      getRequest: async () => ({ ...DETAILS, status: 'ACCEPTED', vendorName: 'Skyline Roofing' }),
    });

    expect(labelOf('details-vendor')).toBe(`${COPY.requestedLabel}: Skyline Roofing`);
    expect(labelOf('details-assigned')).toBe(`${COPY.assignedLabel}: Skyline Roofing`);
  });

  it('keeps every section of the record whatever the status', async () => {
    for (const status of ['CREATED', 'COMPLETED', 'MYSTERY_STATE']) {
      const { byTestID } = await render({ getRequest: async () => ({ ...DETAILS, status }) });

      for (const section of [
        'request-details-summary',
        'request-details-service',
        'request-details-details',
        'request-details-location',
        'request-details-professional',
        'request-details-extras',
      ]) {
        expect(byTestID(section).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('RequestDetailsScreen — what the request was for', () => {
  it('names the service and the category it sits in', async () => {
    const { byTestID, text } = await render();

    expect(byTestID('details-service').length).toBeGreaterThan(0);
    expect(text()).toContain('Gutter Cleaning');
    expect(text()).toContain('Roof Repair');
  });

  it('shows urgency as a label, not only a badge', async () => {
    const { labelOf } = await render();

    expect(labelOf('details-priority')).toBe(`${SUMMARY.priorityLabel}: High`);
  });

  it('reads the date back as a person would say it', async () => {
    const { labelOf, text } = await render();

    const expected = formatDateValue('2026-09-11', CUSTOMER_COPY.createRequest);

    expect(labelOf('details-date')).toBe(`${SUMMARY.dateLabel}: ${expected}`);
    // Never the contract's own format.
    expect(text()).not.toContain('2026-09-11');
  });

  it('reads the time back in the reader’s own clock', async () => {
    const { labelOf } = await render();

    expect(labelOf('details-time')).toBe(`${SUMMARY.timeLabel}: ${formatTimeValue('18:00')}`);
  });

  it('draws no row for a preference that was never given', async () => {
    const { byTestID } = await render({
      getRequest: async () => ({ ...DETAILS, preferredDate: undefined, preferredTime: undefined }),
    });

    expect(byTestID('details-date')).toHaveLength(0);
    expect(byTestID('details-time')).toHaveLength(0);
  });
});

describe('RequestDetailsScreen — where the work is', () => {
  it('shows the service address', async () => {
    const { labelOf, text } = await render();

    expect(text()).toContain(DETAILS.address.formattedAddress);
    expect(labelOf('details-address')).toBe(
      `${SUMMARY.addressLabel}: ${DETAILS.address.formattedAddress}`,
    );
  });

  it('never shows or announces the coordinates behind it', async () => {
    const { text, renderer } = await render();

    const spoken = renderer.root
      .findAll(node => typeof node.props?.accessibilityLabel === 'string')
      .map(node => node.props.accessibilityLabel as string)
      .join(' | ');

    for (const hidden of ['12.9352', '77.6245', 'place_koramangala_5th']) {
      expect(text()).not.toContain(hidden);
      expect(spoken).not.toContain(hidden);
    }
  });
});

describe('RequestDetailsScreen — the professional', () => {
  it('names the professional the customer asked for', async () => {
    const { labelOf } = await render();

    expect(labelOf('details-vendor')).toBe(`${COPY.requestedLabel}: Skyline Roofing`);
  });

  it('never presents a request as accepted when the record does not say so', async () => {
    const { byTestID, text } = await render();

    // Asked for, not assigned: section 20's wait on one specific professional.
    expect(byTestID('details-assigned')).toHaveLength(0);
    expect(text()).not.toContain(COPY.assignedLabel);
    expect(text()).not.toMatch(/accepted|notified|on (the|their) way/i);
  });

  it('says "Any available professional" for open dispatch', async () => {
    const { labelOf, text } = await render({
      getRequest: async () => ({ ...DETAILS, preferredVendor: undefined }),
    });

    expect(labelOf('details-vendor')).toBe(`${COPY.requestedLabel}: ${SUMMARY.vendorOpen}`);
    expect(text()).not.toContain('Skyline Roofing');
  });

  it('shows who has the job only when the record names them', async () => {
    const { labelOf } = await render({
      getRequest: async () => ({ ...DETAILS, status: 'ACCEPTED', vendorName: 'Skyline Roofing' }),
    });

    expect(labelOf('details-assigned')).toBe(`${COPY.assignedLabel}: Skyline Roofing`);
  });
});

describe('RequestDetailsScreen — notes and photographs', () => {
  it('shows the notes whole, as a paragraph', async () => {
    const { labelOf, text } = await render();

    expect(text()).toContain(DETAILS.notes);
    expect(labelOf('details-notes')).toBe(`${SUMMARY.notesLabel}: ${DETAILS.notes}`);
  });

  it('shows the photographs, and counts them in words', async () => {
    const { renderer, labelOf } = await render();

    const images = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.source?.uri !== undefined,
    );

    expect(images.map(image => image.props.source.uri)).toEqual(DETAILS.imageUrls);
    expect(labelOf('details-photos')).toBe(`${SUMMARY.photosLabel}: 2 ${SUMMARY.photoCountMany}`);
  });

  it('counts a single photograph in the singular', async () => {
    const { labelOf } = await render({
      getRequest: async () => ({ ...DETAILS, imageUrls: ['https://cdn.example.test/one.jpg'] }),
    });

    expect(labelOf('details-photos')).toBe(`${SUMMARY.photosLabel}: ${SUMMARY.photoCountOne}`);
  });

  it('marks a photograph that will not load, in shape and in words', async () => {
    const { renderer, byTestID, labelOf } = await render();

    const [broken] = renderer.root.findAll(
      node =>
        typeof node.props?.onError === 'function' &&
        node.props?.source?.uri === 'https://cdn.example.test/two.jpg',
    );

    await act(async () => {
      broken.props.onError({ nativeEvent: { error: 'unreachable' } });
    });

    expect(byTestID('request-photo-unavailable')).toHaveLength(1);
    expect(labelOf('details-photos')).toBe(
      `${SUMMARY.photosLabel}: 2 ${SUMMARY.photoCountMany}, 1 ${SUMMARY.photoUnavailable}`,
    );
    // The other photograph is still a photograph.
    const images = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.source?.uri !== undefined,
    );
    expect(images.map(image => image.props.source.uri)).toEqual([
      'https://cdn.example.test/one.jpg',
    ]);
  });

  it('draws no empty group when there are neither notes nor photographs', async () => {
    const { byTestID, text } = await render({
      getRequest: async () => ({ ...DETAILS, notes: undefined, imageUrls: undefined }),
    });

    expect(byTestID('request-details-extras')).toHaveLength(0);
    expect(byTestID('details-photos')).toHaveLength(0);
    expect(text()).not.toContain('undefined');
  });

  it('shows notes without a photo strip when there are no photographs', async () => {
    const { byTestID } = await render({
      getRequest: async () => ({ ...DETAILS, imageUrls: [] }),
    });

    expect(byTestID('details-notes').length).toBeGreaterThan(0);
    expect(byTestID('details-photos')).toHaveLength(0);
  });

  it('draws no note that is nothing but spaces', async () => {
    const { byTestID } = await render({
      getRequest: async () => ({ ...DETAILS, notes: '   ', imageUrls: [] }),
    });

    expect(byTestID('details-notes')).toHaveLength(0);
    expect(byTestID('request-details-extras')).toHaveLength(0);
  });
});

describe('RequestDetailsScreen — read-only', () => {
  it('offers nothing but Back, Copy and — while nobody has accepted it — Cancel request', async () => {
    // The fixture is waiting on the professional it was sent to.
    const { buttons, text } = await render();

    expect(new Set(buttons())).toEqual(new Set([COPY.back, COPY_REFERENCE, CANCEL.action]));
    // No edit, no change, no submit — the request has gone.
    expect(text()).not.toContain(SUMMARY.edit);
    expect(text()).not.toContain(SUMMARY.submit);
  });

  it('shows no internal identifiers', async () => {
    const { text } = await render();

    expect(text()).not.toContain('cat_roofing');
    expect(text()).not.toContain('sub_gutter');
    expect(text()).not.toContain('ven_skyline');
  });
});

/**
 * The customer action contract (docs/WORKING_NOTES.md, "Customer actions").
 *
 * The backend moves a request through section 21 (sections 33 to 36), so what
 * is pinned here is mostly absence: in every status section 21 names, through
 * both dispatch modes, and for a status the app has never heard of. What the
 * screen offers everywhere is the same, because none of it changes anything.
 * The one operation on the request is the owner's of 21/10/2026: Cancel request,
 * for `CREATED` and `PENDING_VENDOR` alone — before anybody has accepted it —
 * and so the only place the pattern below may meet the word "cancel".
 */
describe('RequestDetailsScreen — customer actions', () => {
  const OPEN = { ...DETAILS, preferredVendor: undefined };

  /** Section 21's statuses, primary then alternative, and one it does not name. */
  const STATUSES = [
    'CREATED',
    'PENDING_VENDOR',
    'ACCEPTED',
    'IN_PROGRESS',
    'COMPLETED',
    'CLOSED',
    'REJECTED',
    'CANCELLED',
    'ON_HOLD',
    'ESCALATED_TO_REGION',
  ];

  /** The words of an action the roadmap does not give a customer. */
  const UNSUPPORTED = /cancel|reschedul|edit|change|review|rate|chat|call|contact|track|rebook|repeat|pay/i;

  /** Every name and hint on anything a finger could press, whatever its role. */
  function pressableWords(renderer: ReactTestRenderer.ReactTestRenderer): string[] {
    return renderer.root
      .findAll(node => typeof node.props?.onPress === 'function')
      .flatMap(node => [node.props.accessibilityLabel, node.props.accessibilityHint, node.props.label])
      .filter((word): word is string => typeof word === 'string');
  }

  /** What pulling the page down calls, or undefined when the page offers no pull. */
  function pullOf(renderer: ReactTestRenderer.ReactTestRenderer): (() => void) | undefined {
    const [scroller] = renderer.root.findAll(node => React.isValidElement(node.props?.refreshControl));
    return scroller?.props.refreshControl.props.onRefresh;
  }

  /**
   * Section 24's review: the one action the roadmap does give a customer, and
   * only on a completed or closed request (`reviewAvailabilityOf`). It is not an
   * operation on the request — the review is its own record — so it is the only
   * word the pattern above is allowed to meet, and only here.
   */
  const REVIEWABLE = new Set(['COMPLETED', 'CLOSED']);
  const REVIEW_WORDS = new Set<string>([REVIEW.detailsAction, REVIEW.detailsActionHint]);

  /** Before anybody has accepted it: the owner's rule for Cancel request. */
  const CANCELLABLE = new Set(['CREATED', 'PENDING_VENDOR']);
  const CANCEL_WORDS = new Set<string>([CANCEL.action, CANCEL.actionHint]);

  for (const status of STATUSES) {
    const expected = REVIEWABLE.has(status)
      ? [COPY.back, COPY_REFERENCE, REVIEW.detailsAction]
      : CANCELLABLE.has(status)
        ? [COPY.back, COPY_REFERENCE, CANCEL.action]
        : [COPY.back, COPY_REFERENCE];

    it(`offers only ${expected.join(', ')} for ${status}, whichever way it was sent`, async () => {
      for (const record of [DETAILS, OPEN]) {
        const { buttons, renderer } = await render({ getRequest: async () => ({ ...record, status }) });

        expect(new Set(buttons())).toEqual(new Set(expected));
        // Not under another role either: nothing pressable is named for an
        // action a customer does not have.
        for (const word of pressableWords(renderer)) {
          if (REVIEWABLE.has(status) && REVIEW_WORDS.has(word)) {
            continue;
          }
          if (CANCELLABLE.has(status) && CANCEL_WORDS.has(word)) {
            continue;
          }
          expect(word).not.toMatch(UNSUPPORTED);
        }
      }
    });
  }

  it('offers Cancel request for a waiting status written in another case or with padding', async () => {
    // Forgiven exactly as `requestStateOf` forgives it: the same status, not a new one.
    for (const status of [' pending_vendor ', 'Created']) {
      const { buttons } = await render({ getRequest: async () => ({ ...DETAILS, status }) });

      expect(buttons()).toContain(CANCEL.action);
    }
  });

  it('offers Back alone when the record carries no reference to copy', async () => {
    const { buttons } = await render({
      getRequest: async () => ({ ...DETAILS, status: 'ACCEPTED', reference: undefined }),
    });

    // The id is never offered for copying in the reference's place.
    expect(buttons()).toEqual([COPY.back]);
  });

  it('reads the request again when pulled, in every status, and changes nothing', async () => {
    for (const status of STATUSES) {
      const { renderer, read, byTestID } = await render({
        getRequest: async () => ({ ...OPEN, status }),
      });
      const before = byTestID('request-status-title')[0].props.children;

      const pull = pullOf(renderer);
      expect(pull).toBeDefined();

      await act(async () => {
        pull?.();
      });
      await act(async () => {});

      // A read of the same reference, and only a read — the stub's
      // createRequest throws, so a pull that raised anything fails here.
      expect(read).toHaveBeenCalledTimes(2);
      expect(read).toHaveBeenLastCalledWith(DETAILS.id);
      expect(byTestID('request-status-title')[0].props.children).toBe(before);
    }
  });

  it('offers no pull until there is a record to read again', async () => {
    const loading = await render({ getRequest: () => pending() });
    const missing = await render({ getRequest: async () => null });
    const failed = await render({
      getRequest: async () => {
        throw new AppError({ kind: 'network', message: 'offline' });
      },
    });

    // The failure has its own retry; a pull beside it would be a hidden second one.
    expect(pullOf(loading.renderer)).toBeUndefined();
    expect(pullOf(missing.renderer)).toBeUndefined();
    expect(pullOf(failed.renderer)).toBeUndefined();
  });
});

/** Records a sent request the way the confirmation screen would have. */
function SubmissionSeed({ draft, outcome }: { draft: RequestDraft; outcome: SubmittedRequest }) {
  const { startDraft, recordSubmission } = useRequestDraft();
  const seeded = React.useRef(false);

  if (!seeded.current) {
    seeded.current = true;
    startDraft(draft);
    recordSubmission(outcome);
  }

  return null;
}

describe('RequestDetailsScreen — a request that was just sent', () => {
  it('reads back what was submitted after the draft is gone', async () => {
    const requests = new MockRequestService({ latency: NO_LATENCY });
    registerService('request', requests);

    const address = { formattedAddress: '27, 11th Main, 4th Block, Jayanagar, Bengaluru 560011' };
    const created = await requests.createRequest({
      categoryId: 'cat_electrician',
      subCategoryId: 'sub_fan_repair',
      priority: 'EMERGENCY',
      address,
      vendorId: 'ven_sharma_electricals',
    });

    let draftAfterSubmission: RequestDraft | null | undefined;

    function DraftProbe() {
      draftAfterSubmission = useRequestDraft().draft;
      return null;
    }

    const screen = await mount(created.id, details => (
      <RequestDraftProvider>
        <SubmissionSeed
          draft={{
            categoryId: 'cat_electrician',
            subCategoryId: 'sub_fan_repair',
            values: { priority: 'EMERGENCY', preferredDate: '', preferredTime: '', notes: '' },
            imageUrls: [],
            address,
            vendor: { kind: 'vendor', vendorId: 'ven_sharma_electricals' },
          }}
          outcome={{
            reference: created.id,
            categoryId: 'cat_electrician',
            subCategoryId: 'sub_fan_repair',
            address,
            vendor: { kind: 'vendor', vendorId: 'ven_sharma_electricals' },
          }}
        />
        <DraftProbe />
        {details}
      </RequestDraftProvider>
    ));

    // The draft that became this request no longer exists…
    expect(draftAfterSubmission).toBeNull();

    // …and the request reads back in full from the service regardless.
    expect(screen.labelOf('request-details-reference')).toBe(
      `${REFERENCE.referenceLabel}: ${created.id}`,
    );
    // Sent to a chosen professional, so it opens waiting on their response.
    expect(screen.text()).toContain(STATUS.awaiting_vendor.title);
    expect(screen.byTestID('request-status-step-awaiting_vendor-current')).toHaveLength(1);
    expect(screen.text()).toContain('Fan Repair');
    expect(screen.text()).toContain('Electrician');
    expect(screen.labelOf('details-priority')).toBe(`${SUMMARY.priorityLabel}: Emergency`);
    expect(screen.text()).toContain(address.formattedAddress);
    expect(screen.labelOf('details-vendor')).toBe(`${COPY.requestedLabel}: Sharma Electricals`);
  });
});

/**
 * The same request after the app has been closed and opened again: a new
 * service, reading only what the device kept. Everything the screen showed
 * before has to come back — and the stage is derived again from the saved
 * status rather than remembered.
 */
describe('RequestDetailsScreen — a request raised before a restart', () => {
  const NOTES = 'The ceiling fan grinds and stops after about ten minutes.';
  const ADDRESS = {
    formattedAddress:
      'Flat 1204, Tower B, Prestige Shantiniketan Apartments, Whitefield Main Road, Whitefield, Bengaluru 560066',
    latitude: 12.9698,
    longitude: 77.75,
  };

  /** A service the way the app builds one on launch, for one signed-in customer. */
  const launch = () =>
    new MockRequestService({
      latency: NO_LATENCY,
      history: new AsyncStorageMockRequestHistory(),
      currentCustomerId: async () => 'usr_customer_1',
    });

  /** Lets every read through the service and the device finish. */
  const settle = () =>
    act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });

  /** Raises a request, then "restarts": the screen reads from a brand-new service. */
  async function raiseThenRestart() {
    await AsyncStorage.clear();

    const created = await launch().createRequest({
      categoryId: 'cat_electrician',
      subCategoryId: 'sub_fan_repair',
      priority: 'EMERGENCY',
      preferredTime: '18:00',
      notes: NOTES,
      imageUrls: ['https://cdn.example.test/one.jpg', 'https://cdn.example.test/two.jpg'],
      address: ADDRESS,
      vendorId: 'ven_sharma_electricals',
    });

    const restarted = launch();
    registerService('request', restarted);

    // Mounted with no draft provider: the record comes back without one.
    const screen = await mount(created.id);
    await settle();

    return { created, restarted, screen };
  }

  it('opens with everything it was sent with', async () => {
    const { created, screen } = await raiseThenRestart();

    expect(screen.labelOf('request-details-reference')).toBe(
      `${REFERENCE.referenceLabel}: ${created.id}`,
    );
    expect(screen.byTestID('request-status-title')[0].props.children).toBe(
      STATUS.awaiting_vendor.title,
    );
    expect(screen.byTestID('request-status-step-awaiting_vendor-current')).toHaveLength(1);
    expect(screen.labelOf('details-address')).toBe(
      `${SUMMARY.addressLabel}: ${ADDRESS.formattedAddress}`,
    );
    expect(screen.labelOf('details-vendor')).toBe(`${COPY.requestedLabel}: Sharma Electricals`);
    // Still asked for and not taken: a restart does not make anyone assigned.
    expect(screen.byTestID('details-assigned')).toHaveLength(0);
    expect(screen.labelOf('details-priority')).toBe(`${SUMMARY.priorityLabel}: Emergency`);
    expect(screen.labelOf('details-notes')).toBe(`${SUMMARY.notesLabel}: ${NOTES}`);
    expect(screen.labelOf('details-photos')).toBe(`${SUMMARY.photosLabel}: 2 ${SUMMARY.photoCountMany}`);
    expect(screen.text()).not.toContain('12.9698');
  });

  it('still copies its reference', async () => {
    const { created, screen } = await raiseThenRestart();

    await screen.press(REFERENCE.copyReference(created.id));

    expect(copiedValue).toBe(created.id);
  });

  it('reads it again when pulled, and nothing changes or doubles', async () => {
    const { created, restarted, screen } = await raiseThenRestart();

    const [scroller] = screen.renderer.root.findAll(node =>
      React.isValidElement(node.props?.refreshControl),
    );

    await act(async () => {
      scroller.props.refreshControl.props.onRefresh();
    });
    await settle();

    expect(screen.byTestID('request-status-title')[0].props.children).toBe(
      STATUS.awaiting_vendor.title,
    );
    const ids = (await restarted.listRecentRequests(50)).map(summary => summary.id);
    expect(ids.filter(id => id === created.id)).toHaveLength(1);
  });
});

/**
 * Section 24's review, as the details screen offers it.
 *
 * Pinned here: the review group exists only for a completed or closed request;
 * it asks the review service and nothing else; it offers the review until there
 * is one and then shows it read-only; a lookup that fails is not mistaken for
 * "not reviewed"; and coming back to the screen reads the review again, which is
 * how a review just sent replaces the prompt. The request itself never changes.
 */
describe('RequestDetailsScreen — review', () => {
  const COMPLETED: CustomerRequestDetails = {
    ...DETAILS,
    status: 'COMPLETED',
    vendorName: 'Skyline Roofing',
  };

  const REVIEWED: RequestReview = {
    requestId: DETAILS.id,
    rating: 4,
    comment: 'Cleared every gutter and showed me the blockage.',
    submittedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  };

  const NOT_REVIEWABLE = [
    'CREATED',
    'PENDING_VENDOR',
    'ACCEPTED',
    'IN_PROGRESS',
    'REJECTED',
    'CANCELLED',
    'ON_HOLD',
    'ESCALATED_TO_REGION',
  ];

  for (const status of NOT_REVIEWABLE) {
    it(`offers no review, and asks for none, for ${status}`, async () => {
      const { byTestID, text, readReview } = await render({
        getRequest: async () => ({ ...COMPLETED, status }),
      });

      expect(byTestID('request-details-review')).toHaveLength(0);
      expect(text()).not.toContain(REVIEW.detailsAction);
      expect(readReview).not.toHaveBeenCalled();
    });
  }

  for (const status of ['COMPLETED', 'CLOSED', ' completed ']) {
    it(`offers a review for ${JSON.stringify(status)} with no review yet`, async () => {
      const { byTestID, text, buttons, readReview } = await render({
        getRequest: async () => ({ ...COMPLETED, status }),
      });

      expect(readReview).toHaveBeenCalledWith(DETAILS.id);
      expect(byTestID('request-details-review')).toHaveLength(1);
      expect(text()).toContain(REVIEW.detailsPrompt);
      expect(buttons()).toContain(REVIEW.detailsAction);
    });
  }

  it('opens the review screen by reference and nothing else', async () => {
    const { press, navigate } = await render({ getRequest: async () => COMPLETED });

    await press(REVIEW.detailsAction);

    expect(navigate).toHaveBeenCalledWith('RequestReview', { requestId: DETAILS.id });
  });

  it('shows a submitted review read-only, with no way to send another', async () => {
    const { byTestID, labelOf, text, buttons } = await render({
      getRequest: async () => COMPLETED,
      getReview: async () => REVIEWED,
    });

    expect(byTestID('request-details-review-summary')).toHaveLength(1);
    expect(labelOf('request-details-review-summary-rating')).toBe(
      `${REVIEW.ratingLabel}: 4 out of 5 stars`,
    );
    expect(labelOf('request-details-review-summary-comment')).toBe(
      `${REVIEW.commentLabelReadOnly}: ${REVIEWED.comment}`,
    );
    expect(buttons()).not.toContain(REVIEW.detailsAction);
    expect(text()).not.toContain(REVIEW.detailsPrompt);
    // Reviewed is not a status: the request still reads as completed.
    expect(byTestID('request-status-title')[0].props.children).toBe(STATUS.completed.title);
  });

  it('shows a review without a comment as stars alone', async () => {
    const { byTestID } = await render({
      getRequest: async () => COMPLETED,
      getReview: async () => ({ ...REVIEWED, comment: undefined }),
    });

    expect(byTestID('request-details-review-summary-rating')).toHaveLength(1);
    expect(byTestID('request-details-review-summary-comment')).toHaveLength(0);
  });

  it('shows a placeholder while the review is being checked, and no button', async () => {
    const { byTestID, buttons } = await render({
      getRequest: async () => COMPLETED,
      getReview: () => pending(),
    });

    const [loading] = byTestID('request-details-review-loading');
    expect(loading.props.accessibilityLabel).toBe(REVIEW.loadingLabel);
    expect(loading.props.accessibilityState).toEqual({ busy: true });
    expect(buttons()).not.toContain(REVIEW.detailsAction);
  });

  it('says it could not check, rather than offering a second review, and retries', async () => {
    let fail = true;
    const { byTestID, buttons, press, readReview } = await render({
      getRequest: async () => COMPLETED,
      getReview: async () => {
        if (fail) {
          throw new AppError({ kind: 'network', message: 'offline' });
        }
        return REVIEWED;
      },
    });

    expect(byTestID('request-details-review-error')).toHaveLength(1);
    expect(buttons()).not.toContain(REVIEW.detailsAction);
    // The rest of the record is still there.
    expect(byTestID('request-details-summary').length).toBeGreaterThan(0);

    fail = false;
    await press('Try again');

    expect(readReview).toHaveBeenCalledTimes(2);
    expect(byTestID('request-details-review-error')).toHaveLength(0);
    expect(byTestID('request-details-review-summary')).toHaveLength(1);
  });

  it('reads the review again on coming back, so a review just sent replaces the prompt', async () => {
    let review: RequestReview | null = null;
    const { focus, byTestID, buttons, read, readReview } = await render({
      getRequest: async () => COMPLETED,
      getReview: async () => review,
    });

    expect(buttons()).toContain(REVIEW.detailsAction);

    // Sent from the review screen, then Back.
    review = REVIEWED;
    await focus();

    expect(readReview).toHaveBeenCalledTimes(2);
    expect(byTestID('request-details-review-summary')).toHaveLength(1);
    expect(buttons()).not.toContain(REVIEW.detailsAction);
    // Only the review is read again; sending one never changed the request.
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('does not look for a review on coming back to a request that cannot have one', async () => {
    const { focus, readReview } = await render({
      getRequest: async () => ({ ...COMPLETED, status: 'IN_PROGRESS' }),
    });

    await focus();

    expect(readReview).not.toHaveBeenCalled();
  });

  it('reads the review again when pulled, alongside the request', async () => {
    const { renderer, read, readReview } = await render({ getRequest: async () => COMPLETED });

    const [scroller] = renderer.root.findAll(node => React.isValidElement(node.props?.refreshControl));
    await act(async () => {
      scroller.props.refreshControl.props.onRefresh();
    });
    await act(async () => {});

    expect(read).toHaveBeenCalledTimes(2);
    expect(readReview).toHaveBeenCalledTimes(2);
  });
});

/**
 * The review group's checking view, and what follows it in the same place
 * (3D-12) — the keyed loading region every list has had since 3G-3. The
 * checking view and the prompt were one plain View updated in place, so on
 * Android the prompt could keep the checking view's `busy`. Now only the
 * checking region is named and busy, and what follows is a new host view with
 * no name, role or state to inherit.
 */
describe('RequestDetailsScreen — how the review group is announced in every state', () => {
  const COMPLETED: CustomerRequestDetails = {
    ...DETAILS,
    status: 'COMPLETED',
    vendorName: 'Skyline Roofing',
  };

  const REVIEWED: RequestReview = {
    requestId: DETAILS.id,
    rating: 5,
    submittedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  };

  /**
   * The testID of every native view on screen that says it is busy.
   *
   * Ids, not the nodes: a failed match on a test instance makes jest print it,
   * and printing one walks the whole fiber tree — the run never finishes (3G-3).
   */
  function busyOf(renderer: ReactTestRenderer.ReactTestRenderer) {
    return renderer.root
      .findAll(node => typeof node.type === 'string' && node.props?.accessibilityState?.busy === true)
      .map(node => node.props.testID as string | undefined);
  }

  it('replaces the busy region once the review answers, and leaves the prompt unnamed', async () => {
    let answer!: (review: RequestReview | null) => void;
    const { renderer, byTestID, buttons } = await render({
      getRequest: async () => COMPLETED,
      getReview: () => new Promise<RequestReview | null>(resolve => (answer = resolve)),
    });

    const [waiting] = byTestID('request-details-review-loading');
    expect(waiting.props.accessibilityLabel).toBe(REVIEW.loadingLabel);
    expect(waiting.props.accessibilityState).toEqual({ busy: true });
    expect(waiting.props.accessibilityRole).toBeUndefined();
    expect(busyOf(renderer)).toEqual(['request-details-review-loading']);

    await act(async () => {
      answer(null);
    });

    expect(buttons()).toContain(REVIEW.detailsAction);
    // Not hidden or emptied: no longer in the tree at all, so its busy cannot outlive it.
    expect(byTestID('request-details-review-loading')).toHaveLength(0);
    const [settled] = byTestID('request-details-review-settled');
    expect(settled === waiting).toBe(false);
    expect(settled.props.accessibilityLabel).toBeUndefined();
    expect(settled.props.accessibilityState).toBeUndefined();
    expect(settled.props.accessibilityRole).toBeUndefined();
    // Nothing anywhere on the page still says busy.
    expect(busyOf(renderer)).toEqual([]);
  });

  it('replaces the busy region with the failure, and the failure with it on Try again', async () => {
    let calls = 0;
    let fail!: (error: AppError) => void;
    let answer!: (review: RequestReview | null) => void;
    const { renderer, byTestID, press } = await render({
      getRequest: async () => COMPLETED,
      getReview: () => {
        calls += 1;
        return calls === 1
          ? new Promise<RequestReview | null>((_, reject) => (fail = reject))
          : new Promise<RequestReview | null>(resolve => (answer = resolve));
      },
    });

    const [waiting] = byTestID('request-details-review-loading');

    await act(async () => {
      fail(new AppError({ kind: 'network', message: 'socket hang up' }));
    });

    expect(byTestID('request-details-review-error')).toHaveLength(1);
    expect(byTestID('request-details-review-loading')).toHaveLength(0);
    const [failed] = byTestID('request-details-review-settled');
    expect(failed === waiting).toBe(false);
    expect(failed.props.accessibilityLabel).toBeUndefined();
    expect(failed.props.accessibilityState).toBeUndefined();
    expect(busyOf(renderer)).toEqual([]);

    await press('Try again');

    const [again] = byTestID('request-details-review-loading');
    expect(again === failed).toBe(false);
    expect(again.props.accessibilityLabel).toBe(REVIEW.loadingLabel);
    expect(busyOf(renderer)).toEqual(['request-details-review-loading']);
    expect(byTestID('request-details-review-settled')).toHaveLength(0);

    await act(async () => {
      answer(REVIEWED);
    });

    expect(byTestID('request-details-review-summary')).toHaveLength(1);
    expect(busyOf(renderer)).toEqual([]);
  });
});

/**
 * The payment a professional recorded on completing the job (PROJECT_BIBLE.md
 * sections 36 and 37): shown only on a finished request that has one, said to
 * be the professional's record, and never as something Fixora processed.
 */
describe('RequestDetailsScreen — payment', () => {
  const PAYMENT = CUSTOMER_COPY.payment;

  const PAID: CustomerRequestDetails = {
    ...DETAILS,
    status: 'COMPLETED',
    vendorName: 'Skyline Roofing',
    payment: {
      finalAmountMinor: 12_500_050,
      currency: 'INR',
      paymentStatus: 'PAID',
      paymentMethodLabel: 'Cash',
    },
  };

  it('shows the amount and how it was paid, and whose record it is', async () => {
    const { byTestID, labelOf, text } = await render({ getRequest: async () => PAID });

    expect(byTestID('request-details-payment')).toHaveLength(1);
    expect(labelOf('details-payment-amount')).toBe(`${PAYMENT.amountLabel}: ₹1,25,000.50`);
    expect(labelOf('details-payment-status')).toBe(`${PAYMENT.statusLabel}: Paid · Cash`);
    expect(text()).toContain(PAYMENT.recorded);
    expect(PAYMENT.recorded).toContain('Fixora does not process payments');
  });

  it('says "Not paid yet", with no method beside it', async () => {
    const { labelOf } = await render({
      getRequest: async () => ({
        ...PAID,
        status: 'CLOSED',
        payment: { finalAmountMinor: 45_000, currency: 'INR', paymentStatus: 'UNPAID' },
      }),
    });

    expect(labelOf('details-payment-amount')).toBe(`${PAYMENT.amountLabel}: ₹450`);
    expect(labelOf('details-payment-status')).toBe(`${PAYMENT.statusLabel}: Not paid yet`);
  });

  it('says a status nobody worded cannot be shown, rather than showing the backend’s constant', async () => {
    const { labelOf, text } = await render({
      getRequest: async () => ({ ...PAID, payment: { ...PAID.payment!, paymentStatus: 'PART_PAID' } }),
    });

    expect(labelOf('details-payment-status')).toBe(`${PAYMENT.statusLabel}: Payment status unavailable`);
    expect(text()).not.toContain('PART_PAID');
  });

  it('leaves out an amount it cannot write, rather than showing it wrong', async () => {
    const { byTestID } = await render({
      getRequest: async () => ({ ...PAID, payment: { ...PAID.payment!, finalAmountMinor: 12.5 } }),
    });

    expect(byTestID('request-details-payment')).toHaveLength(1);
    expect(byTestID('details-payment-amount')).toHaveLength(0);
  });

  it('shows nothing about payment on a finished request with no record', async () => {
    const { byTestID, text } = await render({
      getRequest: async () => ({ ...PAID, payment: undefined }),
    });

    expect(byTestID('request-details-payment')).toHaveLength(0);
    expect(text()).not.toContain(PAYMENT.section);
  });

  for (const status of ['PENDING_VENDOR', 'ACCEPTED', 'IN_PROGRESS', 'CANCELLED', 'ESCALATED_TO_REGION']) {
    it(`shows no payment for ${status}, whatever the record carries`, async () => {
      const { byTestID } = await render({ getRequest: async () => ({ ...PAID, status }) });

      expect(byTestID('request-details-payment')).toHaveLength(0);
    });
  }

  it('never says a payment was processed, or paid through Fixora', async () => {
    const { text, renderer } = await render({ getRequest: async () => PAID });

    const spoken = renderer.root
      .findAll(node => typeof node.type === 'string' && typeof node.props?.accessibilityLabel === 'string')
      .map(node => node.props.accessibilityLabel as string)
      .join('\n');
    for (const said of [text(), spoken, JSON.stringify(PAYMENT)]) {
      expect(said.toLowerCase()).not.toContain('processed');
      expect(said).not.toContain('through Fixora');
    }
  });

  it('reads the seed: one completed request with a payment, one closed request without', async () => {
    registerService('review', {
      getReview: jest.fn(async () => null),
      submitReview: jest.fn(),
      getVendorReviews: jest.fn(),
    } as ReviewService);
    const requests = new MockRequestService({ latency: NO_LATENCY });
    registerService('request', requests);

    const paid = await mount('REQ-24048');
    expect(paid.labelOf('details-payment-amount')).toBe(`${PAYMENT.amountLabel}: ₹450`);
    expect(paid.labelOf('details-payment-status')).toBe(`${PAYMENT.statusLabel}: Paid · Cash`);

    const none = await mount('REQ-24012');
    expect(none.byTestID('request-details-record')).toHaveLength(1);
    expect(none.byTestID('request-details-payment')).toHaveLength(0);
  });
});

/**
 * Cancelling a request nobody has accepted (owner decision, 21/10/2026).
 *
 * Pinned here: it is asked first, and "Keep request" sends nothing; it is sent
 * once however fast it is confirmed, and nothing dismisses the dialog while it
 * is out; the screen shows only what the service answered — the cancelled
 * record it returned, the request read again after a refusal, nothing changed
 * after a failure, with Cancel there to try again; and the lists behind the
 * screen are told whenever what they show is wrong. Which statuses offer it at
 * all is pinned in "customer actions" above.
 */
describe('RequestDetailsScreen — cancelling a request nobody has accepted', () => {
  const CANCELLED: CustomerRequestDetails = { ...DETAILS, status: 'CANCELLED' };

  const cancelled = async (_requestId: string): Promise<CancelRequestResult> => ({
    outcome: 'cancelled',
    request: CANCELLED,
  });

  /** What the lists behind the screen were told, counted. */
  let told = 0;
  let stopListening: () => void = () => undefined;

  beforeEach(() => {
    told = 0;
    stopListening = onCustomerRequestsChanged(() => {
      told += 1;
    });
  });

  afterEach(() => {
    stopListening();
  });

  type Screen = Awaited<ReturnType<typeof mount>>;

  /** Presses the page's Cancel request, which only opens the question. */
  async function ask(screen: Screen) {
    const button = screen.cancelButton();
    if (!button) {
      throw new Error('No Cancel request on the page');
    }
    await act(async () => {
      button.props.onPress();
    });
  }

  /** Answers the question with one of its two buttons, and lets the answer land. */
  async function answer(screen: Screen, label: string) {
    const target = screen.dialogButton(label);
    await act(async () => {
      target.props.onPress();
    });
    await act(async () => {});
  }

  /** Whatever the toast is saying, with its tone. */
  function toastOf(screen: Screen): { message?: string; tone?: string } {
    const [toast] = screen.renderer.root.findAll(
      node => node.props?.testID === 'toast' && typeof node.props?.message === 'string',
    );
    return { message: toast?.props.message, tone: toast?.props.tone };
  }

  /** Pulls the page down, as the refresh control would. */
  async function pull(screen: Screen) {
    const [scroller] = screen.renderer.root.findAll(node =>
      React.isValidElement(node.props?.refreshControl),
    );
    await act(async () => {
      scroller.props.refreshControl.props.onRefresh();
    });
    await act(async () => {});
  }

  it('sits beneath the whole record, as the quiet danger button, saying what it does', async () => {
    const { byTestID, cancelButton } = await render();

    const [record] = byTestID('request-details-record');
    const parts = React.Children.toArray(record.props.children) as ReactElement<{
      label?: string;
      variant?: string;
    }>[];
    const last = parts[parts.length - 1];

    expect(last.props.label).toBe(CANCEL.action);
    // The red tint, not the fill (3G-4): it only opens the question.
    expect(last.props.variant).toBe('dangerSecondary');
    expect(cancelButton()?.props.accessibilityHint).toBe(CANCEL.actionHint);
  });

  it('keeps the filled danger button for the dialog’s own Cancel request — the final step', async () => {
    const screen = await render({ cancelRequest: cancelled });
    await ask(screen);

    const variants = screen
      .dialog()
      .findAll(node => typeof node.props?.variant === 'string' && typeof node.props?.label === 'string')
      .map(node => [node.props.label, node.props.variant]);
    expect(variants).toContainEqual([CANCEL.confirm, 'danger']);
    expect(variants).not.toContainEqual([CANCEL.confirm, 'dangerSecondary']);
  });

  it('asks first, and sends nothing until it is confirmed', async () => {
    const screen = await render({ cancelRequest: cancelled });

    expect(screen.dialog()).toBeUndefined();

    await ask(screen);

    const dialog = screen.dialog();
    expect(dialog).toBeDefined();
    expect(dialog.props.accessibilityViewIsModal).toBe(true);
    expect(dialog.props.accessibilityLabel).toBe(CANCEL.confirmTitle);
    expect(screen.text()).toContain(CANCEL.confirmMessage);
    // Stacked, the danger on top and the way out at the bottom, nearest the
    // thumb — where a hurried tap lands (ConfirmDialog, owner's decision
    // 21/10/2026). Rendered in that order, so a screen reader meets them so too.
    expect(
      dialog
        .findAll(
          node => node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function',
        )
        .map(node => node.props.accessibilityLabel),
    ).toEqual([CANCEL.confirm, CANCEL.keep]);
    // One above the other: side by side, neither two-word label fits its half at 360dp.
    for (const label of [CANCEL.keep, CANCEL.confirm]) {
      const [choice] = dialog.findAll(node => node.props?.label === label && 'variant' in node.props);
      expect(StyleSheet.flatten(choice.props.style).alignSelf).toBe('stretch');
    }
    expect(screen.cancel).not.toHaveBeenCalled();
  });

  it('keeps the request when Keep request is pressed, and sends nothing', async () => {
    const screen = await render({ cancelRequest: cancelled });

    await ask(screen);
    await answer(screen, CANCEL.keep);

    expect(screen.dialog()).toBeUndefined();
    expect(screen.cancel).not.toHaveBeenCalled();
    expect(screen.text()).toContain(STATUS.awaiting_vendor.title);
    expect(screen.cancelButton()).toBeDefined();
    expect(told).toBe(0);
  });

  it('cancels it, shows the record the service returned, and says so', async () => {
    const screen = await render({ cancelRequest: cancelled });

    await ask(screen);
    await answer(screen, CANCEL.confirm);

    expect(screen.cancel).toHaveBeenCalledTimes(1);
    expect(screen.cancel).toHaveBeenCalledWith('REQ-7001');
    expect(screen.dialog()).toBeUndefined();
    // The status card's own words for a cancelled request, and no path drawn.
    expect(screen.byTestID('request-status-title')[0].props.children).toBe(STATUS.cancelled.title);
    expect(screen.byTestID('request-status-progress')).toHaveLength(0);
    // Nothing left to cancel.
    expect(screen.cancelButton()).toBeUndefined();
    expect(toastOf(screen)).toEqual({ message: CANCEL.cancelled, tone: 'neutral' });
    // Adopted, not read again: the service's answer is the record.
    expect(screen.read).toHaveBeenCalledTimes(1);
    // And Home and My Requests, behind it, read theirs again.
    expect(told).toBe(1);
  });

  it('shows what the service answered, never a status it worked out for itself', async () => {
    const screen = await render({
      cancelRequest: async () => ({
        outcome: 'cancelled',
        request: { ...CANCELLED, notes: 'As the service now holds it.' },
      }),
    });

    await ask(screen);
    await answer(screen, CANCEL.confirm);

    expect(screen.text()).toContain('As the service now holds it.');
  });

  it('sends one cancellation however fast it is confirmed, and holds the dialog meanwhile', async () => {
    let settle!: (result: CancelRequestResult) => void;
    const screen = await render({
      cancelRequest: () =>
        new Promise<CancelRequestResult>(resolve => {
          settle = resolve;
        }),
    });

    await ask(screen);

    // Twice in one frame, before the busy state can land…
    const confirm = screen.dialogButton(CANCEL.confirm);
    await act(async () => {
      confirm.props.onPress();
      confirm.props.onPress();
    });
    // …and once more after it has.
    await act(async () => {
      screen.dialogButton(CANCEL.confirm).props.onPress();
    });

    expect(screen.cancel).toHaveBeenCalledTimes(1);
    // Busy, with no way out while it is sent — and nothing shown as cancelled yet.
    expect(screen.dialogButton(CANCEL.confirm).props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    expect(screen.dialogButton(CANCEL.keep).props.accessibilityState.disabled).toBe(true);
    expect(screen.byTestID('request-status-title')[0].props.children).toBe(
      STATUS.awaiting_vendor.title,
    );

    await act(async () => {
      settle({ outcome: 'cancelled', request: CANCELLED });
    });

    expect(screen.dialog()).toBeUndefined();
    expect(screen.byTestID('request-status-title')[0].props.children).toBe(STATUS.cancelled.title);
    expect(screen.cancel).toHaveBeenCalledTimes(1);
  });

  it('says calmly when a professional accepted it first, and reads the request again', async () => {
    const getRequest = jest
      .fn<Promise<CustomerRequestDetails | null>, [string]>()
      .mockResolvedValueOnce(DETAILS)
      .mockResolvedValueOnce({ ...DETAILS, status: 'ACCEPTED', vendorName: 'Skyline Roofing' });
    const screen = await render({
      getRequest,
      cancelRequest: async () => ({ outcome: 'refused', reason: 'notCancellable' }),
    });

    await ask(screen);
    await answer(screen, CANCEL.confirm);

    // Information, not a fault (section 49.1).
    expect(toastOf(screen)).toEqual({ message: CANCEL.refused, tone: 'info' });
    expect(screen.byTestID('request-details-error')).toHaveLength(0);
    // Where it went, read from the service — and no Cancel on it.
    expect(screen.read).toHaveBeenCalledTimes(2);
    expect(screen.byTestID('request-status-title')[0].props.children).toBe(STATUS.assigned.title);
    expect(screen.labelOf('details-assigned')).toBe(`${COPY.assignedLabel}: Skyline Roofing`);
    expect(screen.cancelButton()).toBeUndefined();
    expect(screen.dialog()).toBeUndefined();
    expect(told).toBe(1);
  });

  it('never shows the waiting request again while that read is out, nor when it fails', async () => {
    let failRead!: (error: AppError) => void;
    const getRequest = jest
      .fn<Promise<CustomerRequestDetails | null>, [string]>()
      .mockResolvedValueOnce(DETAILS)
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            failRead = reject;
          }),
      );
    const screen = await render({
      getRequest,
      cancelRequest: async () => ({ outcome: 'refused', reason: 'notCancellable' }),
    });

    await ask(screen);
    await answer(screen, CANCEL.confirm);

    // Placeholders, not the request that was just contradicted.
    expect(screen.byTestID('request-details-loading')).toHaveLength(1);
    expect(screen.text()).not.toContain(STATUS.awaiting_vendor.title);
    expect(screen.cancelButton()).toBeUndefined();

    await act(async () => {
      failRead(new AppError({ kind: 'network', message: 'offline' }));
    });

    expect(screen.byTestID('request-details-error')).toHaveLength(1);
    expect(screen.text()).not.toContain(STATUS.awaiting_vendor.title);
    expect(screen.cancelButton()).toBeUndefined();
  });

  it('changes nothing when it fails, says why, and leaves Cancel there to try again', async () => {
    const failure = new AppError({
      kind: 'network',
      message: 'AxiosError: connect ECONNREFUSED 10.0.2.2:8080',
    });
    const cancelRequest = jest
      .fn<Promise<CancelRequestResult>, [string]>()
      .mockRejectedValueOnce(failure)
      .mockImplementationOnce(cancelled);
    const screen = await render({ cancelRequest });

    await ask(screen);
    await answer(screen, CANCEL.confirm);

    expect(toastOf(screen).message).toBe(`${CANCEL.failed} ${failure.userMessage}`);
    expect(screen.text()).not.toContain('ECONNREFUSED');
    expect(screen.dialog()).toBeUndefined();
    // Nothing changed: the same record, not read again, nobody told.
    expect(screen.byTestID('request-status-title')[0].props.children).toBe(
      STATUS.awaiting_vendor.title,
    );
    expect(screen.read).toHaveBeenCalledTimes(1);
    expect(told).toBe(0);
    expect(screen.cancelButton()?.props.accessibilityState.disabled).toBe(false);

    // The same button is the retry.
    await ask(screen);
    await answer(screen, CANCEL.confirm);

    expect(screen.cancel).toHaveBeenCalledTimes(2);
    expect(screen.byTestID('request-status-title')[0].props.children).toBe(STATUS.cancelled.title);
  });

  it('reads the request again when the service no longer knows it', async () => {
    const gone = new AppError({ kind: 'notFound', message: '404' });
    const getRequest = jest
      .fn<Promise<CustomerRequestDetails | null>, [string]>()
      .mockResolvedValueOnce(DETAILS)
      .mockResolvedValueOnce(null);
    const screen = await render({
      getRequest,
      cancelRequest: async () => {
        throw gone;
      },
    });

    await ask(screen);
    await answer(screen, CANCEL.confirm);

    expect(toastOf(screen).message).toBe(`${CANCEL.failed} ${gone.userMessage}`);
    // Not Cancel offered again on something that is not there.
    expect(screen.read).toHaveBeenCalledTimes(2);
    expect(screen.byTestID('request-details-not-found')).toHaveLength(1);
    expect(screen.cancelButton()).toBeUndefined();
    expect(told).toBe(1);
  });

  it('reads nothing for a screen that has gone by the time the answer lands', async () => {
    let settle!: (result: CancelRequestResult) => void;
    let remove!: () => void;
    /** Takes the screen away and leaves the app — and its toast — where they are. */
    function Removable({ children }: { children: ReactElement }) {
      const [shown, setShown] = React.useState(true);
      remove = () => setShown(false);
      return shown ? children : null;
    }
    const screen = await render({
      cancelRequest: () =>
        new Promise<CancelRequestResult>(resolve => {
          settle = resolve;
        }),
      wrap: details => <Removable>{details}</Removable>,
    });

    await ask(screen);
    await act(async () => {
      screen.dialogButton(CANCEL.confirm).props.onPress();
    });
    // The session ended under the dialog, say.
    await act(async () => {
      remove();
    });

    await act(async () => {
      settle({ outcome: 'refused', reason: 'notCancellable' });
    });

    expect(screen.read).toHaveBeenCalledTimes(1);
    // The lists behind are still told: what they show is still wrong.
    expect(told).toBe(1);
  });

  it('cannot be pressed while the request is being read again', async () => {
    const getRequest = jest
      .fn<Promise<CustomerRequestDetails | null>, [string]>()
      .mockResolvedValueOnce(DETAILS)
      .mockImplementationOnce(() => pending());
    const screen = await render({ getRequest, cancelRequest: cancelled });

    expect(screen.cancelButton()?.props.accessibilityState.disabled).toBe(false);

    await pull(screen);

    // The answer could already say a professional has it.
    expect(screen.cancelButton()?.props.accessibilityState.disabled).toBe(true);
    await ask(screen);
    expect(screen.dialog()).toBeUndefined();
  });

  it('gives way to a later read of the request', async () => {
    const getRequest = jest
      .fn<Promise<CustomerRequestDetails | null>, [string]>()
      .mockResolvedValueOnce(DETAILS)
      .mockResolvedValueOnce({ ...CANCELLED, notes: 'Read after it was cancelled.' });
    const screen = await render({ getRequest, cancelRequest: cancelled });

    await ask(screen);
    await answer(screen, CANCEL.confirm);
    await pull(screen);

    expect(screen.read).toHaveBeenCalledTimes(2);
    expect(screen.text()).toContain('Read after it was cancelled.');
  });

  it('cancels a waiting request in the mock, which then reads it back as cancelled', async () => {
    registerService('review', {
      getReview: jest.fn(async () => null),
      submitReview: jest.fn(),
      getVendorReviews: jest.fn(),
    } as ReviewService);
    const requests = new MockRequestService({ latency: NO_LATENCY });
    registerService('request', requests);

    // The seed's directed request nobody has taken yet.
    const screen = await mount('REQ-24081');
    expect(screen.byTestID('request-status-title')[0].props.children).toBe(
      STATUS.awaiting_vendor.title,
    );

    await ask(screen);
    await answer(screen, CANCEL.confirm);

    expect(screen.byTestID('request-status-title')[0].props.children).toBe(STATUS.cancelled.title);
    expect((await requests.getRequest('REQ-24081'))?.status).toBe('CANCELLED');
  });
});
