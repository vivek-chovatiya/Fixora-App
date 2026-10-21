/**
 * PROJECT_BIBLE.md section 18A gives the frontend three jobs and forbids it a
 * great many others, so this suite is mostly about restraint:
 *
 * - the list is rendered in the backend's order, unsorted and unfiltered
 * - a vendor identifier is captured and never displayed or spoken
 * - an empty or failed vendor list still lets a request through (18A.4)
 *
 * And one rule of its own: nobody reaches the summary without answering the
 * vendor question either way, which section 19 requires and which this screen is
 * the only place to enforce.
 *
 * The payload itself is proved on the confirmation screen, which builds it.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { PreferredVendorScreen } from '@/features/customer/screens/PreferredVendorScreen';
import {
  RequestDraftProvider,
  useRequestDraft,
  type RequestDraft,
} from '@/features/customer/state/RequestDraftContext';
import { NO_VENDOR_CHOICE } from '@/features/customer/state/requestDraft';
import { setRequestDraftStorage } from '@/features/customer/state/requestDraftStorage';
import { ToastProvider } from '@/shared/components';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { RequestService } from '@/shared/services/types/RequestService';
import type { EligibleVendor, VendorService } from '@/shared/services/types/VendorService';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const COPY = CUSTOMER_COPY.preferredVendor;

const CATEGORY_ID = 'cat_electrical';
const SUB_CATEGORY_ID = 'sub_fan';

/**
 * Deliberately not in alphabetical order — the order is the recommendation
 * (18A.2) — and one entry deliberately carries nothing but a name, because a
 * vendor new to the platform has no rating and is not a broken row.
 */
const VENDORS: EligibleVendor[] = [
  {
    id: 'ven_zenith',
    name: 'Zenith Electricals',
    rating: 4.8,
    reviewCount: 126,
    areaLabel: '2 km away',
    availabilityLabel: 'Available today',
  },
  { id: 'ven_apex', name: 'Apex Repairs' },
  {
    id: 'ven_bright',
    name: 'Bright Spark Electrical Services and Repairs',
    rating: 4.6,
    reviewCount: 89,
    areaLabel: 'Indiranagar',
  },
];

