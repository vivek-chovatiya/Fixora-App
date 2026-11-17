/**
 * The address book screens (PROJECT_BIBLE.md section 18, Phase 3D-9).
 *
 * Pinned here:
 *
 * - loading, empty, populated and failed states, and retry
 * - the default said in words, not colour, and announced with the address
 * - every action named for the address it acts on
 * - delete asks first, naming the address; Cancel keeps it
 * - set-default and delete run one at a time, change nothing until the service
 *   answers, and a failure leaves the list on screen
 * - add and edit reuse the gazetteer, keep what a suggestion knew, and keep what
 *   was typed when saving fails
 * - no labels, no map, no request-flow wiring
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { EditAddressScreen } from '@/features/customer/screens/EditAddressScreen';
import { ManageAddressesScreen } from '@/features/customer/screens/ManageAddressesScreen';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type {
  AddressBookService,
  SavedAddress,
  SavedAddressInput,
} from '@/shared/services/types/AddressBookService';
import type { AddressService, AddressSuggestion } from '@/shared/services/types/AddressService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const COPY = CUSTOMER_COPY.addressBook;

const HOME: SavedAddress = {
  id: 'addr_1',
  formattedAddress: '412, 5th Block, Koramangala, Bengaluru 560095',
  isDefault: true,
};

const WORK: SavedAddress = {
  id: 'addr_2',
  formattedAddress: '9, Sector 2, HSR Layout, Bengaluru 560102',
  isDefault: false,
};

const SUGGESTION: AddressSuggestion = {
  id: 'place_indiranagar',
  label: '17 MG Road',
  detail: 'Indiranagar, Bengaluru 560038',
  address: {
    formattedAddress: '17 MG Road, Indiranagar, Bengaluru 560038',
    addressLine: '17 MG Road',
    locality: 'Indiranagar',
    postalCode: '560038',
    placeId: 'place_indiranagar',
    latitude: 12.9784,
    longitude: 77.6408,
  },
};

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

type Book = jest.Mocked<AddressBookService>;

function registerBook(overrides: Partial<Book> = {}, initial: SavedAddress[] = [HOME, WORK]): Book {
  const book = {
    listAddresses: jest.fn(async () => initial),
    createAddress: jest.fn(async (input: SavedAddressInput) => [
      ...initial,
      { ...input, id: 'addr_new', isDefault: initial.length === 0 },
    ]),
    updateAddress: jest.fn(async (id: string, input: SavedAddressInput) =>
      initial.map(address => (address.id === id ? { ...address, ...input } : address)),
    ),
    deleteAddress: jest.fn(async (id: string) => initial.filter(address => address.id !== id)),
    setDefaultAddress: jest.fn(async (id: string) =>
      initial.map(address => ({ ...address, isDefault: address.id === id })),
    ),
    ...overrides,
  } as Book;
  registerService('addressBook', book);
  return book;
}

function registerGazetteer(suggestions: AddressSuggestion[] = [SUGGESTION]) {
  registerService('address', {
    searchAddresses: jest.fn(async () => suggestions),
    describeCoordinates: jest.fn(),
  } as unknown as AddressService);
}

function harness(renderer: ReactTestRenderer.ReactTestRenderer) {
  const byTestID = (id: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id);

  const button = (label: string) =>
    renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === label &&
        typeof node.props?.onPress === 'function',
    );

  const press = async (target: ReactTestRenderer.ReactTestInstance | undefined) => {
    if (!target) {
      throw new Error('Nothing to press');
    }
    await act(async () => {
      target.props.onPress();
    });
    await act(async () => {});
  };

  return { byTestID, button, press, text: () => textOf(renderer.toJSON()) };
}

async function renderList() {
  const navigate = jest.fn();
  const navigation = {
    navigate,
    goBack: jest.fn(),
    addListener: () => () => undefined,
  } as never;
  const route = { key: 'Addresses', name: 'Addresses' as const } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <NavigationContainer>
          <ManageAddressesScreen navigation={navigation} route={route} />
        </NavigationContainer>
      </ThemeProvider>,
    );
  });
  await act(async () => {});

  return { renderer, navigate, ...harness(renderer) };
}

afterEach(() => {
  resetServices();
});

describe('ManageAddressesScreen — states', () => {
  it('says it is loading while the first read is in flight', async () => {
    let release!: (list: SavedAddress[]) => void;
    registerBook({
      listAddresses: jest.fn(
        () =>
          new Promise<SavedAddress[]>(resolve => {
            release = resolve;
          }),
      ),
    });

    const { byTestID } = await renderList();

    expect(byTestID('addresses-loading').length).toBeGreaterThan(0);
    await act(async () => {
      release([]);
    });
  });

  it('shows the empty state with Add Address when there are none', async () => {
    registerBook({}, []);

    const { byTestID, button, text } = await renderList();

    expect(byTestID('addresses-empty').length).toBeGreaterThan(0);
    expect(text()).toContain(COPY.emptyTitle);
    expect(button(COPY.add).length).toBeGreaterThan(0);
  });

  it('promises nothing it cannot do — no map, GPS, labels or default in the empty state', async () => {
    registerBook({}, []);

    const { text } = await renderList();

    expect(text()).not.toMatch(/map|gps|location|label|home|office|default/i);
  });

  it('lists the addresses', async () => {
    registerBook();

    const { text } = await renderList();

    expect(text()).toContain(HOME.formattedAddress);
    expect(text()).toContain(WORK.formattedAddress);
  });

  it('reads the list once on the way in, not twice', async () => {
    const book = registerBook();

    await renderList();

    expect(book.listAddresses).toHaveBeenCalledTimes(1);
  });

  it('replaces the page with a retry when the list cannot be read', async () => {
    const book = registerBook({
      listAddresses: jest
        .fn()
        .mockRejectedValueOnce(new AppError({ kind: 'server', message: 'Mock list failed' }))
        .mockResolvedValue([HOME]),
    });

    const { byTestID, button, press, text } = await renderList();

    expect(byTestID('addresses-error').length).toBeGreaterThan(0);
    expect(text()).not.toContain('Mock list failed');

    await press(button('Try again')[0]);

    expect(book.listAddresses).toHaveBeenCalledTimes(2);
    expect(text()).toContain(HOME.formattedAddress);
  });
});

describe('ManageAddressesScreen — what each card says', () => {
  it('marks the default in words, and only the default', async () => {
    registerBook();

    const { text } = await renderList();

    expect(text().match(new RegExp(COPY.defaultBadge, 'g'))).toHaveLength(1);
  });

  it('announces the default with the address', async () => {
    registerBook();

    const { byTestID } = await renderList();

    expect(byTestID(`address-${HOME.id}-text`)[0]?.props.accessibilityLabel).toBe(
      `${HOME.formattedAddress}. ${COPY.defaultSpoken}`,
    );
    expect(byTestID(`address-${WORK.id}-text`)[0]?.props.accessibilityLabel).toBe(
      WORK.formattedAddress,
    );
  });

  it('names every action for the address it acts on', async () => {
    registerBook();

    const { button } = await renderList();

    expect(button(`${COPY.editHint}: ${WORK.formattedAddress}`)).toHaveLength(1);
    expect(button(`${COPY.removeHint}: ${WORK.formattedAddress}`)).toHaveLength(1);
    expect(button(`${COPY.setDefault}: ${WORK.formattedAddress}`)).toHaveLength(1);
  });

  it('does not offer Set as default on the address that already is', async () => {
    registerBook();

    const { button } = await renderList();

    expect(button(`${COPY.setDefault}: ${HOME.formattedAddress}`)).toHaveLength(0);
  });

  it('has no label row — labels are Phase 2', async () => {
    registerBook();

    const { text } = await renderList();

    expect(text()).not.toMatch(/\b(home|office|work|other)\b/i);
  });
});

describe('ManageAddressesScreen — deleting', () => {
  it('asks first, naming the address being removed', async () => {
    const book = registerBook();
    const { button, press, text } = await renderList();

    await press(button(`${COPY.removeHint}: ${WORK.formattedAddress}`)[0]);

    expect(text()).toContain(COPY.removeTitle);
    expect(text()).toContain(`${COPY.removeMessage} ${WORK.formattedAddress}.`);
    expect(book.deleteAddress).not.toHaveBeenCalled();
  });

  it('keeps the address on Cancel', async () => {
    const book = registerBook();
    const { button, press, byTestID, text } = await renderList();
    await press(button(`${COPY.removeHint}: ${WORK.formattedAddress}`)[0]);

    const cancel = byTestID('addresses-remove-dialog')[0]?.findAll(
      node =>
        node.props?.accessibilityLabel === COPY.removeCancel &&
        typeof node.props?.onPress === 'function',
    )[0];
    await press(cancel);

    expect(book.deleteAddress).not.toHaveBeenCalled();
    expect(text()).toContain(WORK.formattedAddress);
  });

  it('deletes on confirm and draws the list the service returned', async () => {
    const book = registerBook();
    const { button, press, byTestID, text } = await renderList();
    await press(button(`${COPY.removeHint}: ${WORK.formattedAddress}`)[0]);

    const confirm = byTestID('addresses-remove-dialog')[0]?.findAll(
      node =>
        node.props?.accessibilityLabel === COPY.removeConfirm &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    )[0];
    await press(confirm);

    expect(book.deleteAddress).toHaveBeenCalledWith(WORK.id);
    expect(text()).not.toContain(WORK.formattedAddress);
  });

  it('leaves the list on screen when deleting fails, and says so safely', async () => {
    registerBook({
      deleteAddress: jest.fn(async (_id: string): Promise<SavedAddress[]> => {
        throw new AppError({ kind: 'server', message: 'Mock delete refused' });
      }),
    });
    const { button, press, byTestID, text } = await renderList();
    await press(button(`${COPY.removeHint}: ${WORK.formattedAddress}`)[0]);

    const confirm = byTestID('addresses-remove-dialog')[0]?.findAll(
      node =>
        node.props?.accessibilityLabel === COPY.removeConfirm &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    )[0];
    await press(confirm);

    expect(text()).toContain(WORK.formattedAddress);
    expect(text()).toContain(COPY.changeFailedTitle);
    expect(text()).not.toContain('Mock delete refused');
  });
});

describe('ManageAddressesScreen — setting the default', () => {
  it('asks the service and draws what it returned', async () => {
    const book = registerBook();
    const { button, press, byTestID } = await renderList();

    await press(button(`${COPY.setDefault}: ${WORK.formattedAddress}`)[0]);

    expect(book.setDefaultAddress).toHaveBeenCalledWith(WORK.id);
    expect(byTestID(`address-${WORK.id}-text`)[0]?.props.accessibilityLabel).toContain(
      COPY.defaultSpoken,
    );
  });

  it('claims nothing before the service answers, and runs one change at a time', async () => {
    let release!: (list: SavedAddress[]) => void;
    const book = registerBook({
      setDefaultAddress: jest.fn(
        (_id: string) =>
          new Promise<SavedAddress[]>(resolve => {
            release = resolve;
          }),
      ),
    });
    const { button, press, byTestID } = await renderList();

    await press(button(`${COPY.setDefault}: ${WORK.formattedAddress}`)[0]);

    // Still running: the old default is still the default on screen.
    expect(byTestID(`address-${HOME.id}-text`)[0]?.props.accessibilityLabel).toContain(
      COPY.defaultSpoken,
    );
    // Every action is refused while it runs.
    expect(
      button(`${COPY.removeHint}: ${HOME.formattedAddress}`)[0]?.props.accessibilityState,
    ).toMatchObject({ disabled: true });

    await press(button(`${COPY.setDefault}: ${WORK.formattedAddress}`)[0]);
    await act(async () => {
      release([
        { ...HOME, isDefault: false },
        { ...WORK, isDefault: true },
      ]);
    });

    expect(book.setDefaultAddress).toHaveBeenCalledTimes(1);
  });
});

describe('ManageAddressesScreen — getting to the form', () => {
  it('opens Add with no id, and Edit with the address’s id', async () => {
    registerBook();
    const { button, press, navigate } = await renderList();

    await press(button(COPY.add)[0]);
    expect(navigate).toHaveBeenLastCalledWith('EditAddress', {});

    await press(button(`${COPY.editHint}: ${WORK.formattedAddress}`)[0]);
    expect(navigate).toHaveBeenLastCalledWith('EditAddress', { addressId: WORK.id });
  });
});

/* ------------------------------------------------------------------ */

