/**
 * This is the only screen that sends a request, so it is where the payload is
 * proved: which fields are on it, which are absent, and that nothing it just
 * finished displaying — a service name, a vendor's name, a rating — reaches it.
 *
 * PROJECT_BIBLE.md section 19 adds two rules of its own that are tested here
 * rather than described: the vendor row is present whichever way the question
 * was answered, and an incomplete draft never reaches submission.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppConfig } from '@/core/config/AppConfig';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { RequestConfirmationScreen } from '@/features/customer/screens/RequestConfirmationScreen';
import {
  RequestDraftProvider,
  useRequestDraft,
  type RequestDraft,
} from '@/features/customer/state/RequestDraftContext';
import { NO_VENDOR_CHOICE } from '@/features/customer/state/requestDraft';
import { setRequestDraftStorage } from '@/features/customer/state/requestDraftStorage';
import { ToastProvider } from '@/shared/components';
import { AsyncStorageMockRequestHistory } from '@/shared/services/mock/MockRequestHistoryStorage';
import { MockRequestService } from '@/shared/services/mock/MockRequestService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService, SubCategory } from '@/shared/services/types/CategoryService';
import type { CreateRequestInput, RequestService } from '@/shared/services/types/RequestService';
import type { EligibleVendor, VendorService } from '@/shared/services/types/VendorService';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const COPY = CUSTOMER_COPY.confirmation;

const CATEGORY_ID = 'cat_electrical';
const SUB_CATEGORY_ID = 'sub_fan';

const CATEGORIES = [{ id: CATEGORY_ID, name: 'Electrician', iconGlyph: 'flash' }];
const SERVICES: SubCategory[] = [{ id: SUB_CATEGORY_ID, name: 'Fan Repair' }];

/**
 * A chosen suggestion rather than a typed line, so the payload test proves the
 * whole structured value survives — coordinates and all — rather than only the
 * one field every address has.
 */
const ADDRESS = {
  formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
  latitude: 12.9352,
  longitude: 77.6245,
  locality: 'Koramangala, Bengaluru',
  postalCode: '560095',
  placeId: 'place_koramangala_5th',
};

const VENDORS: EligibleVendor[] = [
  { id: 'ven_zenith', name: 'Zenith Electricals', rating: 4.8, reviewCount: 126 },
];

const COMPLETE: RequestDraft = {
  categoryId: CATEGORY_ID,
  subCategoryId: SUB_CATEGORY_ID,
  values: {
    priority: 'HIGH',
    preferredDate: '2026-09-09',
    preferredTime: '09:00',
    notes: 'The fan stops after ten minutes.',
  },
  imageUrls: ['https://cdn.example.test/a.jpg'],
  address: ADDRESS,
  vendor: { kind: 'open' },
};

function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

/** Seeds the draft the way the screens before this one would have. */
function DraftSeed({ draft }: { draft: RequestDraft | null }) {
  const { startDraft } = useRequestDraft();
  const seeded = React.useRef(false);

  if (!seeded.current && draft) {
    seeded.current = true;
    startDraft(draft);
  }

  return null;
}

/** The draft context as the screens around this one see it, for a test to read or change. */
type DraftHandle = { current: ReturnType<typeof useRequestDraft> | null };

function DraftProbe({ handle }: { handle: DraftHandle }) {
  handle.current = useRequestDraft();
  return null;
}

interface Stubs {
  draft?: RequestDraft | null;
  /** The eligible list this screen reads for itself. */
  vendors?: () => Promise<EligibleVendor[]>;
  /** The route's identifiers, for a test that needs ones the mock catalogue knows. */
  ids?: { categoryId: string; subCategoryId: string };
  createRequest?: (input: CreateRequestInput) => Promise<{
    id: string;
    status: string;
    createdAt: string;
  }>;
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

let cleared = 0;

beforeEach(() => {
  cleared = 0;
  setRequestDraftStorage({
    read: async () => null,
    write: async () => true,
    clear: async () => {
      cleared += 1;
    },
  });
});

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  resetServices();
});