const DRAFT: RequestDraft = {
  categoryId: CATEGORY_ID,
  subCategoryId: SUB_CATEGORY_ID,
  values: {
    priority: 'HIGH',
    preferredDate: '2026-09-09',
    preferredTime: '09:00',
    notes: 'The fan stops after ten minutes.',
  },
  imageUrls: ['https://cdn.example.test/a.jpg'],
  // The address is already answered by the time this screen is reached; it is
  // the step before. Without one the flow would send the customer back rather
  // than forward, which is a different screen's test.
  address: { formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095' },
  vendor: NO_VENDOR_CHOICE,
};

/** A promise a test can leave hanging, so an in-flight state is observable. */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

/** Seeds the draft the screen expects to find, the way the details screen does. */
function DraftSeed({ draft }: { draft: RequestDraft | null }) {
  const { startDraft } = useRequestDraft();
  const seeded = React.useRef(false);

  if (!seeded.current && draft) {
    seeded.current = true;
    startDraft(draft);
  }

  return null;
}

interface Stubs {
  vendors?: (categoryId: string, subCategoryId: string) => Promise<EligibleVendor[]>;
  draft?: RequestDraft | null;
}

async function render({ vendors, draft = DRAFT }: Stubs = {}) {
  const listEligibleVendors = jest.fn(
    vendors ?? (async (_categoryId: string, _subCategoryId: string) => VENDORS),
  );

  registerService('vendor', { listEligibleVendors } as VendorService);

  /*
    Both throw, and that is the assertion.

    This screen captures a choice; sending is the confirmation screen's job. A
    stub that resolved would let a regression that submitted from here pass every
    test in this file.
  */
  registerService('request', {
    listRecentRequests: jest.fn(() => {
      throw new Error('listRecentRequests must not be called from vendor selection');
    }),
    createRequest: jest.fn(() => {
      throw new Error('createRequest must not be called from vendor selection');
    }),
    getRequest: jest.fn(() => {
      throw new Error('getRequest must not be called from vendor selection');
    }),
    listRequests: jest.fn(() => {
      throw new Error('listRequests must not be called from vendor selection');
    }),
    cancelRequest: jest.fn(() => {
      throw new Error('cancelRequest must never be called from vendor selection');
    }),
  } as RequestService);

  const goBack = jest.fn();
  const navigate = jest.fn();
  const popToTop = jest.fn();
  const navigation = { goBack, navigate, popToTop } as never;
  const route = {
    key: 'PreferredVendor',
    name: 'PreferredVendor' as const,
    params: { categoryId: CATEGORY_ID, subCategoryId: SUB_CATEGORY_ID },
  } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <ToastProvider>
          <RequestDraftProvider>
            <DraftSeed draft={draft} />
            <PreferredVendorScreen navigation={navigation} route={route} />
          </RequestDraftProvider>
        </ToastProvider>
      </ThemeProvider>,
    );
  });

  mounted.push(renderer);

  const option = (label: string) =>
    renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'radio' &&
        typeof node.props?.accessibilityLabel === 'string' &&
        (node.props.accessibilityLabel as string).startsWith(label) &&
        typeof node.props?.onPress === 'function',
    )[0];

  const tap = async (node: ReturnType<typeof option>, what: string) => {
    if (!node) {
      throw new Error(`No option for "${what}"`);
    }
    await act(async () => {
      node.props.onPress();
    });
  };

  return {
    renderer,
    goBack,
    navigate,
    popToTop,
    listEligibleVendors,
    text: () => textOf(renderer.toJSON()),
    option,
    /** Selects a vendor or "no preference" by the start of its spoken name. */
    choose: async (label: string) => tap(option(label), label),
    isSelected: (label: string) => option(label)?.props.accessibilityState.selected,
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
    byTestID: (id: string) =>
      renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id),
    /**
     * The testID of every native view on screen that says it is busy.
     *
     * Ids, not the nodes: a failed match on a test instance makes jest print it,
     * and printing one walks the whole fiber tree — the run never finishes.
     */
    busy: () =>
      renderer.root
        .findAll(
          node => typeof node.type === 'string' && node.props?.accessibilityState?.busy === true,
        )
        .map(node => node.props.testID as string | undefined),
    /**
     * Whether this very node is still drawn. A view React updated in place is
     * the same node with new props; a replaced one is gone from the tree.
     */
    inTree: (target: ReactTestRenderer.ReactTestInstance) =>
      renderer.root.findAll(node => node === target).length > 0,
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
 * Unmounted between tests, not merely dropped.
 *
 * A test that leaves the screen in its loading state leaves skeletons repeating
 * their animation for ever, and jest's worker then refuses to exit. Unmounting
 * runs the cleanup the component already has, which is the same thing that
 * happens when a customer navigates away.
 */
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  // The seed comes from DraftSeed, not from the device.
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

describe('PreferredVendorScreen — the list', () => {
  it('asks for vendors using both identifiers it was routed with', async () => {
    const { listEligibleVendors } = await render();

    expect(listEligibleVendors).toHaveBeenCalledTimes(1);
    expect(listEligibleVendors).toHaveBeenCalledWith(CATEGORY_ID, SUB_CATEGORY_ID);
  });

  it('renders every vendor, in the order the backend returned them', async () => {
    const { renderer } = await render();

    const names = renderer.root
      // Both the composite Pressable and the host view it renders carry the
      // role; the handler is what tells them apart.
      .findAll(
        node =>
          node.props?.accessibilityRole === 'radio' &&
          typeof node.props?.onPress === 'function',
      )
      .map(node => node.props.accessibilityLabel as string)
      // The last option is always "no preference", which is not a vendor.
      .slice(0, VENDORS.length);

    expect(names[0]).toContain('Zenith Electricals');
    expect(names[1]).toContain('Apex Repairs');
    expect(names[2]).toContain('Bright Spark Electrical Services and Repairs');
  });

  it('renders a vendor that has nothing but a name', async () => {
    const { text } = await render();

    expect(text()).toContain('Apex Repairs');
  });

  it('shows what the backend supplied and nothing it would have to work out', async () => {
    const { text } = await render();

    expect(text()).toContain('4.8 (126)');
    expect(text()).toContain('2 km away');
    expect(text()).toContain('Available today');
  });

  it('never displays a vendor identifier', async () => {
    const { text, renderer } = await render();

    const spoken = renderer.root
      .findAll(node => typeof node.props?.accessibilityLabel === 'string')
      .map(node => node.props.accessibilityLabel as string)
      .join(' ');

    for (const vendor of VENDORS) {
      expect(text()).not.toContain(vendor.id);
      expect(spoken).not.toContain(vendor.id);
    }
  });
});