async function renderForm(addressId?: string) {
  const goBack = jest.fn();
  const navigation = {
    goBack,
    dispatch: jest.fn(),
    addListener: () => () => undefined,
  } as never;
  const route = {
    key: 'EditAddress',
    name: 'EditAddress' as const,
    params: addressId ? { addressId } : {},
  } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <EditAddressScreen navigation={navigation} route={route} />
      </ThemeProvider>,
    );
  });
  await act(async () => {});

  const field = () =>
    renderer.root.findAll(
      node =>
        node.props?.testID === 'edit-address-input' && typeof node.props?.onChangeText === 'function',
    )[0];

  const type = async (value: string) => {
    await act(async () => {
      field().props.onChangeText(value);
    });
    // Let the debounced search resolve.
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    await act(async () => {});
  };

  const h = harness(renderer);
  return {
    renderer,
    goBack,
    field,
    type,
    ...h,
    save: async () => h.press([...h.button(COPY.save), ...h.button(COPY.saving)][0]),
  };
}

describe('EditAddressScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves a typed address as exactly what was typed', async () => {
    const book = registerBook({}, []);
    registerGazetteer([]);
    const { type, save, goBack } = await renderForm();

    await type('  22 Temple Street, Malleshwaram  ');
    await save();

    expect(book.createAddress).toHaveBeenCalledWith({
      formattedAddress: '22 Temple Street, Malleshwaram',
    });
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('keeps everything a chosen suggestion knew, coordinates included', async () => {
    const book = registerBook({}, []);
    registerGazetteer();
    const r = await renderForm();

    await r.type('MG Road');
    const row = r.renderer.root.findAll(
      node =>
        node.props?.testID === `edit-address-suggestion-${SUGGESTION.id}` &&
        typeof node.props?.onSelect === 'function',
    )[0];
    await act(async () => {
      row.props.onSelect(SUGGESTION);
    });
    await r.save();

    expect(book.createAddress).toHaveBeenCalledWith(SUGGESTION.address);
  });

  it('refuses an address too short to be one, using the existing rule and message', async () => {
    const book = registerBook({}, []);
    registerGazetteer([]);
    const { type, save, text } = await renderForm();

    await type('Flat 4');
    await save();

    expect(book.createAddress).not.toHaveBeenCalled();
    expect(text()).toContain(CUSTOMER_COPY.serviceAddress.tooShort);
  });

  it('refuses to save nothing', async () => {
    const book = registerBook({}, []);
    registerGazetteer([]);
    const { save, text } = await renderForm();

    await save();

    expect(book.createAddress).not.toHaveBeenCalled();
    expect(text()).toContain(CUSTOMER_COPY.serviceAddress.tooShort);
  });

  it('keeps what was typed when saving fails, stays put, and says so safely', async () => {
    registerBook(
      {
        createAddress: jest.fn(async (_input: SavedAddressInput): Promise<SavedAddress[]> => {
          throw new AppError({ kind: 'server', message: 'Mock save refused' });
        }),
      },
      [],
    );
    registerGazetteer([]);
    const { type, save, field, goBack, text } = await renderForm();

    await type('22 Temple Street, Malleshwaram');
    await save();

    expect(goBack).not.toHaveBeenCalled();
    expect(field().props.value).toBe('22 Temple Street, Malleshwaram');
    expect(text()).toContain(COPY.saveFailedTitle);
    expect(text()).not.toContain('Mock save refused');
  });

  it('opens an existing address pre-populated, and updates rather than creates', async () => {
    const book = registerBook();
    registerGazetteer([]);
    const { field, type, save, text } = await renderForm(WORK.id);

    expect(text()).toContain(COPY.editTitle);
    expect(field().props.value).toBe(WORK.formattedAddress);

    await type('10, Sector 2, HSR Layout, Bengaluru 560102');
    await save();

    expect(book.updateAddress).toHaveBeenCalledWith(WORK.id, {
      formattedAddress: '10, Sector 2, HSR Layout, Bengaluru 560102',
    });
    expect(book.createAddress).not.toHaveBeenCalled();
  });

  it('saves an unchanged address with its source metadata intact', async () => {
    const withSource: SavedAddress = { ...WORK, placeId: 'place_hsr', latitude: 12.9, longitude: 77.6 };
    const book = registerBook({}, [HOME, withSource]);
    registerGazetteer([]);
    const { save } = await renderForm(withSource.id);

    await save();

    expect(book.updateAddress).toHaveBeenCalledWith(
      withSource.id,
      expect.objectContaining({ placeId: 'place_hsr', latitude: 12.9, longitude: 77.6 }),
    );
  });

  it('never exposes the id, the default flag or coordinates as fields', async () => {
    registerBook({}, [HOME, { ...WORK, latitude: 12.9, longitude: 77.6, placeId: 'place_hsr' }]);
    registerGazetteer([]);
    const { renderer, text } = await renderForm(WORK.id);

    // Host text inputs only: one field is matched at several levels of the tree.
    const fields = renderer.root.findAll(
      node => typeof node.type === 'string' && typeof node.props?.onChangeText === 'function',
    );
    expect(fields).toHaveLength(1);
    expect(text()).not.toMatch(/latitude|longitude|place id|default/i);
  });
});