async function render({ draft = COMPLETE, createRequest, ids, vendors }: Stubs = {}) {
  registerService('category', {
    listServiceCategories: jest.fn(async () => CATEGORIES),
    listSubCategories: jest.fn(async () => SERVICES),
  } as CategoryService);

  const listEligibleVendors = jest.fn(vendors ?? (async () => VENDORS));
  registerService('vendor', { listEligibleVendors } as VendorService);

  const create = jest.fn(
    createRequest ??
      (async (_input: CreateRequestInput) => ({
        id: 'REQ-9001',
        status: 'CREATED',
        createdAt: '2026-09-01T09:00:00.000Z',
      })),
  );

  registerService('request', {
    listRecentRequests: jest.fn(() => {
      throw new Error('listRecentRequests must not be called from the summary');
    }),
    createRequest: create,
    // The summary reads the draft, never a stored request.
    getRequest: jest.fn(() => {
      throw new Error('getRequest must not be called from the summary');
    }),
    listRequests: jest.fn(() => {
      throw new Error('listRequests must not be called from the summary');
    }),
    cancelRequest: jest.fn(() => {
      throw new Error('cancelRequest must never be called from the summary');
    }),
  } as RequestService);

  const goBack = jest.fn();
  const popToTop = jest.fn();
  const navigate = jest.fn();
  const reset = jest.fn();
  const navigation = { goBack, popToTop, navigate, reset } as never;
  const route = {
    key: 'RequestConfirmation',
    name: 'RequestConfirmation' as const,
    params: ids ?? { categoryId: CATEGORY_ID, subCategoryId: SUB_CATEGORY_ID },
  } as never;

  const drafts: DraftHandle = { current: null };

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <ToastProvider>
          <RequestDraftProvider>
            <DraftSeed draft={draft} />
            <RequestConfirmationScreen navigation={navigation} route={route} />
            <DraftProbe handle={drafts} />
          </RequestDraftProvider>
        </ToastProvider>
      </ThemeProvider>,
    );
  });

  mounted.push(renderer);

  return {
    renderer,
    goBack,
    popToTop,
    navigate,
    reset,
    create,
    listEligibleVendors,
    drafts,
    /** Submit's own host view, which carries its busy and disabled state. */
    submitState: () =>
      renderer.root.findAll(
        node =>
          typeof node.type === 'string' &&
          node.props?.accessibilityRole === 'button' &&
          node.props?.accessibilityLabel === COPY.submit,
      )[0]?.props.accessibilityState as { busy?: boolean; disabled?: boolean } | undefined,
    /** The route names the success reset left in the stack, in order. */
    resetRoutes: () =>
      (reset.mock.calls[0]?.[0]?.routes ?? []).map((entry: { name: string }) => entry.name),
    text: () => textOf(renderer.toJSON()),
    payload: () => create.mock.calls[create.mock.calls.length - 1]?.[0],
    byTestID: (id: string) =>
      renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id),
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

describe('RequestConfirmationScreen — what it shows', () => {
  it('summarises the request from the draft, with names resolved', async () => {
    const { text } = await render();

    expect(text()).toContain('Fan Repair');
    expect(text()).toContain('Electrician');
    expect(text()).toContain('High');
    expect(text()).toContain('The fan stops after ten minutes.');
  });

  it('reads the schedule back the way it was chosen, not the way it is stored', async () => {
    const { text } = await render();

    // Found on device: the summary was printing 2026-09-09 and 09:00, which is
    // the contract's format and nobody's idea of a date.
    expect(text()).not.toContain('2026-09-09');
    expect(text()).not.toContain('>09:00<');
    expect(text()).toMatch(/Sep|September/);
  });

  it('states open dispatch in words rather than leaving the row blank', async () => {
    const { byTestID, text } = await render();

    expect(byTestID('summary-vendor').length).toBeGreaterThan(0);
    expect(text()).toContain(COPY.vendorOpen);
  });

  it('names the chosen professional when there is one', async () => {
    const { text } = await render({
      draft: { ...COMPLETE, vendor: { kind: 'vendor', vendorId: 'ven_zenith' } },
    });

    expect(text()).toContain('Zenith Electricals');
    expect(text()).not.toContain(COPY.vendorOpen);
  });

  it('still says the choice stands when the vendor cannot be named', async () => {
    // The list has not answered. (A loaded list without them is another
    // matter: they are taken off the draft — see "a professional the list no
    // longer has".)
    const { text } = await render({
      draft: { ...COMPLETE, vendor: { kind: 'vendor', vendorId: 'ven_zenith' } },
      vendors: () => pending(),
    });

    // Section 19: the row must say which dispatch applies even when the list
    // cannot say who. It must not fall back to "any available".
    expect(text()).toContain(COPY.vendorUnknown);
    expect(text()).not.toContain(COPY.vendorOpen);
  });

  it('draws no row for an answer that was never given', async () => {
    const { byTestID } = await render({
      draft: {
        ...COMPLETE,
        values: { ...COMPLETE.values, preferredDate: '', preferredTime: '', notes: '' },
        imageUrls: [],
      },
    });

    expect(byTestID('summary-date')).toHaveLength(0);
    expect(byTestID('summary-time')).toHaveLength(0);
    expect(byTestID('summary-notes')).toHaveLength(0);
    expect(byTestID('summary-photos')).toHaveLength(0);
    // The vendor row is the exception, and stays.
    expect(byTestID('summary-vendor').length).toBeGreaterThan(0);
  });
});