describe('PreferredVendorScreen — choosing', () => {
  it('starts with nothing chosen, so no vendor is assumed', async () => {
    const { isSelected } = await render();

    expect(isSelected('Zenith Electricals')).toBe(false);
    expect(isSelected('Apex Repairs')).toBe(false);
    expect(isSelected(COPY.noPreferenceTitle)).toBe(false);
  });

  it('selects exactly one vendor', async () => {
    const { choose, isSelected } = await render();

    await choose('Zenith Electricals');

    expect(isSelected('Zenith Electricals')).toBe(true);
    expect(isSelected('Apex Repairs')).toBe(false);
    expect(isSelected(COPY.noPreferenceTitle)).toBe(false);
  });

  it('deselects the previous vendor when another is chosen', async () => {
    const { choose, isSelected } = await render();

    await choose('Zenith Electricals');
    await choose('Apex Repairs');

    expect(isSelected('Apex Repairs')).toBe(true);
    expect(isSelected('Zenith Electricals')).toBe(false);
  });

  it('deselects the vendor when no preference is chosen', async () => {
    const { choose, isSelected } = await render();

    await choose('Zenith Electricals');
    await choose(COPY.noPreferenceTitle);

    expect(isSelected(COPY.noPreferenceTitle)).toBe(true);
    expect(isSelected('Zenith Electricals')).toBe(false);
  });

  it('deselects no preference when a vendor is chosen', async () => {
    const { choose, isSelected } = await render();

    await choose(COPY.noPreferenceTitle);
    await choose('Zenith Electricals');

    expect(isSelected('Zenith Electricals')).toBe(true);
    expect(isSelected(COPY.noPreferenceTitle)).toBe(false);
  });

  it('will not go on until one of the two outcomes has been chosen', async () => {
    const { press, navigate, text } = await render();

    await press(COPY.submit);

    expect(navigate).not.toHaveBeenCalled();
    expect(text()).toContain(COPY.chooseFirst);
  });

  it('says nothing about the missing choice until Continue is pressed', async () => {
    const { text } = await render();

    expect(text()).not.toContain(COPY.chooseFirst);
  });

  it('goes on to the summary once a vendor is chosen', async () => {
    const { choose, press, navigate } = await render();

    await choose('Zenith Electricals');
    await press(COPY.submit);

    expect(navigate).toHaveBeenCalledWith('RequestConfirmation', {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
    });
  });

  it('goes on to the summary once no preference is chosen', async () => {
    const { choose, press, navigate } = await render();

    await choose(COPY.noPreferenceTitle);
    await press(COPY.submit);

    expect(navigate).toHaveBeenCalledWith('RequestConfirmation', {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
    });
  });

  it('opens on the answer a resumed draft already carried', async () => {
    const { isSelected } = await render({
      draft: { ...DRAFT, vendor: { kind: 'vendor', vendorId: 'ven_apex' } },
    });

    expect(isSelected('Apex Repairs')).toBe(true);
    expect(isSelected(COPY.noPreferenceTitle)).toBe(false);
  });
});

