/**
 * Choosing a saved address while raising a request.
 *
 * Three rules carry this, and each is tested here rather than described:
 *
 * - it reads the book and changes nothing in it — every write on the service
 *   is a stub that throws;
 * - what it puts on the draft is a copy, by value, exactly the address a
 *   request carries — and the Service Address screen it returns to shows it in
 *   the box, where the customer can still edit it;
 * - it is one choice, once: a second tap cannot pop a second screen.
 *
 * Its states are the ones every list owes: placeholders while the book is
 * read — one named, busy region of their own — the failure with a retry, an
 * empty book, and the list itself, which carries no name or state of its own.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { requestAddressFromSaved } from '@/features/customer/hooks/useSavedAddresses';
import { ChooseSavedAddressScreen } from '@/features/customer/screens/ChooseSavedAddressScreen';
import { ServiceAddressScreen } from '@/features/customer/screens/ServiceAddressScreen';
import {
  RequestDraftProvider,
  useRequestDraft,
  type RequestDraft,
} from '@/features/customer/state/RequestDraftContext';
import { NO_VENDOR_CHOICE } from '@/features/customer/state/requestDraft';
import { setRequestDraftStorage } from '@/features/customer/state/requestDraftStorage';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { AddressBookService, SavedAddress } from '@/shared/services/types/AddressBookService';
import type { AddressService, AddressSuggestion } from '@/shared/services/types/AddressService';
import type { Coordinates, LocationService } from '@/shared/services/types/LocationService';
import type { PermissionService } from '@/shared/services/types/PermissionService';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const COPY = CUSTOMER_COPY.chooseSavedAddress;
const BOOK = CUSTOMER_COPY.addressBook;
const ADDRESS_COPY = CUSTOMER_COPY.serviceAddress;

const CATEGORY_ID = 'cat_electrical';
const SUB_CATEGORY_ID = 'sub_fan';

/** The service's order: the default first. */
const HOME: SavedAddress = {
  id: 'adr_home',
  formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
  addressLine: '412, 5th Block',
  locality: 'Koramangala',
  postalCode: '560095',
  isDefault: true,
  placeId: 'place_koramangala_5th',
  latitude: 12.9352,
  longitude: 77.6245,
};

const WORK: SavedAddress = {
  id: 'adr_work',
  formattedAddress: '17 Cross Lane, Devanahalli, Bengaluru 562110',
  isDefault: false,
};

const DRAFT: RequestDraft = {
  categoryId: CATEGORY_ID,
  subCategoryId: SUB_CATEGORY_ID,
  values: { priority: 'HIGH', preferredDate: '', preferredTime: '', notes: '' },
  imageUrls: [],
  address: null,
  vendor: NO_VENDOR_CHOICE,
};

let current: RequestDraft | null = null;

/** Seeds the draft the way the earlier steps would have, and watches it. */
function DraftProbe({ seed }: { seed: RequestDraft }) {
  const { startDraft, draft } = useRequestDraft();
  const seeded = React.useRef(false);

  if (!seeded.current) {
    seeded.current = true;
    startDraft(seed);
  }

  current = draft;
  return null;
}

/** A read the test answers when it chooses. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(settle => {
    resolve = settle;
  });
  return { promise, resolve };
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  current = null;
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

/**
 * The book, read-only. Every write throws, so a test passing proves this flow
 * never asked for one.
 */
function registerBook(list: () => Promise<SavedAddress[]>) {
  const listAddresses = jest.fn(list);
  const refuse = (name: string) =>
    jest.fn(() => {
      throw new Error(`${name} must not be called while choosing an address`);
    });

  registerService('addressBook', {
    listAddresses,
    createAddress: refuse('createAddress'),
    updateAddress: refuse('updateAddress'),
    deleteAddress: refuse('deleteAddress'),
    setDefaultAddress: refuse('setDefaultAddress'),
  } as AddressBookService);

  return listAddresses;
}