describe('RequestConfirmationScreen — the payload', () => {
  it('sends exactly the fields the contract defines and nothing else', async () => {
    const { press, payload } = await render({
      draft: { ...COMPLETE, vendor: { kind: 'vendor', vendorId: 'ven_zenith' } },
    });

    await press(COPY.submit);

    expect(Object.keys(payload()).sort()).toEqual([
      'address',
      'categoryId',
      'imageUrls',
      'notes',
      'preferredDate',
      'preferredTime',
      'priority',
      'subCategoryId',
      'vendorId',
    ]);
  });

  it('sends the chosen vendor identifier', async () => {
    const { press, payload } = await render({
      draft: { ...COMPLETE, vendor: { kind: 'vendor', vendorId: 'ven_zenith' } },
    });

    await press(COPY.submit);

    expect(payload().vendorId).toBe('ven_zenith');
  });

  it('omits vendorId entirely for open dispatch — not null, not a sentinel', async () => {
    const { press, payload } = await render();

    await press(COPY.submit);

    const sent = payload();
    expect(sent.vendorId).toBeUndefined();

    const serialised = JSON.stringify(sent);
    expect(serialised).not.toContain('"vendorId"');
    expect(serialised).not.toContain('none');
    expect(serialised).not.toContain('any');
  });

  it('sends nothing it just finished displaying', async () => {
    const { press, payload } = await render({
      draft: { ...COMPLETE, vendor: { kind: 'vendor', vendorId: 'ven_zenith' } },
    });

    await press(COPY.submit);

    const serialised = JSON.stringify(payload());
    expect(serialised).not.toContain('Zenith Electricals');
    expect(serialised).not.toContain('Fan Repair');
    expect(serialised).not.toContain('Electrician');
    expect(serialised).not.toContain('High');
  });
});

/**
 * A professional the list no longer has (Phase 3D-12). A resumed or restored
 * draft can name one who stopped being eligible after it was saved. The rule:
 * a request is never sent with a preferred professional who is not in the
 * latest eligible list for its service — and this screen reads that list for
 * itself, so its read is the latest when Submit is pressed. A loaded list
 * without them takes them off the draft and sends the customer back to
 * choose; a list still loading or failed clears nothing (nothing is known) and
 * sends nothing. Open dispatch waits for no list at all.
 */