describe('PreferredVendorScreen — states of the list', () => {
  it('holds the page shape while vendors load, and says it is loading', async () => {
    const { byTestID, busy } = await render({ vendors: () => pending() });

    expect(byTestID('preferred-vendor-heading').length).toBeGreaterThan(0);

    // One region says the wait once, named and busy — not the list itself.
    const [region] = byTestID('preferred-vendor-loading');
    expect(region.props.accessibilityLabel).toBe(COPY.loadingLabel);
    expect(region.props.accessibilityState).toEqual({ busy: true });
    expect(busy()).toEqual(['preferred-vendor-loading']);

    const [list] = byTestID('preferred-vendor-list');
    expect(list.props.accessibilityLabel).toBeUndefined();
    expect(list.props.accessibilityState).toBeUndefined();
    expect(list.props.accessibilityRole).toBeUndefined();
  });

  it('replaces the busy region once the vendors land, and leaves the list unnamed', async () => {
    // The list used to be named on every render — "Loading professionals",
    // then "Available professionals" — so loaded, TalkBack stopped on it to say
    // what the heading and subtitle had just said. Now the wait is its own
    // region, and it is gone, not updated, when the vendors arrive.
    let answer!: (vendors: EligibleVendor[]) => void;
    const { byTestID, busy, text } = await render({
      vendors: () => new Promise<EligibleVendor[]>(resolve => (answer = resolve)),
    });

    const [waiting] = byTestID('preferred-vendor-loading');
    expect(waiting.props.accessibilityState).toEqual({ busy: true });

    await act(async () => {
      answer(VENDORS);
    });

    expect(text()).toContain('Zenith Electricals');
    // Not hidden or emptied: no longer in the tree at all, so its busy cannot outlive it.
    expect(byTestID('preferred-vendor-loading')).toHaveLength(0);
    const [list] = byTestID('preferred-vendor-list');
    expect(list === waiting).toBe(false);
    expect(list.props.accessibilityLabel).toBeUndefined();
    expect(list.props.accessibilityState).toBeUndefined();
    expect(list.props.accessibilityRole).toBeUndefined();
    // Nothing anywhere on the loaded screen still says busy.
    expect(busy()).toEqual([]);
  });

  it('replaces the busy region with the failure, and the failure with it on Try again', async () => {
    // The failure here is a plain view in the same slot. Were the two not
    // keyed apart, React would update one into the other, and on Android the
    // native view can keep `busy` after the state has gone from its props.
    let calls = 0;
    let fail!: (error: AppError) => void;
    let answer!: (vendors: EligibleVendor[]) => void;
    const { byTestID, busy, inTree, press } = await render({
      vendors: () => {
        calls += 1;
        return calls === 1
          ? new Promise<EligibleVendor[]>((_, reject) => (fail = reject))
          : new Promise<EligibleVendor[]>(resolve => (answer = resolve));
      },
    });

    const [waiting] = byTestID('preferred-vendor-loading');

    await act(async () => {
      fail(new AppError({ kind: 'network', message: 'socket hang up' }));
    });

    const [failure] = byTestID('preferred-vendor-error');
    expect(failure).toBeDefined();
    expect(inTree(waiting)).toBe(false);
    expect(busy()).toEqual([]);

    // The view around the failure, which the next wait must replace, not become.
    let around = failure.parent;
    while (around && typeof around.type !== 'string') {
      around = around.parent;
    }
    expect(around).not.toBeNull();

    await press('Try again');

    const [again] = byTestID('preferred-vendor-loading');
    expect(again.props.accessibilityLabel).toBe(COPY.loadingLabel);
    expect(busy()).toEqual(['preferred-vendor-loading']);
    expect(inTree(around as ReactTestRenderer.ReactTestInstance)).toBe(false);

    await act(async () => {
      answer(VENDORS);
    });

    expect(busy()).toEqual([]);
  });

  it('keeps no preference available while vendors are still loading', async () => {
    const { isSelected, choose } = await render({ vendors: () => pending() });

    await choose(COPY.noPreferenceTitle);

    expect(isSelected(COPY.noPreferenceTitle)).toBe(true);
  });

  it('treats an empty list as normal, and still lets the request through', async () => {
    const { text, byTestID, choose, press, navigate, busy } = await render({
      vendors: async () => [],
    });

    expect(byTestID('preferred-vendor-empty').length).toBeGreaterThan(0);
    expect(text()).toContain(COPY.emptyMessage);
    // Its own words, under a list that is still no stop of its own.
    expect(byTestID('preferred-vendor-loading')).toHaveLength(0);
    const [list] = byTestID('preferred-vendor-list');
    expect(list.props.accessibilityLabel).toBeUndefined();
    expect(list.props.accessibilityState).toBeUndefined();
    expect(busy()).toEqual([]);

    // Section 18A.4: an empty vendor list must never block submission.
    await choose(COPY.noPreferenceTitle);
    await press(COPY.submit);

    expect(navigate).toHaveBeenCalledWith('RequestConfirmation', expect.anything());
  });

  it('keeps the heading and the way forward when the list fails', async () => {
    const { byTestID, text, choose, press, navigate, busy } = await render({
      vendors: async () => {
        throw new AppError({
          kind: 'network',
          message: 'AxiosError: connect ECONNREFUSED 10.0.0.1:443',
          userMessage: 'We could not reach Fixora.',
        });
      },
    });

    // Replacing the list with the error would take the heading and, worse, the
    // "no preference" option with it.
    expect(byTestID('preferred-vendor-heading').length).toBeGreaterThan(0);
    expect(text()).toContain(COPY.errorFallback);
    // Its own words, under a list that is still no stop of its own.
    expect(byTestID('preferred-vendor-loading')).toHaveLength(0);
    const [list] = byTestID('preferred-vendor-list');
    expect(list.props.accessibilityLabel).toBeUndefined();
    expect(list.props.accessibilityState).toBeUndefined();
    expect(busy()).toEqual([]);

    // Section 18A.4: a failed vendor list must never block submission either.
    await choose(COPY.noPreferenceTitle);
    await press(COPY.submit);
    expect(navigate).toHaveBeenCalledWith('RequestConfirmation', expect.anything());
  });

  it('never renders a raw failure', async () => {
    const { text } = await render({
      vendors: async () => {
        throw new AppError({
          kind: 'network',
          message: 'AxiosError: connect ECONNREFUSED 10.0.0.1:443',
          userMessage: 'We could not reach Fixora.',
        });
      },
    });

    expect(text()).toContain('We could not reach Fixora.');
    expect(text()).not.toContain('ECONNREFUSED');
    expect(text()).not.toContain('AxiosError');
    expect(text()).not.toContain('10.0.0.1');
  });

  it('retries by asking the vendor service again', async () => {
    const listEligibleVendors = jest
      .fn()
      .mockRejectedValueOnce(new AppError({ kind: 'network', message: 'socket hang up' }))
      .mockResolvedValueOnce(VENDORS);

    const { press, text } = await render({ vendors: listEligibleVendors });

    expect(listEligibleVendors).toHaveBeenCalledTimes(1);

    await press('Try again');

    expect(listEligibleVendors).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Zenith Electricals');
  });
});