/** Where the device says it is, once a test lets it answer. */
const FROM_LOCATION: AddressSuggestion = {
  id: 'fix_1',
  label: 'Prestige Acropolis, 100 Feet Road',
  detail: 'Indiranagar, Bengaluru 560038',
  address: {
    formattedAddress: 'Prestige Acropolis, 100 Feet Road, Indiranagar, Bengaluru 560038',
    latitude: 12.9719,
    longitude: 77.6412,
  },
};

/**
 * What Service Address needs besides the book. Without `coordinates` the
 * location is refused; with them it is allowed and answers when they resolve.
 */
function registerAddressScreenServices(coordinates?: () => Promise<Coordinates>) {
  registerService('address', {
    searchAddresses: jest.fn(async () => []),
    describeCoordinates: jest.fn(async () => FROM_LOCATION),
  } as AddressService);
  registerService('location', {
    getCurrentCoordinates: jest.fn(coordinates ?? (async () => ({ latitude: 0, longitude: 0 }))),
  } as LocationService);
  const status = coordinates ? ('granted' as const) : ('denied' as const);
  registerService('permission', {
    check: jest.fn(async () => status),
    request: jest.fn(async () => status),
    openSettings: jest.fn(async () => undefined),
  } as PermissionService);
}

interface Options {
  seed?: RequestDraft;
  list?: () => Promise<SavedAddress[]>;
  /** Also mount Service Address, underneath, sharing the one draft. */
  withAddressScreen?: boolean;
  /** The device's position, for the location shortcut on Service Address. */
  coordinates?: () => Promise<Coordinates>;
}

