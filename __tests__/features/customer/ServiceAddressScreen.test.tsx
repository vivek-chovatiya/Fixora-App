/**
 * The address step, where a required field meets an optional permission.
 *
 * Two rules carry this screen and both are tested here rather than described:
 * a service address is required, and device location is not. Every path that
 * could turn the second into the first — a refused dialog, a blocked one, a dead
 * radio, a gazetteer that has never heard of the customer's street — has to end
 * with somebody still able to type where they live and carry on.
 *
 * The other rule is that nothing this screen learns is applied behind the
 * customer's back. A coordinate turned into a street is a guess, so it is
 * proposed and confirmed, never silently submitted.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { NavigationContext } from '@react-navigation/native';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
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
import type {
  PermissionService,
  PermissionStatus,
} from '@/shared/services/types/PermissionService';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const COPY = CUSTOMER_COPY.serviceAddress;
const LOCATION_COPY = CUSTOMER_COPY.location;

const CATEGORY_ID = 'cat_electrical';
const SUB_CATEGORY_ID = 'sub_fan';

const KORAMANGALA: AddressSuggestion = {
  id: 'place_koramangala_5th',
  label: '412, 5th Block, Koramangala',
  detail: 'Koramangala, Bengaluru 560095',
  address: {
    formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
    latitude: 12.9352,
    longitude: 77.6245,
    placeId: 'place_koramangala_5th',
  },
};

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

/** Details answered, nothing else. What this screen is normally reached with. */
const DRAFT: RequestDraft = {
  categoryId: CATEGORY_ID,
  subCategoryId: SUB_CATEGORY_ID,
  values: { priority: 'HIGH', preferredDate: '', preferredTime: '', notes: '' },
  imageUrls: [],
  address: null,
  vendor: NO_VENDOR_CHOICE,
};

let current: RequestDraft | null = null;

/** Seeds the draft the way the details screen would have, and watches it. */
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

interface Stubs {
  seed?: RequestDraft;
  search?: (query: string) => Promise<AddressSuggestion[]>;
  describe?: (coordinates: Coordinates) => Promise<AddressSuggestion>;
  coordinates?: () => Promise<Coordinates>;
  check?: PermissionStatus;
  request?: PermissionStatus;
  /** The customer's saved addresses. None, unless a test says otherwise. */
  saved?: () => Promise<SavedAddress[]>;
  /**
   * Mount inside a navigation context whose focus the test drives, as a
   * navigator would. Without it there is none, as in every other test here.
   */
  focusable?: boolean;
}

/**
 * Just enough of a screen's navigation object for focus: whether it is focused,
 * and `focus` / `blur` listeners the test can fire, as the stack does when a
 * screen is pushed over this one and popped again.
 */
function focusableNavigation() {
  const listeners: Record<string, Array<() => void>> = { focus: [], blur: [] };
  let focused = true;

  return {
    context: {
      isFocused: () => focused,
      addListener: (event: string, listener: () => void) => {
        listeners[event] = [...(listeners[event] ?? []), listener];
        return () => {
          listeners[event] = listeners[event].filter(entry => entry !== listener);
        };
      },
    },
    /** Another screen pushed on top. */
    blur: () => {
      focused = false;
      listeners.blur.forEach(listener => listener());
    },
    /** Popped back to. */
    focus: () => {
      focused = true;
      listeners.focus.forEach(listener => listener());
    },
  };
}