describe('PreferredVendorScreen — accessibility', () => {
  it('announces each option as one checkable choice, under a list that is no stop of its own', async () => {
    const { option, renderer } = await render();

    const zenith = option('Zenith Electricals');
    expect(zenith.props.accessibilityRole).toBe('radio');
    expect(zenith.props.accessibilityState).toMatchObject({ selected: false, checked: false });

    // The heading introduces the choices; a name on the list would be one more
    // TalkBack stop saying it again.
    const [list] = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.testID === 'preferred-vendor-list',
    );
    expect(list.props.accessibilityLabel).toBeUndefined();
    expect(list.props.accessibilityState).toBeUndefined();
  });

  it('speaks a vendor card as one sentence, not as five loose nodes', async () => {
    const { option } = await render();

    expect(option('Zenith Electricals').props.accessibilityLabel).toBe(
      'Zenith Electricals. 4.8 stars, 126 reviews. 2 km away. Available today',
    );
  });

  it('says nothing it cannot back up about a vendor with no rating', async () => {
    const { option } = await render();

    expect(option('Apex Repairs').props.accessibilityLabel).toBe('Apex Repairs');
  });

  it('names no preference as what it does', async () => {
    const { option } = await render();

    const node = option(COPY.noPreferenceTitle);
    expect(node.props.accessibilityLabel).toBe(
      `${COPY.noPreferenceTitle}. ${COPY.noPreferenceMessage}`,
    );
    expect(node.props.accessibilityHint).toBe(COPY.noPreferenceHint);
  });

  it('names Back, and leaks no icon glyph into any announcement', async () => {
    const { renderer } = await render();

    const labels = renderer.root
      .findAll(node => typeof node.props?.accessibilityLabel === 'string')
      .map(node => node.props.accessibilityLabel as string);

    expect(labels).toContain(COPY.back);
    expect(labels.some(label => label.includes('check'))).toBe(false);
    expect(labels.some(label => label.includes('account-group'))).toBe(false);
    expect(labels.some(label => label.includes('storefront'))).toBe(false);
  });

  it('meets the minimum touch target on every option', async () => {
    const { renderer } = await render();

    const options = renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'radio' && typeof node.props?.onPress === 'function',
    );

    expect(options.length).toBe(VENDORS.length + 1);
    for (const node of options) {
      const style = node.props.style({ pressed: false });
      const minHeight = style.find(
        (entry: { minHeight?: number } | false) => entry && entry.minHeight,
      )?.minHeight;
      expect(minHeight).toBeGreaterThanOrEqual(44);
    }
  });
});

