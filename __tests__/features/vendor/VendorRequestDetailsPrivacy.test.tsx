/**
 * What a vendor sees of one request (PROJECT_BIBLE.md section 32: "Request
 * ID, Customer Information, Service, Sub Service, Priority, Description,
 * Images, Notes, Address, Preferred Date/Time, Current Status"), and what they
 * may not see yet (owner decision, 21/10/2026), through the real
 * VendorNavigator and the real mock services.
 *
 * Pinned here:
 *
 * - waiting for their answer: the job, the photographs, the preferred date and
 *   time, the area, and a line saying the rest comes on accepting — no name,
 *   no phone, no address anywhere in what is drawn or spoken
 * - the screen keeps the rule even when a record carries them anyway: a
 *   waiting, declined or unrecognised request handed a name, a phone and an
 *   address draws none of them (the record's half is pinned in
 *   MockVendorRequestPrivacy.test.ts)
 * - accepting shows the customer and the full address on the record the
 *   service returned, with no second read
 * - held work: a "Customer" card with the name and the phone written
 *   "+91 90000 30954", never the stored digits, and no way to call; a
 *   "Location" card with the full address, whole, and the area
 * - every part only when the record has it: no photo strip without
 *   photographs, no preferred rows without a preference, no customer card
 *   without a name or phone, no location without an area or address
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { AuthUser } from '@/features/auth/types';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import type { VendorStackParamList } from '@/navigation/types';
import { VendorNavigator } from '@/navigation/VendorNavigator';
import { ToastProvider } from '@/shared/components';
import { formatTimeValue } from '@/shared/presentation/clockTime';
import { formatPhone } from '@/shared/presentation/phone';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { MockVendorRequestBook } from '@/shared/services/mock/MockVendorRequestBook';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import type { MockDashboardScenario } from '@/shared/services/mock/mockVendorDashboardData';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type { VendorRequestDetails } from '@/shared/services/types/VendorRequestService';
import { ThemeProvider } from '@/shared/theme';

const DETAILS = VENDOR_COPY.requestDetails;
const ANSWER = VENDOR_COPY.answer;
const JOB = VENDOR_COPY.job;

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

/** Open and waiting: its customer, their phone (stored and written) and their street. */
const OPEN = {
  id: 'REQ-31042',
  service: 'Switchboard repair',
  customer: 'Asha Patel',
  phone: '9000031042',
  street: '14, 3rd Cross',
};
const LONG_ID = 'REQ-2026-BLR-EAST-0031021';
const LONG_SERVICE = 'Full house wiring inspection before tenancy handover';
const LONG_ADDRESS =
  'Flat 1204, Tower B, Prestige Shantiniketan Residency, 3rd Cross, 12th Main Road, Hoysala Nagar, Indiranagar 2nd Stage Extension, Bengaluru 560038';
/** In progress: everything. */
const IN_PROGRESS = 'REQ-30954';

/** A record carrying everything the vendor may not see yet — as a wrong backend might send it. */
function overSharing(status: string): VendorRequestDetails {
  return {
    id: 'REQ-99001',
    serviceName: 'Fan repair',
    customerName: 'Zara Hidden',
    customerPhone: '9123456780',
    address: {
      formattedAddress: '77, Secret Street, Jayanagar, Bengaluru 560011',
      locality: 'Jayanagar, Bengaluru',
    },
    locality: 'Jayanagar',
    priority: 'LOW',
    status,
    createdAt: new Date().toISOString(),
  };
}
const SECRETS = ['Zara Hidden', '9123456780', formatPhone('9123456780'), 'Secret Street'];

let book: MockVendorRequestBook;
let requests: MockVendorRequestService;
let consoleError: jest.SpyInstance;

beforeEach(async () => {
  resetServices();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  book = new MockVendorRequestBook();
  const scenarios: Record<string, MockDashboardScenario> = { [RAVI.id]: 'mixed' };
  const scenarioFor = (vendorId: string) => scenarios[vendorId] ?? 'empty';
  const currentUser = async () => RAVI;

  const profiles = new MockVendorProfileService({ latency: NO_LATENCY, currentUser });
  requests = new MockVendorRequestService({ latency: NO_LATENCY, currentUser, scenarioFor, book });
  registerService('vendorProfile', profiles);
  registerService('vendorRequests', requests);
  registerService(
    'vendorDashboard',
    new MockVendorDashboardService({ latency: NO_LATENCY, currentUser, scenarioFor, book }),
  );
  registerService('category', {
    listServiceCategories: jest.fn(async () => [{ id: 'cat_electrician', name: 'Electrician' }]),
    listSubCategories: jest.fn(async () => []),
  } as CategoryService);

  setSessionStorage({
    read: async () => ({ token: 'token', user: RAVI }),
    write: async () => undefined,
    clear: async () => undefined,
  });

  await profiles.saveProfile({ businessName: 'Kumar Electricals', serviceCategoryIds: ['cat_electrician'] });
});

