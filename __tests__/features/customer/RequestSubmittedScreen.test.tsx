/**
 * The screen a customer lands on when a request has actually gone.
 *
 * Three rules carry it. It never invents a reference — a number this app made up
 * is a number somebody might quote to a call centre that has never heard of it.
 * It never claims a professional has been told, because dispatch is the
 * backend's and this application cannot see a phone light up. And it survives
 * every piece of optional metadata being absent, because the one thing it must
 * always manage to say is that the request was sent.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';

import { setClipboard } from '@/core/clipboard/Clipboard';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { RequestSubmittedScreen } from '@/features/customer/screens/RequestSubmittedScreen';
import {
  RequestDraftProvider,
  useRequestDraft,
} from '@/features/customer/state/RequestDraftContext';
import type { SubmittedRequest } from '@/features/customer/state/requestDraft';
import { setRequestDraftStorage } from '@/features/customer/state/requestDraftStorage';
import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService, SubCategory } from '@/shared/services/types/CategoryService';
import type { EligibleVendor, VendorService } from '@/shared/services/types/VendorService';
import { ToastProvider } from '@/shared/components';
import { ThemeProvider } from '@/shared/theme';

const COPY = CUSTOMER_COPY.requestSubmitted;
/** The copy button's spoken name for the fixture's reference (T135: it names what it copies). */
const COPY_REFERENCE = COPY.copyReference('REQ-24083');

const CATEGORY_ID = 'cat_electrical';
const SUB_CATEGORY_ID = 'sub_fan';

const CATEGORIES = [{ id: CATEGORY_ID, name: 'Electrician', iconGlyph: 'flash' }];
const SERVICES: SubCategory[] = [{ id: SUB_CATEGORY_ID, name: 'Fan Repair' }];

const VENDORS: EligibleVendor[] = [
  { id: 'ven_zenith', name: 'Zenith Electricals', rating: 4.8, reviewCount: 126 },
];

const ADDRESS = {
  formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
  latitude: 12.9352,
  longitude: 77.6245,
  placeId: 'place_koramangala_5th',
};

/** Open dispatch, which is the case with the fewest fields to lean on. */
const SUBMITTED: SubmittedRequest = {
  reference: 'REQ-24083',
  categoryId: CATEGORY_ID,
  subCategoryId: SUB_CATEGORY_ID,
  address: ADDRESS,
  vendor: { kind: 'open' },
};

/** Records the outcome the way the confirmation screen would have. */
function OutcomeSeed({ outcome }: { outcome: SubmittedRequest | null }) {
  const { recordSubmission } = useRequestDraft();
  const seeded = React.useRef(false);

  if (!seeded.current && outcome) {
    seeded.current = true;
    recordSubmission(outcome);
  }

  return null;
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
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  resetServices();
});

interface Stubs {
  outcome?: SubmittedRequest | null;
  services?: SubCategory[];
  vendors?: EligibleVendor[];
}