/**
 * The address step sits in front of this one, which means this screen can now be
 * reached with an earlier answer missing — and did, on device, silently do
 * nothing when it was. Its own question gets its own message; anything earlier
 * gets the screen that asks it.
 */
describe('PreferredVendorScreen — when an earlier answer is missing', () => {
  it('goes back for the address rather than refusing in silence', async () => {
    const { press, navigate } = await render({
      draft: { ...DRAFT, address: null, vendor: { kind: 'open' } },
    });

    await press(COPY.submit);

    // Not a dead button: the vendor question is answered, so this screen has
    // nothing to say and the useful response is the step that does.
    expect(navigate).toHaveBeenCalledWith('ServiceAddress', {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
    });
  });

  it('still answers for its own question first', async () => {
    const { press, navigate, text } = await render({
      draft: { ...DRAFT, address: null, vendor: NO_VENDOR_CHOICE },
    });

    await press(COPY.submit);

    // Both are missing. The one this screen asks is the one it names, and it
    // does not bounce somebody away from a question they have not answered yet.
    expect(text()).toContain(COPY.chooseFirst);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the answer it already had when it sends them back', async () => {
    const { press, isSelected } = await render({
      draft: { ...DRAFT, address: null, vendor: { kind: 'open' } },
    });

    await press(COPY.submit);

    // Going back for a missing answer must not un-answer the one that is here.
    expect(isSelected(COPY.noPreferenceTitle)).toBe(true);
  });
});

/**
 * Section 54's dispatch decision — the pair section 58 reads to learn whether
 * customers want to choose a vendor at all. Sent once, when the customer moves
 * on with an answer, never as cards are tapped; a skip says why, so a list that
 * was empty, failed or had not arrived is never counted as a customer who saw
 * vendors and chose none. Identifiers and a reason only: no vendor's name, and
 * nothing from the draft the customer wrote.
 */