async function render({
  seed = DRAFT,
  search,
  describe: describeStub,
  coordinates,
  check = 'denied',
  request = 'granted',
  saved,
  focusable = false,
}: Stubs = {}) {
  const searchAddresses = jest.fn(search ?? (async () => [KORAMANGALA]));
  const describeCoordinates = jest.fn(describeStub ?? (async () => FROM_LOCATION));

  registerService('address', { searchAddresses, describeCoordinates } as AddressService);

  // Read-only from here: every write throws, so no test can pass by changing
  // somebody's saved addresses from inside a request.
  const listAddresses = jest.fn(saved ?? (async () => []));
  const refuse = () =>
    jest.fn(() => {
      throw new Error('The address step must never change the address book');
    });
  registerService('addressBook', {
    listAddresses,
    createAddress: refuse(),
    updateAddress: refuse(),
    deleteAddress: refuse(),
    setDefaultAddress: refuse(),
  } as AddressBookService);

  const getCurrentCoordinates = jest.fn(
    coordinates ?? (async () => ({ latitude: 12.97, longitude: 77.59 })),
  );
  registerService('location', { getCurrentCoordinates } as LocationService);

  const checkPermission = jest.fn(async () => check);
  const requestPermission = jest.fn(async () => request);
  const openSettings = jest.fn(async () => undefined);
  registerService('permission', {
    check: checkPermission,
    request: requestPermission,
    openSettings,
  } as PermissionService);

  const navigate = jest.fn();
  const navigation = { navigate, goBack: jest.fn() } as never;
  const route = {
    key: 'ServiceAddress',
    name: 'ServiceAddress' as const,
    params: { categoryId: CATEGORY_ID, subCategoryId: SUB_CATEGORY_ID },
  } as never;

  const focus = focusableNavigation();
  const screen = <ServiceAddressScreen navigation={navigation} route={route} />;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <RequestDraftProvider>
          <DraftProbe seed={seed} />
          {focusable ? (
            <NavigationContext.Provider value={focus.context as never}>
              {screen}
            </NavigationContext.Provider>
          ) : (
            screen
          )}
        </RequestDraftProvider>
      </ThemeProvider>,
    );
  });

  mounted.push(renderer);

  const byTestID = (id: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id);

  return {
    renderer,
    navigate,
    listAddresses,
    /** Another screen pushed over this one, which stays mounted underneath. */
    coverUp: async () => {
      await act(async () => {
        focus.blur();
      });
    },
    /** Another screen pushed over this one, then popped: focus lost and regained. */
    comeBack: async () => {
      await act(async () => {
        focus.blur();
      });
      await act(async () => {
        focus.focus();
      });
    },
    searchAddresses,
    describeCoordinates,
    getCurrentCoordinates,
    checkPermission,
    requestPermission,
    openSettings,
    draft: () => current,
    byTestID,
    text: () => textOf(renderer.toJSON()),
    /** Types into the address box, then lets the debounce and the call settle. */
    type: async (value: string) => {
      const [field] = renderer.root.findAll(
        node => node.props?.testID === 'service-address-input' && node.props?.onChangeText,
      );
      await act(async () => {
        field.props.onChangeText(value);
      });
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      await act(async () => {});
    },
    press: async (label: string) => {
      const [target] = renderer.root.findAll(
        node =>
          (node.props?.accessibilityRole === 'button' ||
            node.props?.accessibilityRole === 'radio') &&
          node.props?.accessibilityLabel === label &&
          typeof node.props?.onPress === 'function',
      );
      if (!target) {
        throw new Error(`No control labelled "${label}"`);
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

beforeAll(() => {
  // The search is debounced, so a test that waited in real time would be a test
  // that waited. Time is advanced deliberately in `type`.
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

describe('ServiceAddressScreen — choosing an address', () => {
  it('starts with nothing chosen, and says so without scolding anybody', async () => {
    const { byTestID, draft, text } = await render();

    expect(draft()?.address).toBeNull();
    expect(byTestID('service-address-empty')).toHaveLength(1);
    expect(byTestID('service-address-required')).toHaveLength(0);
    expect(text()).toContain(COPY.emptyTitle);
  });

  it('does not ask the provider about one or two letters', async () => {
    const { type, searchAddresses } = await render();

    await type('Ko');

    // A geocoder is billed per call. A query nobody could answer is not sent.
    expect(searchAddresses).not.toHaveBeenCalled();
  });

  it('offers what the provider found, once there is enough to search on', async () => {
    const { type, byTestID, searchAddresses } = await render();

    await type('Koramangala');

    expect(searchAddresses).toHaveBeenCalledWith('Koramangala');
    expect(byTestID(`address-suggestion-${KORAMANGALA.id}`).length).toBeGreaterThan(0);
  });

  it('puts a chosen suggestion on the draft, whole', async () => {
    const { type, press, draft } = await render();

    await type('Koramangala');
    await press(`${KORAMANGALA.label}, ${KORAMANGALA.detail}`);

    // Coordinates and the provider's handle travel with it — the parts a
    // backend can act on and a typed line could never supply.
    expect(draft()?.address).toEqual(KORAMANGALA.address);
  });

  it('takes what the customer typed when no suggestion fits', async () => {
    const { type, press, draft, byTestID } = await render({ search: async () => [] });

    await type('17 Cross Lane, Devanahalli');

    expect(byTestID('service-address-no-results')).toHaveLength(1);
    await press(COPY.useTyped);

    // Asserted exactly: the app was told a line of text and claims nothing else.
    expect(draft()?.address).toEqual({ formattedAddress: '17 Cross Lane, Devanahalli' });
  });

  it('drops coordinates that no longer describe what is in the box', async () => {
    const { type, press, draft } = await render();

    await type('Koramangala');
    await press(`${KORAMANGALA.label}, ${KORAMANGALA.detail}`);
    await type('412, 5th Block, Koramangala — the blue gate');

    // Editing a resolved address makes the typed words the truth. Sending the
    // old point with the new text would put a professional on the wrong street.
    expect(draft()?.address).toEqual({
      formattedAddress: '412, 5th Block, Koramangala — the blue gate',
    });
  });

  it('un-answers the question when the box is emptied', async () => {
    const { type, press, draft } = await render();

    await type('Koramangala');
    await press(`${KORAMANGALA.label}, ${KORAMANGALA.detail}`);
    await type('');

    expect(draft()?.address).toBeNull();
  });
});

describe('ServiceAddressScreen — moving on', () => {
  it('will not continue with nothing chosen, and says what is missing', async () => {
    const { press, navigate, byTestID, text } = await render();

    await press(COPY.submit);

    expect(navigate).not.toHaveBeenCalled();
    expect(byTestID('service-address-required')).toHaveLength(1);
    expect(text()).toContain(COPY.required);
  });

  it('will not continue on something too short for anyone to find', async () => {
    const { type, press, navigate, text } = await render({ search: async () => [] });

    await type('Home');
    await press(COPY.submit);

    expect(navigate).not.toHaveBeenCalled();
    expect(text()).toContain(COPY.tooShort);
  });

  it('keeps the draft intact when it refuses to continue', async () => {
    const { press, draft } = await render();

    await press(COPY.submit);

    // Refusing to move on is not a reason to throw away the details behind it.
    expect(draft()?.values.priority).toBe('HIGH');
  });

  it('goes to the vendor step once there is somewhere to send one', async () => {
    const { type, press, navigate } = await render();

    await type('Koramangala');
    await press(`${KORAMANGALA.label}, ${KORAMANGALA.detail}`);
    await press(COPY.submit);

    expect(navigate).toHaveBeenCalledWith('PreferredVendor', {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
    });
  });

  it('opens on the address a resumed draft already carried', async () => {
    const { byTestID, text } = await render({
      seed: { ...DRAFT, address: KORAMANGALA.address },
    });

    expect(byTestID('service-address-selected')).toHaveLength(1);
    expect(text()).toContain(KORAMANGALA.address.formattedAddress);
  });
});

describe('ServiceAddressScreen — using the device location', () => {
  it('asks for permission the first time, through the shared abstraction', async () => {
    const { press, checkPermission, requestPermission } = await render({
      check: 'denied',
      request: 'granted',
    });

    await press(COPY.useCurrentLocation);

    // One permission system in the application, and this reuses it rather than
    // reaching for a platform API of its own.
    expect(checkPermission).toHaveBeenCalledWith('location');
    expect(requestPermission).toHaveBeenCalledWith('location');
  });

  it('reads a position and resolves it to an address once allowed', async () => {
    const { press, getCurrentCoordinates, describeCoordinates, draft } = await render({
      check: 'granted',
    });

    await press(COPY.useCurrentLocation);

    expect(getCurrentCoordinates).toHaveBeenCalled();
    expect(describeCoordinates).toHaveBeenCalledWith({ latitude: 12.97, longitude: 77.59 });
    expect(draft()?.address).toEqual(FROM_LOCATION.address);
  });

  it('shows the resolved address and asks the customer to check it', async () => {
    const { press, text, navigate } = await render({ check: 'granted' });

    await press(COPY.useCurrentLocation);

    // Proposed, never applied and submitted. Turning a point into a street is a
    // guess, and only the customer can say whether it is their street.
    expect(text()).toContain(FROM_LOCATION.address.formattedAddress);
    expect(text()).toContain(LOCATION_COPY.confirmPrompt);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('lets the customer edit what the device suggested', async () => {
    const { press, type, draft } = await render({ check: 'granted' });

    await press(COPY.useCurrentLocation);
    await type('Flat 3, Prestige Acropolis, Indiranagar');

    expect(draft()?.address).toEqual({
      formattedAddress: 'Flat 3, Prestige Acropolis, Indiranagar',
    });
  });

  it('does not ask again once the permission has been refused for good', async () => {
    const { press, requestPermission, text } = await render({ check: 'blocked' });

    await press(COPY.useCurrentLocation);

    // `request` on a blocked permission shows no dialog and returns the standing
    // answer, so asking is noise — and a button that visibly does nothing.
    expect(requestPermission).not.toHaveBeenCalled();
    expect(text()).toContain(LOCATION_COPY.denied);
  });
});

describe('ServiceAddressScreen — location is never a requirement', () => {
  it('offers Settings only when Settings is the way out', async () => {
    const blocked = await render({ check: 'blocked' });
    await blocked.press(COPY.useCurrentLocation);
    expect(blocked.text()).toContain(LOCATION_COPY.openSettings);

    const refused = await render({ check: 'denied', request: 'denied' });
    await refused.press(COPY.useCurrentLocation);
    expect(refused.text()).not.toContain(LOCATION_COPY.openSettings);
  });

  it('leaves typing available when permission is refused', async () => {
    const { press, type, draft, navigate, text } = await render({
      check: 'denied',
      request: 'denied',
    });

    await press(COPY.useCurrentLocation);
    expect(text()).toContain(LOCATION_COPY.denied);

    await type('Koramangala');
    await press(`${KORAMANGALA.label}, ${KORAMANGALA.detail}`);
    await press(COPY.submit);

    // The product rule: a refused permission must never be able to stop a
    // request. Nothing about this path differs from never having asked.
    expect(draft()?.address).toEqual(KORAMANGALA.address);
    expect(navigate).toHaveBeenCalledWith('PreferredVendor', expect.anything());
  });

  it('leaves typing available when permission is blocked', async () => {
    const { press, type, navigate } = await render({ check: 'blocked' });

    await press(COPY.useCurrentLocation);
    await type('Koramangala');
    await press(`${KORAMANGALA.label}, ${KORAMANGALA.detail}`);
    await press(COPY.submit);

    expect(navigate).toHaveBeenCalledWith('PreferredVendor', expect.anything());
  });

  it('survives a device that cannot produce a fix, and says only what is safe', async () => {
    const { press, text, draft } = await render({
      check: 'granted',
      coordinates: async () => {
        throw new AppError({
          kind: 'unknown',
          message: 'PositionError: timeout expired after 15000ms',
          userMessage: 'Something went wrong.',
        });
      },
    });

    await press(COPY.useCurrentLocation);

    expect(text()).toContain(LOCATION_COPY.unavailable);
    expect(text()).not.toContain('PositionError');
    expect(text()).not.toContain('15000');
    expect(draft()?.address).toBeNull();
  });

  it('tells a failed fix apart from a fix nothing could be made of', async () => {
    const { press, text } = await render({
      check: 'granted',
      describe: async () => {
        throw new AppError({ kind: 'notFound', message: 'no candidates' });
      },
    });

    await press(COPY.useCurrentLocation);

    // The device worked and the gazetteer did not. Saying "we could not get
    // your location" would send somebody to check their GPS settings for
    // nothing.
    expect(text()).toContain(LOCATION_COPY.unresolved);
    expect(text()).not.toContain(LOCATION_COPY.unavailable);
  });

  it('carries on manually after the location has failed', async () => {
    const { press, type, navigate } = await render({
      check: 'granted',
      coordinates: async () => {
        throw new AppError({ kind: 'unknown', message: 'no radio' });
      },
    });

    await press(COPY.useCurrentLocation);
    await type('Koramangala');
    await press(`${KORAMANGALA.label}, ${KORAMANGALA.detail}`);
    await press(COPY.submit);

    expect(navigate).toHaveBeenCalledWith('PreferredVendor', expect.anything());
  });
});

describe('ServiceAddressScreen — when the provider misbehaves', () => {
  it('shows a safe sentence and never the provider its own message', async () => {
    const { type, text } = await render({
      search: async () => {
        throw new AppError({
          kind: 'unknown',
          message: 'HTTP 429 quota exceeded for key AIzaSyBROKEN',
          userMessage: 'Something went wrong.',
        });
      },
    });

    await type('Koramangala');

    expect(text()).toContain(COPY.searchErrorFallback);
    expect(text()).not.toContain('429');
    expect(text()).not.toContain('AIzaSyBROKEN');
  });

  it('still lets the request be finished by hand', async () => {
    const { type, press, navigate, draft } = await render({
      search: async () => {
        throw new AppError({ kind: 'network', message: 'socket hang up' });
      },
    });

    await type('27, 11th Main, Jayanagar 4th Block');
    await press(COPY.submit);

    // A broken geocoder must not be able to stop somebody booking a plumber.
    expect(draft()?.address).toEqual({
      formattedAddress: '27, 11th Main, Jayanagar 4th Block',
    });
    expect(navigate).toHaveBeenCalledWith('PreferredVendor', expect.anything());
  });

  it('does not crash the flow when the draft cannot be written down', async () => {
    setRequestDraftStorage({
      read: async () => {
        throw new Error('storage unavailable');
      },
      write: async () => {
        throw new Error('disk full');
      },
      clear: async () => {
        throw new Error('storage unavailable');
      },
    });

    const { type, press, navigate } = await render();

    await type('Koramangala');
    await press(`${KORAMANGALA.label}, ${KORAMANGALA.detail}`);
    await press(COPY.submit);

    // Losing the ability to resume later is worth far less than stopping
    // somebody mid-request to tell them about it.
    expect(navigate).toHaveBeenCalledWith('PreferredVendor', expect.anything());
  });
});

/**
 * The saved addresses, offered as a shortcut — and only ever as one. Typing must
 * work exactly as before whatever the book does: still being read, failing, or
 * empty, there is simply no offer.
 */
describe('ServiceAddressScreen — saved addresses', () => {
  const SAVED: SavedAddress = {
    id: 'adr_home',
    formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
    isDefault: true,
  };

  /** The control by its spoken name, if it is on screen. */
  const offer = (renderer: ReactTestRenderer.ReactTestRenderer) =>
    renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === COPY.useSaved &&
        typeof node.props?.onPress === 'function',
    );

  it('offers them to a customer who has some, and opens the picker', async () => {
    const { renderer, press, navigate, listAddresses } = await render({
      saved: async () => [SAVED],
    });

    expect(listAddresses).toHaveBeenCalledTimes(1);
    expect(offer(renderer)).toHaveLength(1);
    expect(offer(renderer)[0].props.accessibilityHint).toBe(COPY.useSavedHint);

    await press(COPY.useSaved);

    // No address and no id in the route: the choice comes back through the draft.
    expect(navigate).toHaveBeenCalledWith('ChooseSavedAddress');
    expect(navigate.mock.calls[0]).toHaveLength(1);
  });

  it('offers nothing to a customer with none', async () => {
    const { renderer } = await render({ saved: async () => [] });

    expect(offer(renderer)).toHaveLength(0);
  });

  it('offers nothing while the book is still being read', async () => {
    const { renderer } = await render({ saved: () => new Promise<SavedAddress[]>(() => {}) });

    expect(offer(renderer)).toHaveLength(0);
  });

  it('offers nothing when the book cannot be read, and says nothing about it', async () => {
    const { renderer, text } = await render({
      saved: async () => {
        throw new AppError({ kind: 'network', message: 'ECONNREFUSED 10.0.2.2:8080' });
      },
    });

    expect(offer(renderer)).toHaveLength(0);
    expect(text()).not.toContain('ECONNREFUSED');
    expect(text()).not.toContain(CUSTOMER_COPY.chooseSavedAddress.failedTitle);
  });

  it('never blocks typing an address when the book cannot be read', async () => {
    const { type, press, navigate, draft } = await render({
      saved: async () => {
        throw new AppError({ kind: 'server', message: 'HTTP 500' });
      },
    });

    await type('Koramangala');
    await press(`${KORAMANGALA.label}, ${KORAMANGALA.detail}`);
    await press(COPY.submit);

    expect(draft()?.address).toEqual(KORAMANGALA.address);
    expect(navigate).toHaveBeenCalledWith('PreferredVendor', expect.anything());
  });

  it('keeps the other shortcut and the box whatever the book says', async () => {
    const { renderer, byTestID } = await render({ saved: async () => [SAVED] });

    expect(byTestID('service-address-input').length).toBeGreaterThan(0);
    expect(
      renderer.root.findAll(
        node =>
          node.props?.accessibilityRole === 'button' &&
          node.props?.accessibilityLabel === COPY.useCurrentLocation &&
          typeof node.props?.onPress === 'function',
      ),
    ).toHaveLength(1);
  });

  it('sits below the location shortcut, so arriving late moves nothing under a finger', async () => {
    const { renderer } = await render({ saved: async () => [SAVED] });

    // Document order of the two shortcuts' pressable nodes.
    const order = renderer.root
      .findAll(
        node =>
          node.props?.accessibilityRole === 'button' &&
          typeof node.props?.onPress === 'function' &&
          (node.props?.accessibilityLabel === COPY.useCurrentLocation ||
            node.props?.accessibilityLabel === COPY.useSaved),
      )
      .map(node => node.props.accessibilityLabel as string);

    expect([...new Set(order)]).toEqual([COPY.useCurrentLocation, COPY.useSaved]);
  });
});

/**
 * Found in review: Service Address stays mounted under the screens after it,
 * so a first read of the book that failed used to hide the offer for the rest
 * of the visit. It reads again each time the screen comes back into focus.
 */
describe('ServiceAddressScreen — saved addresses, read again on return', () => {
  const SAVED: SavedAddress = {
    id: 'adr_home',
    formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
    isDefault: true,
  };

  const offered = (renderer: ReactTestRenderer.ReactTestRenderer) =>
    renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === COPY.useSaved &&
        typeof node.props?.onPress === 'function',
    ).length > 0;

  it('offers them once a read on return succeeds after the first one failed', async () => {
    let calls = 0;
    const { renderer, comeBack, listAddresses } = await render({
      focusable: true,
      saved: async () => {
        calls += 1;
        if (calls === 1) {
          throw new AppError({ kind: 'network', message: 'ECONNREFUSED 10.0.2.2:8080' });
        }
        return [SAVED];
      },
    });

    expect(offered(renderer)).toBe(false);

    await comeBack();

    expect(listAddresses).toHaveBeenCalledTimes(2);
    expect(offered(renderer)).toBe(true);
  });

  it('does not read twice on arrival, only on a return', async () => {
    const { listAddresses } = await render({ focusable: true, saved: async () => [SAVED] });

    expect(listAddresses).toHaveBeenCalledTimes(1);
  });

  it('keeps the offer on screen while it reads again, and if that read fails', async () => {
    let calls = 0;
    let release!: (list: SavedAddress[]) => void;
    const { renderer, comeBack } = await render({
      focusable: true,
      saved: () => {
        calls += 1;
        if (calls === 1) {
          return Promise.resolve([SAVED]);
        }
        if (calls === 2) {
          return new Promise<SavedAddress[]>(resolve => {
            release = resolve;
          });
        }
        return Promise.reject(new AppError({ kind: 'network', message: 'offline' }));
      },
    });
    expect(offered(renderer)).toBe(true);

    // In flight: a refresh, not a first load, so the button does not blink out.
    await comeBack();
    expect(offered(renderer)).toBe(true);
    await act(async () => {
      release([SAVED]);
    });

    // A re-read that fails keeps the list it had.
    await comeBack();
    expect(offered(renderer)).toBe(true);
  });
});

/**
 * Found in review: the device's location can take seconds, and the screen
 * stays usable while it looks. An answer that arrives after the customer has
 * answered another way — typed, picked a suggestion, gone to their saved
 * addresses — must not overwrite them.
 */
describe('ServiceAddressScreen — a location that arrives late', () => {
  /** A fix the test hands over when it chooses. */
  function lateFix() {
    let deliver!: (coordinates: Coordinates) => void;
    const promise = new Promise<Coordinates>(resolve => {
      deliver = resolve;
    });
    return { coordinates: () => promise, deliver };
  }

  const arrive = async (fix: ReturnType<typeof lateFix>) => {
    await act(async () => {
      fix.deliver({ latitude: 12.97, longitude: 77.59 });
    });
    await act(async () => {});
  };

  it('is dropped when the customer typed while it was being looked for', async () => {
    const fix = lateFix();
    const { press, type, draft, text, renderer } = await render({
      check: 'granted',
      coordinates: fix.coordinates,
    });

    await press(COPY.useCurrentLocation);
    await type('27, 11th Main, Jayanagar 4th Block');
    await arrive(fix);

    expect(draft()?.address).toEqual({ formattedAddress: '27, 11th Main, Jayanagar 4th Block' });
    const [box] = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props?.testID === 'service-address-input' &&
        typeof node.props?.onChangeText === 'function',
    );
    expect(box.props.value).toBe('27, 11th Main, Jayanagar 4th Block');
    expect(text()).not.toContain(FROM_LOCATION.address.formattedAddress);
    // Nothing to check: the address it would ask about is not on screen.
    expect(text()).not.toContain(LOCATION_COPY.confirmPrompt);
  });

  it('is dropped when the customer picked a suggestion while it was being looked for', async () => {
    const fix = lateFix();
    const { press, type, draft } = await render({
      check: 'granted',
      coordinates: fix.coordinates,
    });

    // Typed first, so the pick is the only thing that happens after asking.
    await type('Koramangala');
    await press(COPY.useCurrentLocation);
    await press(`${KORAMANGALA.label}, ${KORAMANGALA.detail}`);
    await arrive(fix);

    expect(draft()?.address).toEqual(KORAMANGALA.address);
  });

  it('is dropped when the customer took what they typed while it was being looked for', async () => {
    const fix = lateFix();
    const { press, type, draft } = await render({
      check: 'granted',
      coordinates: fix.coordinates,
      search: async () => [],
    });

    await type('17 Cross Lane, Devanahalli');
    await press(COPY.useCurrentLocation);
    await press(COPY.useTyped);
    await arrive(fix);

    expect(draft()?.address).toEqual({ formattedAddress: '17 Cross Lane, Devanahalli' });
  });

  it('is dropped when the customer cleared the address while it was being looked for', async () => {
    const fix = lateFix();
    const { press, type, draft } = await render({
      check: 'granted',
      coordinates: fix.coordinates,
    });

    await type('Koramangala');
    await press(`${KORAMANGALA.label}, ${KORAMANGALA.detail}`);
    await press(COPY.useCurrentLocation);
    await press(COPY.change);
    await arrive(fix);

    // Clearing is an answer too: "not this one", not "whatever the device says".
    expect(draft()?.address).toBeNull();
  });

  it('is dropped when the customer went to their saved addresses meanwhile', async () => {
    const fix = lateFix();
    const { press, draft, text, navigate } = await render({
      check: 'granted',
      coordinates: fix.coordinates,
      saved: async () => [
        { id: 'adr_home', formattedAddress: '17 Cross Lane, Devanahalli', isDefault: true },
      ],
    });

    await press(COPY.useCurrentLocation);
    await press(COPY.useSaved);
    expect(navigate).toHaveBeenCalledWith('ChooseSavedAddress');
    // It lands while the picker is on top: not dropped into the box beneath it.
    await arrive(fix);

    expect(draft()?.address).toBeNull();
    expect(text()).not.toContain(FROM_LOCATION.address.formattedAddress);
    expect(text()).not.toContain(LOCATION_COPY.confirmPrompt);
  });

  it('is dropped when the customer continued while it was being looked for', async () => {
    // Found in review: this screen stays mounted under Preferred Vendor, and a
    // late answer silently became the address Submit would send.
    const fix = lateFix();
    const { press, draft, text, navigate } = await render({
      seed: { ...DRAFT, address: KORAMANGALA.address },
      check: 'granted',
      coordinates: fix.coordinates,
    });

    await press(COPY.useCurrentLocation);
    await press(COPY.submit);
    expect(navigate).toHaveBeenCalledWith('PreferredVendor', {
      categoryId: CATEGORY_ID,
      subCategoryId: SUB_CATEGORY_ID,
    });
    await arrive(fix);

    expect(draft()?.address).toEqual(KORAMANGALA.address);
    expect(text()).not.toContain(FROM_LOCATION.address.formattedAddress);
    expect(text()).not.toContain(LOCATION_COPY.confirmPrompt);
  });

  it('is dropped when another screen was pushed over this one meanwhile', async () => {
    const fix = lateFix();
    const { press, draft, text, coverUp } = await render({
      seed: { ...DRAFT, address: KORAMANGALA.address },
      check: 'granted',
      coordinates: fix.coordinates,
      focusable: true,
    });

    await press(COPY.useCurrentLocation);
    // Left by some way other than Continue: still left.
    await coverUp();
    await arrive(fix);

    expect(draft()?.address).toEqual(KORAMANGALA.address);
    expect(text()).not.toContain(LOCATION_COPY.confirmPrompt);
  });

  it('is still taken by a screen that never lost focus', async () => {
    const fix = lateFix();
    const { press, draft } = await render({
      check: 'granted',
      coordinates: fix.coordinates,
      focusable: true,
    });

    await press(COPY.useCurrentLocation);
    await arrive(fix);

    // The blur listener is not a lock: nothing left, so the answer stands.
    expect(draft()?.address).toEqual(FROM_LOCATION.address);
  });

  it('is still taken when nothing overtook it, even after a second tap', async () => {
    const fix = lateFix();
    const { renderer, draft, text } = await render({
      check: 'granted',
      coordinates: fix.coordinates,
    });

    // Two taps in one frame: the hook ignores the second, and it must not
    // orphan the answer to the first.
    const [locate] = renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === COPY.useCurrentLocation &&
        typeof node.props?.onPress === 'function',
    );
    await act(async () => {
      locate.props.onPress();
      locate.props.onPress();
    });
    await arrive(fix);

    expect(draft()?.address).toEqual(FROM_LOCATION.address);
    expect(text()).toContain(LOCATION_COPY.confirmPrompt);
  });
});