type Instance = ReactTestRenderer.ReactTestInstance;

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
  consoleError.mockRestore();
});

function textOf(node: Instance): string {
  return node.children.map(child => (typeof child === 'string' ? child : textOf(child))).join(' ');
}

async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {});
  }
}

/** The vendor app, opened straight onto one request's details. */
async function openDetails(requestId: string) {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user: RAVI }));
  const navigation = createNavigationContainerRef<VendorStackParamList>();

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <NavigationContainer ref={navigation}>
              <VendorNavigator />
            </NavigationContainer>
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  mounted.push(renderer);
  await flush();
  await act(async () => {
    navigation.navigate('VendorRequestDetails', { requestId });
  });
  await flush();

  const hosts = (id: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id);
  const has = (id: string) => hosts(id).length > 0;

  return {
    has,
    host: (id: string) => hosts(id)[0],
    text: (id: string) => (has(id) ? textOf(hosts(id)[0]) : ''),
    /*
      Everything the details screen draws or speaks, as text — for what must
      never be said. Scoped to the screen: the dashboard mounted beneath it
      still shows its own cards (section 31's "Customer"; an open question).
    */
    everything: () =>
      [
        textOf(hosts('vendor-request-details')[0]),
        ...hosts('vendor-request-details')[0]
          .findAll(node => typeof node.type === 'string')
          .flatMap(node => [node.props?.accessibilityLabel, node.props?.accessibilityHint])
          .filter((value): value is string => typeof value === 'string'),
      ].join('\n'),
    pressablesIn: (id: string) =>
      has(id)
        ? hosts(id)[0].findAll(node => typeof node.props?.onPress === 'function')
        : [],
    tap: async (label: string) => {
      const [target] = renderer.root
        .findAll(node => node.props?.accessibilityLabel === label)
        .filter(node => typeof node.props?.onPress === 'function');
      if (!target) {
        throw new Error(`Nothing pressable labelled "${label}"`);
      }
      await act(async () => {
        target.props.onPress();
      });
      await flush();
    },
  };
}

describe('Waiting for the vendor’s answer — the job, and the area only', () => {
  it('shows the job, its photographs, the preferred day and the area — and says the rest comes on accepting', async () => {
    const screen = await openDetails(OPEN.id);

    expect(screen.text('vendor-request-description')).toContain('switchboard is sparking');
    expect(screen.host('vendor-request-photos').props.accessibilityLabel).toBe(
      `${DETAILS.photosLabel}: 2 ${DETAILS.photoCountMany}`,
    );
    expect(screen.text('vendor-request-preferred-date')).toContain(DETAILS.today);
    // The customer named a day and no time: no row for one.
    expect(screen.has('vendor-request-preferred-time')).toBe(false);
    expect(screen.text('vendor-request-area')).toContain('Koramangala');
    expect(screen.text('vendor-request-withheld')).toBe(DETAILS.withheldNote);
  });

  it('draws and says nothing of who the customer is or exactly where', async () => {
    const screen = await openDetails(OPEN.id);

    expect(screen.has('vendor-request-customer')).toBe(false);
    expect(screen.has('vendor-request-address')).toBe(false);
    const everything = screen.everything();
    for (const value of [OPEN.customer, OPEN.phone, formatPhone(OPEN.phone), OPEN.street]) {
      expect(everything).not.toContain(value);
    }
  });
});

describe('The screen keeps the rule even when a record breaks it', () => {
  it.each([
    ['waiting', 'PENDING_VENDOR'],
    ['declined', 'REJECTED'],
    ['in a status the app does not know', 'AWAITING_PARTS'],
  ])('draws no name, phone or address on a request %s, whatever the record carries', async (_state, status) => {
    jest.spyOn(requests, 'getRequest').mockResolvedValue(overSharing(status));
    const screen = await openDetails('REQ-99001');

    expect(screen.text('vendor-request-service')).toBe('Fan repair');
    expect(screen.has('vendor-request-customer')).toBe(false);
    expect(screen.has('vendor-request-address')).toBe(false);
    // The area is still the area.
    expect(screen.text('vendor-request-area')).toContain('Jayanagar');
    const everything = screen.everything();
    for (const secret of SECRETS) {
      expect(everything).not.toContain(secret);
    }
  });

  it('says the rest comes on accepting only while the request is waiting', async () => {
    jest.spyOn(requests, 'getRequest').mockResolvedValue(overSharing('REJECTED'));
    const screen = await openDetails('REQ-99001');

    expect(screen.has('vendor-request-withheld')).toBe(false);
  });
});