describe('RequestConfirmationScreen — a professional the list no longer has', () => {
  const GONE: RequestDraft = { ...COMPLETE, vendor: { kind: 'vendor', vendorId: 'ven_gone' } };
  const CHOSEN: RequestDraft = { ...COMPLETE, vendor: { kind: 'vendor', vendorId: 'ven_zenith' } };

  /** A list this test answers when it chooses, and what going back had been asked before it did. */
  async function answeredLater(draft: RequestDraft, list: EligibleVendor[]) {
    let answer!: (vendors: EligibleVendor[]) => void;
    const screen = await render({
      draft,
      vendors: () => new Promise<EligibleVendor[]>(resolve => (answer = resolve)),
    });
    // Seeding the draft draws one frame without it, which goes back by itself.
    const wentBackBefore = screen.goBack.mock.calls.length;
    await act(async () => {
      answer(list);
    });
    return { ...screen, wentBack: () => screen.goBack.mock.calls.length > wentBackBefore };
  }

  it('takes them off the draft once the list has loaded without them, and goes back', async () => {
    const { drafts, wentBack, press, create, text } = await answeredLater(GONE, VENDORS);

    expect(drafts.current?.draft?.vendor).toEqual({ kind: 'none' });
    // Said on Preferred Vendor, which is where this goes back to.
    expect(drafts.current?.isVendorWithdrawn).toBe(true);
    expect(wentBack()).toBe(true);
    // Never "the professional you chose" for someone who is gone.
    expect(text()).not.toContain(COPY.vendorUnknown);

    await press(COPY.submit);
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps one the loaded list still has, and sends them', async () => {
    const { drafts, wentBack, press, payload } = await answeredLater(CHOSEN, VENDORS);

    expect(drafts.current?.draft?.vendor).toEqual({ kind: 'vendor', vendorId: 'ven_zenith' });
    expect(drafts.current?.isVendorWithdrawn).toBe(false);
    expect(wentBack()).toBe(false);

    await press(COPY.submit);
    expect(payload().vendorId).toBe('ven_zenith');
  });

  it('clears nothing and sends nothing while the list is still loading', async () => {
    const { drafts, press, create, submitState } = await render({
      draft: GONE,
      vendors: () => pending(),
    });

    expect(drafts.current?.draft?.vendor).toEqual({ kind: 'vendor', vendorId: 'ven_gone' });
    expect(drafts.current?.completion?.isReadyForReview).toBe(true);
    // Waiting for the check, and saying so.
    expect(submitState()?.busy).toBe(true);

    await press(COPY.submit);
    expect(create).not.toHaveBeenCalled();
  });

  it('clears nothing and sends nothing when the list failed, and says why beside Submit', async () => {
    const { drafts, press, create, submitState, byTestID, text } = await render({
      draft: GONE,
      vendors: async () => {
        throw new AppError({ kind: 'network', message: 'ECONNREFUSED 10.0.0.1:443' });
      },
    });

    expect(drafts.current?.draft?.vendor).toEqual({ kind: 'vendor', vendorId: 'ven_gone' });
    expect(drafts.current?.completion?.isReadyForReview).toBe(true);
    expect(byTestID('request-confirmation-vendor-error')).toHaveLength(1);
    expect(text()).toContain(COPY.vendorCheckFailed);
    expect(text()).not.toContain('ECONNREFUSED');
    expect(submitState()?.disabled).toBe(true);

    await press(COPY.submit);
    expect(create).not.toHaveBeenCalled();
  });

  it('checks again on Try again, and sends once the list has them', async () => {
    let calls = 0;
    const { press, payload, submitState, byTestID, listEligibleVendors } = await render({
      draft: CHOSEN,
      vendors: async () => {
        calls += 1;
        if (calls === 1) {
          throw new AppError({ kind: 'network', message: 'offline' });
        }
        return VENDORS;
      },
    });
    expect(submitState()?.disabled).toBe(true);

    await press('Try again');

    expect(listEligibleVendors).toHaveBeenCalledTimes(2);
    expect(byTestID('request-confirmation-vendor-error')).toHaveLength(0);
    expect(submitState()?.disabled).toBe(false);

    await press(COPY.submit);
    expect(payload().vendorId).toBe('ven_zenith');
  });

  it('never puts them on the payload, whatever the customer does next', async () => {
    const { drafts, press, payload } = await render({ draft: GONE });

    // Back on Preferred Vendor, the customer carries on with no preference.
    await act(async () => {
      drafts.current?.updateDraft({ vendor: { kind: 'open' } });
    });
    await press(COPY.submit);

    // What reaches the wire: open dispatch, with no vendorId at all.
    const sent = JSON.parse(JSON.stringify(payload()));
    expect(Object.keys(sent).sort()).toEqual([
      'address',
      'categoryId',
      'imageUrls',
      'notes',
      'preferredDate',
      'preferredTime',
      'priority',
      'subCategoryId',
    ]);
    expect(payload().vendorId).toBeUndefined();
    expect(JSON.stringify(payload())).not.toContain('ven_gone');
  });

  it('waits for no list when nobody was chosen', async () => {
    const { press, payload, submitState } = await render({ vendors: () => pending() });

    expect(submitState()?.busy).toBe(false);

    await press(COPY.submit);
    expect(payload().vendorId).toBeUndefined();
  });
});