async function render({ outcome = SUBMITTED, services = SERVICES, vendors = VENDORS }: Stubs = {}) {
  registerService('category', {
    listServiceCategories: jest.fn(async () => CATEGORIES),
    listSubCategories: jest.fn(async () => services),
  } as CategoryService);

  registerService('vendor', {
    listEligibleVendors: jest.fn(async () => vendors),
  } as VendorService);

  const popToTop = jest.fn();
  const replace = jest.fn();
  const navigation = { popToTop, replace, navigate: jest.fn(), goBack: jest.fn() } as never;
  const route = {
    key: 'RequestSubmitted',
    name: 'RequestSubmitted' as const,
    params: { categoryId: CATEGORY_ID, subCategoryId: SUB_CATEGORY_ID },
  } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        {/* A failed copy is said in a toast (T135). */}
        <ToastProvider>
          <RequestDraftProvider>
            <OutcomeSeed outcome={outcome} />
            <RequestSubmittedScreen navigation={navigation} route={route} />
          </RequestDraftProvider>
        </ToastProvider>
      </ThemeProvider>,
    );
  });

  mounted.push(renderer);

  return {
    renderer,
    popToTop,
    replace,
    text: () => textOf(renderer.toJSON()),
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
      await act(async () => {});
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

describe('RequestSubmittedScreen — what it says', () => {
  it('says the request has gone', async () => {
    const { text, byTestID } = await render();

    expect(byTestID('request-submitted-heading').length).toBeGreaterThan(0);
    expect(text()).toContain(COPY.title);
    expect(text()).toContain(COPY.subtitle);
  });

  it('announces the success rather than arriving in silence', async () => {
    const { byTestID } = await render();

    const [heading] = byTestID('request-submitted-heading');

    expect(heading.props.accessibilityLabel).toBe(COPY.announcement);
    expect(heading.props.accessibilityLiveRegion).toBe('polite');
  });

  it('does not rest the success on colour alone', async () => {
    const { renderer } = await render();

    // A tick reads as a tick in greyscale; a green circle does not. Section 46.
    const marks = renderer.root.findAll(
      node => typeof node.type !== 'string' && node.props?.name === 'success',
    );
    expect(marks.length).toBeGreaterThan(0);
  });

  it('shows what was asked for and where it is going', async () => {
    const { text } = await render();

    expect(text()).toContain('Fan Repair');
    expect(text()).toContain(ADDRESS.formattedAddress);
  });

  it('shows no internal identifiers', async () => {
    const { text } = await render({
      outcome: { ...SUBMITTED, vendor: { kind: 'vendor', vendorId: 'ven_zenith' } },
    });

    expect(text()).not.toContain(CATEGORY_ID);
    expect(text()).not.toContain(SUB_CATEGORY_ID);
    expect(text()).not.toContain('ven_zenith');
    expect(text()).not.toContain(ADDRESS.placeId);
    // And never the coordinates behind the address.
    expect(text()).not.toContain('12.9352');
  });
});

describe('RequestSubmittedScreen — the reference', () => {
  it('shows the one the backend gave', async () => {
    const { byTestID, text } = await render();

    expect(byTestID('request-submitted-reference')).toHaveLength(1);
    expect(text()).toContain('REQ-24083');
  });

  it('announces it with what it is for', async () => {
    const { byTestID } = await render();

    const [block] = byTestID('request-submitted-reference');

    expect(block.props.accessibilityLabel).toBe(`${COPY.referenceLabel}: REQ-24083`);
  });

  it('invents nothing when the service returned none', async () => {
    const { byTestID, text } = await render({ outcome: { ...SUBMITTED, reference: '' } });

    /*
      The whole block is absent rather than empty. A reference this application
      made up is a number a customer might read out to somebody who has never
      heard of it — and an empty field labelled "Reference" reads as one that
      failed to load.
    */
    expect(byTestID('request-submitted-reference')).toHaveLength(0);
    expect(text()).not.toContain(COPY.referenceLabel);
    // The screen still does its job.
    expect(text()).toContain(COPY.title);
  });

  it('copies through the shared abstraction', async () => {
    const { press, text } = await render();

    await press(COPY_REFERENCE);

    expect(copiedValue).toBe('REQ-24083');
    // The button says so, rather than leaving the customer to guess.
    expect(text()).toContain(COPY.copied);
  });

  it('says so when copying fails, without losing the reference', async () => {
    setClipboard({
      copy: async () => {
        throw new Error('clipboard unavailable');
      },
    });

    const { press, text } = await render();

    await press(COPY_REFERENCE);

    expect(text()).toContain(COPY.copyFailed);
    // Still readable, which is the point of the fallback wording.
    expect(text()).toContain('REQ-24083');
  });
});

describe('RequestSubmittedScreen — which dispatch it went out on', () => {
  it('names the professional the customer chose', async () => {
    const { text, byTestID } = await render({
      outcome: { ...SUBMITTED, vendor: { kind: 'vendor', vendorId: 'ven_zenith' } },
    });

    expect(byTestID('request-submitted-dispatch').length).toBeGreaterThan(0);
    expect(text()).toContain(`${COPY.dispatchDirected} Zenith Electricals`);
    expect(text()).not.toContain(COPY.dispatchOpen);
  });

  it('says open dispatch in words rather than leaving the line blank', async () => {
    const { text } = await render();

    expect(text()).toContain(COPY.dispatchOpen);
    expect(text()).not.toContain(COPY.dispatchDirected);
  });

  it('still says the choice stands when the professional cannot be named', async () => {
    const { text } = await render({
      outcome: { ...SUBMITTED, vendor: { kind: 'vendor', vendorId: 'ven_gone' } },
      vendors: [],
    });

    // Directed is directed even when the list cannot say who. It must never
    // fall back to "open to available professionals", which is a different fact.
    expect(text()).toContain(COPY.dispatchDirectedUnknown);
    expect(text()).not.toContain(COPY.dispatchOpen);
  });

  it('never claims anybody has been notified', async () => {
    const directed = await render({
      outcome: { ...SUBMITTED, vendor: { kind: 'vendor', vendorId: 'ven_zenith' } },
    });
    const open = await render();

    /*
      Dispatch is the backend's (section 18A) and this application cannot see a
      phone light up. The copy says where the request was pointed, never that
      anyone has received it.

      The word "Notifications" may appear, as the name of the customer's own
      inbox — where they will be told (21/10/2026) — but nothing may say a
      notification went to anybody.
    */
    for (const screen of [directed, open]) {
      expect(screen.text()).not.toMatch(
        /notified|alerted|has been told|notification (was |has been )?sent|sent (a |the )?notification/i,
      );
      const mentions = screen.text().match(/notification\w*/gi) ?? [];
      expect(mentions).toEqual([NOTIFICATIONS_COPY.inbox.title]);
    }
  });
});

describe('RequestSubmittedScreen — when things are missing', () => {
  it('does not print "undefined" for a service name that never loaded', async () => {
    const { text } = await render({ services: [] });

    expect(text()).not.toContain('undefined');
    expect(text()).not.toContain('null');
    // Falls back to the category, which did load, rather than to a blank.
    expect(text()).toContain('Electrician');
  });

  it('survives the catalogue failing entirely', async () => {
    registerService('category', {
      listServiceCategories: jest.fn(async () => {
        throw new Error('catalogue down');
      }),
      listSubCategories: jest.fn(async () => {
        throw new Error('catalogue down');
      }),
    } as CategoryService);

    const { text } = await render();

    // Names are a caption. The request still went, and that is what this screen
    // exists to say.
    expect(text()).toContain(COPY.title);
    expect(text()).toContain('REQ-24083');
    expect(text()).not.toContain('undefined');
    expect(text()).not.toContain('catalogue down');
  });

  it('leaves rather than confirming nothing when there is no outcome', async () => {
    const { replace, byTestID } = await render({ outcome: null });

    // Reachable by reopening the app on this screen, where the outcome — memory
    // only, on purpose — did not survive. Home is the honest destination.
    expect(replace).toHaveBeenCalledWith('CustomerTabs', { screen: 'Home' });
    expect(byTestID('request-submitted-heading')).toHaveLength(0);
  });
});

/**
 * Opening the request is a handoff, not a second copy of the outcome. The
 * success screen knows the reference; request details reads everything else
 * from the service, so the only thing that may cross is the reference itself.
 */
describe('RequestSubmittedScreen — opening the request', () => {
  /*
    Only the calls that open a request.

    `OutcomeSeed` records the outcome while the tree is already rendering, so the
    screen's first effect can see no outcome yet and send itself Home once before
    the record lands. That is this harness, not the app — the confirmation screen
    records the outcome before it navigates — and it is filtered out rather than
    counted, so these tests assert on the handoff alone.
  */
  const openings = (replace: jest.Mock) =>
    replace.mock.calls.filter(([name]) => name === 'RequestDetails');

  it('opens the request it just sent, by its reference', async () => {
    const { press, replace } = await render();

    await press(COPY.viewRequest);

    // `replace`, so Back from the request reaches Home rather than returning to
    // "Request sent" a second time.
    expect(openings(replace)).toEqual([['RequestDetails', { requestId: 'REQ-24083' }]]);
  });

  it('opens it by its id when the backend quotes a different reference', async () => {
    // The real backend: `REQ-…` for people, its database id for calls (Phase 4A).
    const { press, replace, text } = await render({
      outcome: { ...SUBMITTED, reference: 'REQ-0031002405', requestId: '6afc3ea3c2951ec40c9a177a' },
    });

    expect(text()).toContain('REQ-0031002405');
    expect(text()).not.toContain('6afc3ea3c2951ec40c9a177a');

    await press(COPY.viewRequest);

    expect(openings(replace)).toEqual([['RequestDetails', { requestId: '6afc3ea3c2951ec40c9a177a' }]]);
  });

  it('hands over the reference and nothing else', async () => {
    const { press, replace } = await render({
      outcome: { ...SUBMITTED, vendor: { kind: 'vendor', vendorId: 'ven_zenith' } },
    });

    await press(COPY.viewRequest);

    const [[, params]] = openings(replace);
    expect(Object.keys(params)).toEqual(['requestId']);
    // An address in a route param is an address in navigation state.
    const serialised = JSON.stringify(params);
    expect(serialised).not.toContain(ADDRESS.formattedAddress);
    expect(serialised).not.toContain('ven_zenith');
  });

  it('offers nothing to open when the backend gave no reference', async () => {
    const { renderer, replace } = await render({ outcome: { ...SUBMITTED, reference: '' } });

    const buttons = renderer.root
      .findAll(
        node =>
          node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function',
      )
      .map(node => node.props.accessibilityLabel);

    // A request with no reference is one this app has no way to look up, so
    // Home is the only way on — and it leads.
    expect(buttons).toEqual([COPY.home]);
    expect(openings(replace)).toEqual([]);
  });
});

describe('RequestSubmittedScreen — leaving', () => {
  it('goes home, and offers no way back into the form', async () => {
    const { press, popToTop, text } = await render();

    await press(COPY.home);

    expect(popToTop).toHaveBeenCalledTimes(1);
    // There is nothing else to press: no Submit, no Continue, no Back control.
    expect(text()).not.toContain(CUSTOMER_COPY.confirmation.submit);
  });

  it('has nothing on it that could send another request', async () => {
    const { renderer } = await render();

    const buttons = renderer.root
      .findAll(node => node.props?.accessibilityRole === 'button')
      .map(node => node.props.accessibilityLabel);

    // Copy, open the request, and Home — and that is the whole surface. A
    // success screen that could submit is a success screen that can submit twice.
    expect(new Set(buttons)).toEqual(new Set([COPY_REFERENCE, COPY.viewRequest, COPY.home]));
  });

  it('leaves no draft behind for Home to offer', async () => {
    let hasDraft: boolean | null = null;

    function Probe() {
      const { draft } = useRequestDraft();
      hasDraft = draft !== null;
      return null;
    }

    registerService('category', {
      listServiceCategories: jest.fn(async () => CATEGORIES),
      listSubCategories: jest.fn(async () => SERVICES),
    } as CategoryService);
    registerService('vendor', {
      listEligibleVendors: jest.fn(async () => VENDORS),
    } as VendorService);

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <RequestDraftProvider>
            <OutcomeSeed outcome={SUBMITTED} />
            <Probe />
          </RequestDraftProvider>
        </ThemeProvider>,
      );
    });
    mounted.push(renderer);

    // Recording the submission and destroying the draft are one event, so a
    // sent request can never be offered back as something to continue.
    expect(hasDraft).toBe(false);
  });
});