describe('Accepting', () => {
  it('shows the customer and the full address from the service’s answer, without reading again', async () => {
    const screen = await openDetails(OPEN.id);
    const getRequest = jest.spyOn(requests, 'getRequest');

    await screen.tap(ANSWER.acceptSpoken(OPEN.service, `${JOB.referencePrefix} ${OPEN.id}`));

    expect(getRequest).not.toHaveBeenCalled();
    expect(screen.text('vendor-request-customer-name')).toContain(OPEN.customer);
    expect(screen.text('vendor-request-customer-phone')).toContain(formatPhone(OPEN.phone));
    expect(screen.text('vendor-request-address')).toContain(OPEN.street);
    expect(screen.has('vendor-request-withheld')).toBe(false);
  });

  it('shows a long address whole, wrapped rather than cut', async () => {
    const screen = await openDetails(LONG_ID);
    await screen.tap(ANSWER.acceptSpoken(LONG_SERVICE, `${JOB.referencePrefix} ${LONG_ID}`));

    const address = screen.host('vendor-request-address');
    expect(textOf(address)).toContain(LONG_ADDRESS);
    const lines = address.findAll(node => typeof node.type === 'string' && node.props?.numberOfLines);
    expect(lines).toHaveLength(0);
  });
});

describe('Work the vendor holds', () => {
  it('names the customer and gives their phone, written for reading — never the stored digits', async () => {
    const screen = await openDetails(IN_PROGRESS);
    const written = formatPhone('9000030954');

    expect(written).not.toBe('9000030954');
    expect(screen.text('vendor-request-customer-name')).toContain('Imran Sheikh');
    expect(screen.text('vendor-request-customer-phone')).toContain(written);
    expect(screen.host('vendor-request-customer-phone').props.accessibilityLabel).toBe(
      `${DETAILS.phoneLabel}, ${written}`,
    );
    expect(screen.everything()).not.toContain('9000030954');
  });

  it('offers no way to call: the customer card holds nothing to press', async () => {
    const screen = await openDetails(IN_PROGRESS);

    expect(screen.has('vendor-request-customer')).toBe(true);
    expect(screen.pressablesIn('vendor-request-customer')).toHaveLength(0);
  });

  it('gives the full address and the area, and the preferred day and time', async () => {
    const screen = await openDetails(IN_PROGRESS);

    expect(screen.text('vendor-request-address')).toContain('221, 16th Main, BTM 2nd Stage');
    expect(screen.text('vendor-request-area')).toContain('BTM Layout');
    expect(screen.has('vendor-request-withheld')).toBe(false);
    expect(screen.text('vendor-request-preferred-date')).toContain(DETAILS.today);
    expect(screen.text('vendor-request-preferred-time')).toContain(formatTimeValue('11:00'));
    expect(screen.host('vendor-request-photos').props.accessibilityLabel).toBe(
      `${DETAILS.photosLabel}: ${DETAILS.photoCountOne}`,
    );
  });
});

describe('Only what the record has', () => {
  it('draws no photo strip, no preferred rows, no customer card and no location for a bare record', async () => {
    jest.spyOn(requests, 'getRequest').mockResolvedValue({
      id: 'REQ-99002',
      serviceName: 'Socket check',
      priority: 'LOW',
      status: 'ACCEPTED',
      createdAt: new Date().toISOString(),
    });
    const screen = await openDetails('REQ-99002');

    expect(screen.text('vendor-request-service')).toBe('Socket check');
    for (const id of [
      'vendor-request-photos',
      'vendor-request-preferred-date',
      'vendor-request-preferred-time',
      'vendor-request-customer',
      'vendor-request-location',
    ]) {
      expect(screen.has(id)).toBe(false);
    }
    expect(screen.text('vendor-request-description')).toContain(DETAILS.descriptionMissing);
  });

  it('gives a held request with a name and no phone a name row and no phone row', async () => {
    jest.spyOn(requests, 'getRequest').mockResolvedValue({
      id: 'REQ-99003',
      serviceName: 'Socket check',
      customerName: 'Kiran Rao',
      priority: 'LOW',
      status: 'IN_PROGRESS',
      createdAt: new Date().toISOString(),
      imageUrls: [],
    });
    const screen = await openDetails('REQ-99003');

    expect(screen.text('vendor-request-customer-name')).toContain('Kiran Rao');
    expect(screen.has('vendor-request-customer-phone')).toBe(false);
    // An empty list of photographs is no photographs.
    expect(screen.has('vendor-request-photos')).toBe(false);
  });
});
