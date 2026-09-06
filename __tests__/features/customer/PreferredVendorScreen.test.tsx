/**
 * PROJECT_BIBLE.md section 18A gives the frontend three jobs and forbids it a
 * great many others, so this suite is mostly about restraint:
 *
 * - the list is rendered in the backend's order, unsorted and unfiltered
 * - a vendor identifier is submitted and never displayed or spoken
 * - "no preference" produces a payload with no `vendorId` at all — not null,
 *   not an empty string, not a sentinel
 * - an empty or failed vendor list still lets a request through (18A.4)
 *
 * This is also where the create-request payload is proved, because this is the
 * screen that builds it.
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
import { ToastProvider } from '@/shared/components';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CreateRequestInput, RequestService } from '@/shared/services/types/RequestService';
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
  createRequest?: (input: CreateRequestInput) => Promise<{
    id: string;
    status: string;
    createdAt: string;
  }>;
  draft?: RequestDraft | null;
}

async function render({ vendors, createRequest, draft = DRAFT }: Stubs = {}) {
  const listEligibleVendors = jest.fn(
    vendors ?? (async (_categoryId: string, _subCategoryId: string) => VENDORS),
  );

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
      throw new Error('listRecentRequests must not be called from vendor selection');
    }),
    createRequest: create,
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
    create,
    listEligibleVendors,
    text: () => textOf(renderer.toJSON()),
    payload: () => create.mock.calls[create.mock.calls.length - 1]?.[0],
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

  it('will not submit until one of the two outcomes has been chosen', async () => {
    const { press, create, text } = await render();

    await press(COPY.submit);

    expect(create).not.toHaveBeenCalled();
    expect(text()).toContain(COPY.chooseFirst);
  });
});

describe('PreferredVendorScreen — the payload', () => {
  it('sends the chosen vendor identifier', async () => {
    const { choose, press, payload } = await render();

    await choose('Zenith Electricals');
    await press(COPY.submit);

    expect(payload().vendorId).toBe('ven_zenith');
  });

  it('omits vendorId entirely for open dispatch — not null, not a sentinel', async () => {
    const { choose, press, payload } = await render();

    await choose(COPY.noPreferenceTitle);
    await press(COPY.submit);

    const sent = payload();
    expect(sent.vendorId).toBeUndefined();
    expect(sent.vendorId).not.toBeNull();

    // Section 18A: absence is the message. Any of these would be the app
    // inventing a vendor identity the backend would have to recognise.
    const serialised = JSON.stringify(sent);
    expect(serialised).not.toContain('"vendorId"');
    expect(serialised).not.toContain('none');
    expect(serialised).not.toContain('any');
    expect(serialised).not.toContain('noPreference');
  });

  it('sends exactly the fields the contract defines and nothing else', async () => {
    const { choose, press, payload } = await render();

    await choose('Zenith Electricals');
    await press(COPY.submit);

    expect(Object.keys(payload()).sort()).toEqual([
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

  it('sends nothing the vendor card displayed except the identifier', async () => {
    const { choose, press, payload } = await render();

    await choose('Zenith Electricals');
    await press(COPY.submit);

    const serialised = JSON.stringify(payload());
    expect(serialised).not.toContain('Zenith Electricals');
    expect(serialised).not.toContain('4.8');
    expect(serialised).not.toContain('126');
    expect(serialised).not.toContain('2 km away');
    expect(serialised).not.toContain('Available today');
  });

  it('carries the details drafted on the previous screen, translated for the wire', async () => {
    const { choose, press, payload } = await render();

    await choose(COPY.noPreferenceTitle);
    await press(COPY.submit);

    expect(payload()).toMatchObject({
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
      priority: 'HIGH',
      preferredDate: '2026-09-09',
      preferredTime: '09:00',
      notes: 'The fan stops after ten minutes.',
      imageUrls: ['https://cdn.example.test/a.jpg'],
    });
  });

  it('sends no address, which has no contract yet', async () => {
    const { choose, press, payload } = await render();

    await choose(COPY.noPreferenceTitle);
    await press(COPY.submit);

    expect(payload()).not.toHaveProperty('address');
    expect(payload()).not.toHaveProperty('addressId');
  });
});

describe('PreferredVendorScreen — states of the list', () => {
  it('holds the page shape while vendors load, and says it is loading', async () => {
    const { byTestID, renderer } = await render({ vendors: () => pending() });

    expect(byTestID('preferred-vendor-heading').length).toBeGreaterThan(0);

    const [list] = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.testID === 'preferred-vendor-list',
    );
    expect(list.props.accessibilityState.busy).toBe(true);
    expect(list.props.accessibilityLabel).toBe(COPY.loadingLabel);
  });

  it('keeps no preference available while vendors are still loading', async () => {
    const { isSelected, choose } = await render({ vendors: () => pending() });

    await choose(COPY.noPreferenceTitle);

    expect(isSelected(COPY.noPreferenceTitle)).toBe(true);
  });

  it('treats an empty list as normal, and still lets the request through', async () => {
    const { text, byTestID, choose, press, create, payload } = await render({
      vendors: async () => [],
    });

    expect(byTestID('preferred-vendor-empty').length).toBeGreaterThan(0);
    expect(text()).toContain(COPY.emptyMessage);

    // Section 18A.4: an empty vendor list must never block submission.
    await choose(COPY.noPreferenceTitle);
    await press(COPY.submit);

    expect(create).toHaveBeenCalledTimes(1);
    expect(payload().vendorId).toBeUndefined();
  });

  it('keeps the heading and the way forward when the list fails', async () => {
    const { byTestID, text, choose, press, create } = await render({
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

    // Section 18A.4: a failed vendor list must never block submission either.
    await choose(COPY.noPreferenceTitle);
    await press(COPY.submit);
    expect(create).toHaveBeenCalledTimes(1);
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

describe('PreferredVendorScreen — submitting', () => {
  it('reports itself busy while the call is in flight', async () => {
    const { choose, press, renderer } = await render({ createRequest: () => pending() });

    await choose('Zenith Electricals');
    await press(COPY.submit);

    const [button] = renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === COPY.submit,
    );

    expect(button.props.accessibilityState.busy).toBe(true);
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('sends one request however many times the button is pressed', async () => {
    const { choose, press, create } = await render({ createRequest: () => pending() });

    await choose('Zenith Electricals');
    await press(COPY.submit);
    await press(COPY.submit);
    await press(COPY.submit);

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('hands back the reference and leaves the flow, building no confirmation', async () => {
    const { choose, press, popToTop, navigate, text } = await render();

    await choose(COPY.noPreferenceTitle);
    await press(COPY.submit);

    expect(text()).toContain('REQ-9001');
    expect(popToTop).toHaveBeenCalledTimes(1);
    // There is no success route to navigate to, and none is invented.
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the choice and shows only the safe message when creation fails', async () => {
    const failure = new AppError({
      kind: 'network',
      message: 'AxiosError: connect ECONNREFUSED 10.0.0.1:443',
      userMessage: 'We could not reach Fixora. Check your connection and try again.',
    });

    const { choose, press, text, isSelected, popToTop } = await render({
      createRequest: async () => {
        throw failure;
      },
    });

    await choose('Zenith Electricals');
    await press(COPY.submit);

    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain('ECONNREFUSED');
    expect(text()).not.toContain('AxiosError');
    expect(isSelected('Zenith Electricals')).toBe(true);
    expect(popToTop).not.toHaveBeenCalled();
  });

  it('retries through Submit, with the same choice', async () => {
    const createRequest = jest
      .fn()
      .mockRejectedValueOnce(new AppError({ kind: 'network', message: 'socket hang up' }))
      .mockResolvedValueOnce({
        id: 'REQ-9002',
        status: 'CREATED',
        createdAt: '2026-09-01T09:00:00.000Z',
      });

    const { choose, press, create, payload, popToTop } = await render({ createRequest });

    await choose('Apex Repairs');
    await press(COPY.submit);
    expect(create).toHaveBeenCalledTimes(1);

    await press(COPY.submit);

    expect(create).toHaveBeenCalledTimes(2);
    expect(payload().vendorId).toBe('ven_apex');
    expect(popToTop).toHaveBeenCalledTimes(1);
  });

  it('leaves rather than submitting when there is nothing drafted to send', async () => {
    const { goBack, create } = await render({ draft: null });

    expect(goBack).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('PreferredVendorScreen — accessibility', () => {
  it('announces each option as one checkable choice in a named group', async () => {
    const { option, renderer } = await render();

    const zenith = option('Zenith Electricals');
    expect(zenith.props.accessibilityRole).toBe('radio');
    expect(zenith.props.accessibilityState).toMatchObject({ selected: false, checked: false });

    const [list] = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.testID === 'preferred-vendor-list',
    );
    expect(list.props.accessibilityLabel).toBe(COPY.optionsLabel);
    expect(list.props.accessibilityState.busy).toBe(false);
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