async function render({
  seed = DRAFT,
  list = async () => [HOME, WORK],
  withAddressScreen = false,
  coordinates,
}: Options = {}) {
  const listAddresses = registerBook(list);
  registerAddressScreenServices(coordinates);

  const goBack = jest.fn();
  const pickerNavigation = { goBack, navigate: jest.fn() } as never;
  const pickerRoute = {
    key: 'ChooseSavedAddress',
    name: 'ChooseSavedAddress' as const,
    params: undefined,
  } as never;

  const addressNavigate = jest.fn();
  const addressNavigation = { navigate: addressNavigate, goBack: jest.fn() } as never;
  const addressRoute = {
    key: 'ServiceAddress',
    name: 'ServiceAddress' as const,
    params: { categoryId: CATEGORY_ID, subCategoryId: SUB_CATEGORY_ID },
  } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <RequestDraftProvider>
          <DraftProbe seed={seed} />
          {withAddressScreen ? (
            <ServiceAddressScreen navigation={addressNavigation} route={addressRoute} />
          ) : null}
          <ChooseSavedAddressScreen navigation={pickerNavigation} route={pickerRoute} />
        </RequestDraftProvider>
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  const hosts = (predicate: (props: Record<string, unknown>) => boolean) =>
    renderer.root.findAll(
      node => typeof node.type === 'string' && predicate(node.props as Record<string, unknown>),
    );

  /** A control by its spoken name, as the screen reader and the finger find it. */
  const control = (role: string, label: string) =>
    renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === role &&
        node.props?.accessibilityLabel === label &&
        typeof node.props?.onPress === 'function',
    )[0];

  return {
    renderer,
    goBack,
    addressNavigate,
    listAddresses,
    draft: () => current,
    byTestID: (id: string) => hosts(props => props.testID === id),
    text: () => textOf(renderer.toJSON()),
    list: () => hosts(props => props.testID === 'choose-saved-address-list')[0],
    /**
     * The testID of every native view on screen that says it is busy.
     *
     * Ids, not the nodes: a failed match on a test instance makes jest print it,
     * and printing one walks the whole fiber tree — the run never finishes.
     */
    busy: () =>
      hosts(props => (props.accessibilityState as { busy?: boolean } | undefined)?.busy === true).map(
        node => node.props.testID as string | undefined,
      ),
    option: (address: SavedAddress) =>
      renderer.root.findAll(
        node =>
          node.props?.testID === `saved-address-${address.id}` &&
          node.props?.accessibilityRole === 'radio' &&
          typeof node.props?.onPress === 'function',
      )[0],
    control,
    choose: async (address: SavedAddress) => {
      const [target] = renderer.root.findAll(
        node =>
          node.props?.testID === `saved-address-${address.id}` &&
          typeof node.props?.onPress === 'function' &&
          node.props?.accessibilityRole === 'radio',
      );
      await act(async () => {
        target.props.onPress();
      });
    },
    /** The address box on Service Address, as the customer sees it. */
    box: () =>
      renderer.root.findAll(
        node =>
          typeof node.type === 'string' &&
          node.props?.testID === 'service-address-input' &&
          typeof node.props?.onChangeText === 'function',
      )[0],
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

describe('ChooseSavedAddressScreen — what it shows', () => {
  it('lists the saved addresses in the service’s order, the default first', async () => {
    const { list, text } = await render();

    expect((list().props.data as SavedAddress[]).map(address => address.id)).toEqual([
      HOME.id,
      WORK.id,
    ]);
    expect(text()).toContain(HOME.formattedAddress);
    expect(text()).toContain(WORK.formattedAddress);
    expect(text()).toContain(COPY.title);
  });

  it('marks the default in words, to the eye and to a screen reader', async () => {
    const { option, byTestID } = await render();

    expect(byTestID(`saved-address-${HOME.id}-default`)).toHaveLength(1);
    expect(byTestID(`saved-address-${WORK.id}-default`)).toHaveLength(0);
    expect(option(HOME).props.accessibilityLabel).toBe(
      `${HOME.formattedAddress}. ${BOOK.defaultSpoken}`,
    );
    expect(option(WORK).props.accessibilityLabel).toBe(WORK.formattedAddress);
  });

  it('offers each as one choice that says what choosing it does', async () => {
    const { option } = await render();

    for (const address of [HOME, WORK]) {
      expect(option(address).props.accessibilityRole).toBe('radio');
      expect(option(address).props.accessibilityHint).toBe(COPY.optionHint);
    }
  });

  it('ticks the one the request already holds, and only that one', async () => {
    const { option } = await render({
      seed: { ...DRAFT, address: requestAddressFromSaved(WORK) },
    });

    expect(option(WORK).props.accessibilityState).toEqual({ selected: true, checked: true });
    expect(option(HOME).props.accessibilityState).toEqual({ selected: false, checked: false });
  });

  it('ticks nothing once the line it came from has been edited', async () => {
    const { option } = await render({
      seed: {
        ...DRAFT,
        address: { formattedAddress: `${WORK.formattedAddress}, the blue gate` },
      },
    });

    expect(option(WORK).props.accessibilityState.checked).toBe(false);
    expect(option(HOME).props.accessibilityState.checked).toBe(false);
  });
});

describe('ChooseSavedAddressScreen — choosing one', () => {
  it('copies it into the draft by value, and goes back', async () => {
    const { choose, draft, goBack } = await render();

    await choose(HOME);

    expect(draft()?.address).toEqual(requestAddressFromSaved(HOME));
    expect(JSON.stringify(draft())).not.toContain(HOME.id);
    expect(JSON.stringify(draft())).not.toContain('isDefault');
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('leaves the rest of the request alone', async () => {
    const { choose, draft } = await render();

    await choose(WORK);

    expect(draft()?.values).toEqual(DRAFT.values);
    expect(draft()?.vendor).toEqual(DRAFT.vendor);
    expect(draft()?.categoryId).toBe(CATEGORY_ID);
  });

  it('acts on the first tap only, so a second cannot pop the address screen too', async () => {
    const { option, goBack, draft } = await render();

    await act(async () => {
      option(WORK).props.onPress();
      option(HOME).props.onPress();
    });

    expect(goBack).toHaveBeenCalledTimes(1);
    expect(draft()?.address).toEqual(requestAddressFromSaved(WORK));
  });

  it('changes nothing in the book', async () => {
    // Every write on the stub throws; reaching here with a choice made is the proof.
    const { choose, listAddresses } = await render();

    await choose(HOME);

    expect(listAddresses).toHaveBeenCalledTimes(1);
  });
});

describe('ChooseSavedAddressScreen — while reading and when it cannot', () => {
  it('says the wait once, in one named and busy region, while the book is read', async () => {
    const read = deferred<SavedAddress[]>();
    const { list, byTestID, busy } = await render({ list: () => read.promise });

    const [region] = byTestID('choose-saved-address-loading');
    expect(region.props.accessibilityLabel).toBe(COPY.loadingLabel);
    expect(region.props.accessibilityState).toEqual({ busy: true });
    expect(busy()).toEqual(['choose-saved-address-loading']);
    expect(byTestID(`saved-address-${HOME.id}`)).toHaveLength(0);

    // The list itself is not a stop: it carries no name, role or state.
    expect(list().props.accessibilityLabel).toBeUndefined();
    expect(list().props.accessibilityState).toBeUndefined();
    expect(list().props.accessibilityRole).toBeUndefined();

    await act(async () => {
      read.resolve([HOME]);
    });
  });

  it('replaces the busy region once the book arrives, and leaves the list unnamed', async () => {
    // The list used to be named on every render — "Loading your saved
    // addresses", then "Your saved addresses" — so loaded, TalkBack stopped on
    // it to say what the heading had just said. Now the wait is its own region,
    // and it is gone, not updated, when the addresses arrive.
    const read = deferred<SavedAddress[]>();
    const { list, byTestID, busy } = await render({ list: () => read.promise });

    const [waiting] = byTestID('choose-saved-address-loading');
    expect(waiting.props.accessibilityState).toEqual({ busy: true });

    await act(async () => {
      read.resolve([HOME]);
    });

    expect(byTestID(`saved-address-${HOME.id}`).length).toBeGreaterThan(0);
    // Not hidden or emptied: no longer in the tree at all, so its busy cannot outlive it.
    expect(byTestID('choose-saved-address-loading')).toHaveLength(0);
    expect(list() === waiting).toBe(false);
    expect(list().props.accessibilityLabel).toBeUndefined();
    expect(list().props.accessibilityState).toBeUndefined();
    expect(list().props.accessibilityRole).toBeUndefined();
    // Nothing anywhere on the loaded screen still says busy.
    expect(busy()).toEqual([]);
  });

  it('shows the safe message with a retry that reads again, and keeps its heading', async () => {
    const failure = new AppError({ kind: 'network', message: 'ECONNREFUSED 10.0.2.2:8080' });
    let calls = 0;
    const { text, control, listAddresses, byTestID, draft, list, busy } = await render({
      list: async () => {
        calls += 1;
        if (calls === 1) {
          throw failure;
        }
        return [WORK];
      },
    });

    expect(byTestID('choose-saved-address-error')).toHaveLength(1);
    expect(text()).toContain(COPY.failedTitle);
    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain('ECONNREFUSED');
    // Its own words, under a list that is still no stop of its own.
    expect(byTestID('choose-saved-address-loading')).toHaveLength(0);
    expect(list().props.accessibilityLabel).toBeUndefined();
    expect(list().props.accessibilityState).toBeUndefined();
    expect(busy()).toEqual([]);
    expect(text()).toContain(COPY.title);
    expect(draft()?.address).toBeNull();

    await act(async () => {
      control('button', 'Try again').props.onPress();
    });

    expect(listAddresses).toHaveBeenCalledTimes(2);
    expect(text()).toContain(WORK.formattedAddress);
  });

  it('says so calmly when the book is empty', async () => {
    const { byTestID, text, list, busy } = await render({ list: async () => [] });

    expect(byTestID('choose-saved-address-empty')).toHaveLength(1);
    expect(text()).toContain(COPY.emptyTitle);
    // Its own words, under a list that is still no stop of its own.
    expect(byTestID('choose-saved-address-loading')).toHaveLength(0);
    expect(list().props.accessibilityLabel).toBeUndefined();
    expect(list().props.accessibilityState).toBeUndefined();
    expect(busy()).toEqual([]);
  });

  it('goes back the way it came', async () => {
    const { control, goBack } = await render();

    await act(async () => {
      control('button', COPY.back).props.onPress();
    });

    expect(goBack).toHaveBeenCalledTimes(1);
  });
});

/**
 * The two screens together, sharing one draft, as they do in the app: Service
 * Address stays mounted under the picker, and what the picker chooses is what
 * the address screen shows when the customer comes back to it.
 */
describe('ChooseSavedAddressScreen — back on Service Address', () => {
  it('fills the box and shows the chosen address as the answer', async () => {
    const { choose, box, byTestID, text } = await render({ withAddressScreen: true });
    expect(box().props.value).toBe('');

    await choose(HOME);

    expect(box().props.value).toBe(HOME.formattedAddress);
    expect(byTestID('service-address-selected')).toHaveLength(1);
    expect(text()).toContain(HOME.formattedAddress);
  });

  it('counts a hand-typed saved address as chosen too, so Continue moves on', async () => {
    const { choose, byTestID, control, addressNavigate, draft } = await render({
      withAddressScreen: true,
    });

    await choose(WORK);

    expect(byTestID('service-address-selected')).toHaveLength(1);
    await act(async () => {
      control('button', ADDRESS_COPY.submit).props.onPress();
    });

    expect(draft()?.address).toEqual({ formattedAddress: WORK.formattedAddress });
    expect(addressNavigate).toHaveBeenCalledWith('PreferredVendor', {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
    });
  });

  it('lets the customer edit it before continuing, as a picked suggestion', async () => {
    const { choose, box, draft } = await render({ withAddressScreen: true });

    await choose(HOME);
    await act(async () => {
      box().props.onChangeText(`${HOME.formattedAddress}, the blue gate`);
    });

    // The rewritten line is the truth now; the old point would put a
    // professional at the wrong door.
    expect(draft()?.address).toEqual({
      formattedAddress: `${HOME.formattedAddress}, the blue gate`,
    });
  });

  it('keeps the whole saved address while the box still reads as it was chosen', async () => {
    const { choose, box, draft } = await render({ withAddressScreen: true });

    await choose(HOME);
    // Typed away and back to the same words: the rich copy is still the answer.
    await act(async () => {
      box().props.onChangeText(`${HOME.formattedAddress} `);
    });

    expect(draft()?.address).toEqual(requestAddressFromSaved(HOME));
  });

  it('is not overwritten by a location that arrives after the choice', async () => {
    // Found in review: "Use my current location" pressed, a saved address
    // chosen before the device answered — and the late answer replaced the
    // choice in the box, in the draft, and in what Continue would send.
    let deliver!: (coordinates: Coordinates) => void;
    const late = new Promise<Coordinates>(resolve => {
      deliver = resolve;
    });
    const { choose, box, draft, control, text } = await render({
      withAddressScreen: true,
      coordinates: () => late,
    });

    await act(async () => {
      control('button', ADDRESS_COPY.useCurrentLocation).props.onPress();
    });
    await choose(WORK);
    await act(async () => {
      deliver({ latitude: 12.9719, longitude: 77.6412 });
    });
    await act(async () => {});

    expect(draft()?.address).toEqual(requestAddressFromSaved(WORK));
    expect(box().props.value).toBe(WORK.formattedAddress);
    expect(text()).not.toContain(FROM_LOCATION.address.formattedAddress);
    expect(text()).not.toContain(CUSTOMER_COPY.location.confirmPrompt);
  });

  it('still takes a location that arrived before anything was chosen', async () => {
    const { draft, control } = await render({
      withAddressScreen: true,
      coordinates: async () => ({ latitude: 12.9719, longitude: 77.6412 }),
    });

    await act(async () => {
      control('button', ADDRESS_COPY.useCurrentLocation).props.onPress();
    });
    await act(async () => {});

    expect(draft()?.address).toEqual(FROM_LOCATION.address);
  });
});