describe('RequestConfirmationScreen — sending', () => {
  it('sends one request however many times the button is pressed', async () => {
    const { press, create } = await render({ createRequest: () => pending() });

    await press(COPY.submit);
    await press(COPY.submit);
    await press(COPY.submit);

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('sends one request for two presses in the same frame', async () => {
    // Found in review: the only lock was `isSubmitting` state, which both
    // presses read as false before the next render — two requests went out.
    const { renderer, create } = await render({ createRequest: () => pending() });

    const [submit] = renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === COPY.submit &&
        typeof node.props?.onPress === 'function',
    );
    await act(async () => {
      submit.props.onPress();
      submit.props.onPress();
    });

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('stays shut after a request has gone, even to a press already on its way', async () => {
    const { renderer, create, resetRoutes } = await render();

    // The handler captured before the send, as a tap queued behind the first
    // would hold it: the button itself is gone once the draft is cleared.
    const [submit] = renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === COPY.submit &&
        typeof node.props?.onPress === 'function',
    );
    const queued: () => void = submit.props.onPress;
    await act(async () => {
      queued();
    });
    expect(resetRoutes()).toEqual(['CustomerTabs', 'RequestSubmitted']);

    await act(async () => {
      queued();
    });

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('reports itself busy while the call is in flight', async () => {
    const { press, renderer } = await render({ createRequest: () => pending() });

    await press(COPY.submit);

    const [button] = renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === COPY.submit,
    );

    expect(button.props.accessibilityState.busy).toBe(true);
  });

  it('clears the draft once the request exists, and goes to the confirmation', async () => {
    const { press, resetRoutes } = await render();

    await press(COPY.submit);

    expect(resetRoutes()).toEqual(['CustomerTabs', 'RequestSubmitted']);
    // Cleared from the device too, which is what stops Home offering to resume
    // a request that has already been sent.
    expect(cleared).toBeGreaterThan(0);
  });

  it('discards the form it was sent from, so it cannot be sent again', async () => {
    const { press, resetRoutes } = await render();

    await press(COPY.submit);

    /*
      The duplicate-submission protection, and the reason this is a `reset`
      rather than a push. Nothing that can submit is left in the stack: a Back
      gesture from the success screen reaches the tabs, not a filled summary
      with a live Submit button on it.
    */
    expect(resetRoutes()).not.toContain('RequestConfirmation');
    expect(resetRoutes()).not.toContain('PreferredVendor');
    expect(resetRoutes()).not.toContain('ServiceAddress');
    expect(resetRoutes()).not.toContain('CreateRequest');
  });

  it('records no reference when the backend gave none — never the id in its place — and the id that opens it', async () => {
    const { press, drafts } = await render();

    await press(COPY.submit);

    expect(drafts.current?.submitted?.reference).toBe('');
    expect(drafts.current?.submitted?.requestId).toBe('REQ-9001');
  });

  it('records the backend’s quotable reference, and the id that opens it', async () => {
    // The real backend: `REQ-…` for people, its database id for calls (Phase 4A).
    const { press, drafts } = await render({
      createRequest: async () => ({
        id: '6afc3ea3c2951ec40c9a177a',
        reference: 'REQ-0031002405',
        status: 'PENDING_VENDOR',
        createdAt: '2026-09-01T09:00:00.000Z',
      }),
    });

    await press(COPY.submit);

    expect(drafts.current?.submitted?.reference).toBe('REQ-0031002405');
    expect(drafts.current?.submitted?.requestId).toBe('6afc3ea3c2951ec40c9a177a');
  });

  it('carries only identifiers to the success screen', async () => {
    const { press, reset } = await render();

    await press(COPY.submit);

    // The reference, the address and the vendor travel on the context, not in
    // route params — an address in a route param is an address in a crash report.
    const [args] = reset.mock.calls[0];
    expect(Object.keys(args.routes[1].params).sort()).toEqual(['categoryId', 'subCategoryId']);
  });

  it('keeps the draft when sending fails, and shows only the safe message', async () => {
    const failure = new AppError({
      kind: 'network',
      message: 'AxiosError: connect ECONNREFUSED 10.0.0.1:443',
      userMessage: 'We could not reach Fixora. Check your connection and try again.',
    });

    const { press, text, reset } = await render({
      createRequest: async () => {
        throw failure;
      },
    });

    await press(COPY.submit);

    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain('ECONNREFUSED');
    expect(text()).not.toContain('AxiosError');
    // The success screen must never be reached for a request that failed.
    expect(reset).not.toHaveBeenCalled();
    // A failed send is not a reason to throw away what was entered.
    expect(cleared).toBe(0);
    expect(text()).toContain('The fan stops after ten minutes.');
  });

  it('retries through Submit, sending the same request again', async () => {
    const createRequest = jest
      .fn()
      .mockRejectedValueOnce(new AppError({ kind: 'network', message: 'socket hang up' }))
      .mockResolvedValueOnce({
        id: 'REQ-9002',
        status: 'CREATED',
        createdAt: '2026-09-01T09:00:00.000Z',
      });

    const { press, create, resetRoutes } = await render({ createRequest });

    await press(COPY.submit);
    expect(create).toHaveBeenCalledTimes(1);

    await press(COPY.submit);

    expect(create).toHaveBeenCalledTimes(2);
    // One request, one success screen — the retry is not a second submission.
    expect(resetRoutes()).toEqual(['CustomerTabs', 'RequestSubmitted']);
  });
});

describe('RequestConfirmationScreen — an incomplete draft', () => {
  it('never submits one, and goes back to the question instead', async () => {
    const { create, goBack } = await render({
      draft: { ...COMPLETE, vendor: NO_VENDOR_CHOICE },
    });

    expect(goBack).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('leaves rather than summarising nothing when there is no draft at all', async () => {
    const { create, goBack, byTestID } = await render({ draft: null });

    expect(goBack).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(byTestID('request-confirmation-heading')).toHaveLength(0);
  });
});

/**
 * The summary is where a customer goes to correct something, so each group has
 * to reach the screen that owns it — and reaching it must not cost them anything
 * they have already said. That second half is the part worth pinning: the draft
 * is the only copy of the answers, and the whole flow rests on nothing but a
 * successful submission removing it.
 */
describe('RequestConfirmationScreen — correcting it', () => {
  it('sends the details group back to the screen that collects details', async () => {
    const { press, navigate } = await render();

    await press(COPY.editDetails);

    expect(navigate).toHaveBeenCalledWith('CreateRequest', {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
    });
  });

  it('sends the notes and photos group to the same screen, which collects both', async () => {
    const { press, navigate } = await render();

    await press(COPY.editExtras);

    expect(navigate).toHaveBeenCalledWith('CreateRequest', {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
    });
  });

  it('sends the professional group back to the vendor screen', async () => {
    const { press, navigate } = await render();

    await press(COPY.editVendor);

    expect(navigate).toHaveBeenCalledWith('PreferredVendor', {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
    });
  });

  it('keeps every answer when the customer leaves to change one', async () => {
    const { press, create } = await render();

    await press(COPY.editDetails);
    await press(COPY.editVendor);

    // Nothing sent, and nothing forgotten. Only a successful submission may
    // clear the draft — leaving this screen to correct something is the
    // opposite of finishing with it.
    expect(create).not.toHaveBeenCalled();
    expect(cleared).toBe(0);
  });

  it('goes back rather than sideways, so the flow does not stack up copies', async () => {
    const { press, navigate } = await render();

    await press(COPY.editDetails);

    // `navigate` returns to the screen already behind this one — the one still
    // holding the filled-in form. `push` would mount a second, empty copy.
    expect(navigate.mock.calls[0][0]).toBe('CreateRequest');
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});

describe('RequestConfirmationScreen — notes and photos', () => {
  it('shows the photographs rather than claiming a number of them', async () => {
    const { renderer } = await render({
      draft: { ...COMPLETE, imageUrls: ['https://cdn.example.test/a.jpg', 'https://b.test/b.jpg'] },
    });

    const images = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.source?.uri !== undefined,
    );

    expect(images.map(image => image.props.source.uri)).toEqual([
      'https://cdn.example.test/a.jpg',
      'https://b.test/b.jpg',
    ]);
  });

  it('counts them in words too, because a thumbnail says nothing out loud', async () => {
    const { byTestID } = await render({
      draft: { ...COMPLETE, imageUrls: ['a', 'b', 'c'] },
    });

    const [strip] = byTestID('summary-photos');

    expect(strip.props.accessibilityLabel).toBe(`${COPY.photosLabel}: 3 ${COPY.photoCountMany}`);
  });

  it('stops drawing thumbnails before the strip becomes a gallery', async () => {
    const { renderer, text } = await render({
      draft: { ...COMPLETE, imageUrls: ['a', 'b', 'c', 'd', 'e', 'f'] },
    });

    const images = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.source?.uri !== undefined,
    );

    expect(images).toHaveLength(4);
    expect(text()).toContain('+2');
  });

  it('says the group is empty rather than quietly leaving it out', async () => {
    const { byTestID, text } = await render({
      draft: { ...COMPLETE, values: { ...COMPLETE.values, notes: '' }, imageUrls: [] },
    });

    // A customer who meant to describe the problem and forgot needs the screen
    // to tell them, and needs the edit control beside it to still be there.
    expect(byTestID('summary-extras-empty')).toHaveLength(1);
    expect(byTestID('request-confirmation-edit-extras')).toHaveLength(1);
    expect(text()).toContain(COPY.extrasEmpty);
  });

  it('draws no note for one that is nothing but spaces', async () => {
    const { byTestID } = await render({
      draft: { ...COMPLETE, values: { ...COMPLETE.values, notes: '   ' }, imageUrls: [] },
    });

    expect(byTestID('summary-notes')).toHaveLength(0);
    expect(byTestID('summary-extras-empty')).toHaveLength(1);
  });
});

/**
 * The service location, which is the one thing on this summary that decides
 * whether anybody can be sent anywhere. It is shown, it is correctable, it
 * travels on the payload, and nothing is sent without it.
 */
describe('RequestConfirmationScreen — the service location', () => {
  it('shows the address the customer gave', async () => {
    const { byTestID, text } = await render();

    expect(byTestID('summary-address').length).toBeGreaterThan(0);
    expect(text()).toContain(ADDRESS.formattedAddress);
  });

  it('never prints the coordinates behind it', async () => {
    const { text } = await render();

    // A summary printing 12.9352 is a summary showing its working, and to
    // somebody checking their address it is noise between them and the answer.
    expect(text()).not.toContain('12.9352');
    expect(text()).not.toContain('77.6245');
    expect(text()).not.toContain(ADDRESS.placeId);
  });

  it('announces the address by name, not the numbers', async () => {
    const { byTestID } = await render();

    const [block] = byTestID('summary-address');

    expect(block.props.accessibilityLabel).toBe(
      `${COPY.addressLabel}: ${ADDRESS.formattedAddress}`,
    );
  });

  it('sends the correction back to the screen that collects it', async () => {
    const { press, navigate } = await render();

    await press(COPY.editAddress);

    // `navigate`, so it returns to the instance already behind this one rather
    // than stacking a second copy the customer would have to leave twice.
    expect(navigate).toHaveBeenCalledWith('ServiceAddress', {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
    });
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('keeps everything else when the customer leaves to change it', async () => {
    const { press, create, text } = await render();

    await press(COPY.editAddress);

    expect(create).not.toHaveBeenCalled();
    expect(cleared).toBe(0);
    expect(text()).toContain('The fan stops after ten minutes.');
  });

  it('puts the whole address on the payload, coordinates and all', async () => {
    const { press, payload } = await render();

    await press(COPY.submit);

    // Passed through, not reshaped. The parts a backend can act on — the point,
    // the postcode, the provider's handle — survive intact.
    expect(payload().address).toEqual(ADDRESS);
  });

  it('sends a typed address exactly as typed, asserting nothing more', async () => {
    const typed = { formattedAddress: '17 Cross Lane, Devanahalli' };
    const { press, payload } = await render({ draft: { ...COMPLETE, address: typed } });

    await press(COPY.submit);

    // No invented locality, no guessed coordinates. The app was told a line of
    // text and says only that.
    expect(payload().address).toEqual(typed);
  });

  it('never submits a draft that has lost its address, and goes back for one', async () => {
    const { create, goBack } = await render({ draft: { ...COMPLETE, address: null } });

    expect(goBack).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps the address when sending fails, ready for the retry', async () => {
    const { press, text, create } = await render({
      createRequest: async () => {
        throw new AppError({ kind: 'network', message: 'socket hang up' });
      },
    });

    await press(COPY.submit);

    expect(text()).toContain(ADDRESS.formattedAddress);
    expect(cleared).toBe(0);

    await press(COPY.submit);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].address).toEqual(ADDRESS);
  });
});

/**
 * Sending through the real mock and device storage, once: the request is kept
 * for after a restart, and the sequence around it is the one it always was —
 * accepted, recorded, draft cleared, success screen.
 */
describe('RequestConfirmationScreen — a sent request outlives the app', () => {
  const IDS = { categoryId: 'cat_electrician', subCategoryId: 'sub_fan_repair' };

  const launch = () =>
    new MockRequestService({
      latency: NO_LATENCY,
      history: new AsyncStorageMockRequestHistory(),
      currentCustomerId: async () => 'usr_customer_1',
    });

  it('is kept for after a restart, and the draft it came from is still cleared', async () => {
    await AsyncStorage.clear();
    jest.mocked(AsyncStorage.setItem).mockClear();

    const service = launch();
    const { press, create, resetRoutes } = await render({
      ids: IDS,
      draft: { ...COMPLETE, ...IDS },
      createRequest: input => service.createRequest(input),
    });

    await press(COPY.submit);
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });

    // The sequence is unchanged: accepted, then the draft cleared and the success screen.
    expect(create).toHaveBeenCalledTimes(1);
    expect(cleared).toBeGreaterThan(0);
    expect(resetRoutes()).toEqual(['CustomerTabs', 'RequestSubmitted']);

    // The app closes and opens again.
    const { id } = await create.mock.results[0].value;
    const kept = await launch().getRequest(id);

    expect(kept).toMatchObject({
      id,
      status: 'PENDING_VENDOR',
      serviceName: 'Fan Repair',
      notes: COMPLETE.values.notes,
      imageUrls: COMPLETE.imageUrls,
      address: ADDRESS,
    });
    // Open dispatch, kept as the absence of a preference.
    expect(kept && 'preferredVendor' in kept).toBe(false);

    // Kept as a request, never as a draft.
    const keys = jest.mocked(AsyncStorage.setItem).mock.calls.map(([key]) => key);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every(key => key.startsWith(`${AppConfig.storage.mockRequestHistoryKey}/`))).toBe(
      true,
    );
    expect(keys).not.toContain(AppConfig.storage.requestDraftKey);
  });
});

/**
 * Section 54's `request_created`: sent once the service has created the
 * request, never for a send that failed, and described by its shape —
 * identifiers, the priority constant, a count and flags — never by anything
 * the customer wrote or the screen displayed.
 */
describe('RequestConfirmationScreen — what analytics is told (section 54)', () => {
  let track: jest.Mock;

  beforeEach(() => {
    track = jest.fn();
    registerService('analytics', { track, identify: jest.fn() });
  });

  const created = () => track.mock.calls.filter(call => call[0] === 'request_created');

  it('counts the request once it exists, by its shape alone', async () => {
    const { press } = await render();

    await press(COPY.submit);

    expect(track).toHaveBeenCalledTimes(1);
    const [[event, properties]] = track.mock.calls;
    expect(event).toBe('request_created');
    expect(Object.keys(properties).sort()).toEqual([
      'categoryId',
      'directed',
      'hasPreferredDate',
      'hasPreferredTime',
      'photoCount',
      'priority',
      'requestId',
      'subCategoryId',
    ]);
    expect(properties).toEqual({
      // The backend's reference, as `createRequest` answered.
      requestId: 'REQ-9001',
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
      priority: 'HIGH',
      directed: false,
      photoCount: 1,
      hasPreferredDate: true,
      hasPreferredTime: true,
    });

    const serialised = JSON.stringify(track.mock.calls);
    for (const value of [
      COMPLETE.values.notes,
      ADDRESS.formattedAddress,
      'Koramangala',
      'place_koramangala_5th',
      '560095',
      String(ADDRESS.latitude),
      String(ADDRESS.longitude),
      'cdn.example.test',
      '2026-09-09',
      '09:00',
      'Fan Repair',
      'Electrician',
    ]) {
      expect(serialised).not.toContain(value);
    }
  });

  it('says a request was directed, and nothing more about who to', async () => {
    const { press } = await render({
      draft: {
        ...COMPLETE,
        values: { ...COMPLETE.values, preferredDate: '', preferredTime: '' },
        imageUrls: [],
        vendor: { kind: 'vendor', vendorId: 'ven_zenith' },
      },
    });

    await press(COPY.submit);

    expect(created()).toHaveLength(1);
    expect(created()[0][1]).toMatchObject({
      directed: true,
      photoCount: 0,
      hasPreferredDate: false,
      hasPreferredTime: false,
    });
    const serialised = JSON.stringify(track.mock.calls);
    // The request's own record holds the vendor; the event counts the dispatch.
    expect(serialised).not.toContain('ven_zenith');
    expect(serialised).not.toContain('Zenith Electricals');
  });

  it('says which of the two preferences was given, when only one was', async () => {
    const { press } = await render({
      draft: { ...COMPLETE, values: { ...COMPLETE.values, preferredTime: '' } },
    });

    await press(COPY.submit);

    expect(created()[0][1]).toMatchObject({ hasPreferredDate: true, hasPreferredTime: false });
  });

  it('counts nothing for a send that failed, and once for the retry that worked', async () => {
    const createRequest = jest
      .fn()
      .mockRejectedValueOnce(new AppError({ kind: 'network', message: 'socket hang up' }))
      .mockResolvedValueOnce({
        id: 'REQ-9002',
        status: 'CREATED',
        createdAt: '2026-09-01T09:00:00.000Z',
      });
    const { press } = await render({ createRequest });

    await press(COPY.submit);
    expect(track).not.toHaveBeenCalled();

    await press(COPY.submit);

    expect(created()).toHaveLength(1);
    expect(created()[0][1].requestId).toBe('REQ-9002');
  });

  it('counts one request for two presses in the same frame', async () => {
    const { renderer, create } = await render();

    const [submit] = renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === COPY.submit &&
        typeof node.props?.onPress === 'function',
    );
    await act(async () => {
      submit.props.onPress();
      submit.props.onPress();
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(created()).toHaveLength(1);
  });

  it('counts nothing while the request is still being sent', async () => {
    const { press } = await render({ createRequest: () => pending() });

    await press(COPY.submit);
    await press(COPY.submit);

    expect(track).not.toHaveBeenCalled();
  });

  it('still sends the request, and moves on, when analytics throws', async () => {
    registerService('analytics', {
      track: jest.fn(() => {
        throw new Error('provider exploded');
      }),
      identify: jest.fn(),
    });
    const { press, create, resetRoutes } = await render();

    await press(COPY.submit);

    expect(create).toHaveBeenCalledTimes(1);
    expect(resetRoutes()).toEqual(['CustomerTabs', 'RequestSubmitted']);
  });
});