describe('PreferredVendorScreen — what analytics is told (section 54)', () => {
  let track: jest.Mock;

  beforeEach(() => {
    track = jest.fn();
    registerService('analytics', { track, identify: jest.fn() });
  });

  const events = () => track.mock.calls.map(call => call[0] as string);

  /** Nothing the customer wrote, and no name the screen displayed. */
  function expectNothingPersonal() {
    const serialised = JSON.stringify(track.mock.calls);
    for (const value of [
      'Zenith Electricals',
      'Apex Repairs',
      'Bright Spark',
      DRAFT.values.notes,
      'Koramangala',
      'cdn.example.test',
      '2026-09-09',
    ]) {
      expect(serialised).not.toContain(value);
    }
  }

  it('counts the vendor the customer moves on with — not each one tapped on the way', async () => {
    const { choose, press } = await render();

    await choose('Zenith Electricals');
    await choose('Apex Repairs');
    expect(track).not.toHaveBeenCalled();

    await press(COPY.submit);

    expect(track).toHaveBeenCalledTimes(1);
    const [event, properties] = track.mock.calls[0];
    expect(event).toBe('vendor_selected');
    expect(Object.keys(properties).sort()).toEqual(['categoryId', 'subCategoryId', 'vendorId']);
    expect(properties).toEqual({
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
      vendorId: 'ven_apex',
    });
    expectNothingPersonal();
  });

  it('counts no preference from a list of vendors as chosen_none', async () => {
    const { choose, press } = await render();

    await choose(COPY.noPreferenceTitle);
    await press(COPY.submit);

    expect(events()).toEqual(['vendor_selection_skipped']);
    const properties = track.mock.calls[0][1];
    expect(Object.keys(properties).sort()).toEqual(['categoryId', 'reason', 'subCategoryId']);
    expect(properties).toEqual({
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
      reason: 'chosen_none',
    });
    expectNothingPersonal();
  });

  it.each([
    ['list_empty', 'the list was empty', async () => [] as EligibleVendor[]],
    [
      'list_failed',
      'the list failed',
      async (): Promise<EligibleVendor[]> => {
        throw new AppError({ kind: 'network', message: 'ECONNREFUSED 10.0.0.1:443' });
      },
    ],
    ['list_loading', 'the list had not arrived', () => pending<EligibleVendor[]>()],
  ] as const)('says %s when %s', async (reason, _when, vendors) => {
    const { choose, press } = await render({ vendors });

    await choose(COPY.noPreferenceTitle);
    await press(COPY.submit);

    expect(events()).toEqual(['vendor_selection_skipped']);
    expect(track.mock.calls[0][1]).toEqual({
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
      reason,
    });
  });

  it('says the list was being read again, not that it failed, while a retry is out', async () => {
    let calls = 0;
    const { choose, press } = await render({
      vendors: () => {
        calls += 1;
        if (calls === 1) {
          return Promise.reject(new AppError({ kind: 'network', message: 'offline' }));
        }
        return pending<EligibleVendor[]>();
      },
    });

    await press('Try again');
    await choose(COPY.noPreferenceTitle);
    await press(COPY.submit);

    expect(track.mock.calls[0][1].reason).toBe('list_loading');
  });

  it('does not count the same decision twice — a second Continue, or Continue again unchanged', async () => {
    const { choose, press } = await render();

    await choose('Zenith Electricals');
    await press(COPY.submit);
    await press(COPY.submit);
    // Back from the summary, the same vendor tapped again, and on.
    await choose('Zenith Electricals');
    await press(COPY.submit);

    expect(events()).toEqual(['vendor_selected']);
  });

  it('counts a changed mind as a new decision', async () => {
    const { choose, press } = await render();

    await choose('Zenith Electricals');
    await press(COPY.submit);
    await choose(COPY.noPreferenceTitle);
    await press(COPY.submit);
    await choose('Zenith Electricals');
    await press(COPY.submit);

    expect(events()).toEqual(['vendor_selected', 'vendor_selection_skipped', 'vendor_selected']);
    expect(track.mock.calls[1][1].reason).toBe('chosen_none');
  });

  it('counts nothing while the question is unanswered', async () => {
    const { press, navigate } = await render();

    await press(COPY.submit);

    expect(navigate).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('counts nothing when it sends the customer back for an earlier answer', async () => {
    const { press, navigate } = await render({
      draft: { ...DRAFT, address: null, vendor: { kind: 'vendor', vendorId: 'ven_zenith' } },
    });

    await press(COPY.submit);

    expect(navigate).toHaveBeenCalledWith('ServiceAddress', expect.anything());
    expect(track).not.toHaveBeenCalled();
  });

  it('counts a resumed answer when the customer moves on with it', async () => {
    const { press } = await render({
      draft: { ...DRAFT, vendor: { kind: 'vendor', vendorId: 'ven_bright' } },
    });

    await press(COPY.submit);

    expect(events()).toEqual(['vendor_selected']);
    expect(track.mock.calls[0][1].vendorId).toBe('ven_bright');
  });
});
