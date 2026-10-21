/**
 * The vendor's availability and working hours (PROJECT_BIBLE.md section 38,
 * "Working Hours", "Availability" and "Manage Availability"), through the real
 * VendorNavigator and the real mock vendor profile service — with stub image
 * and permission services, as the shop-image tests use, so a shop-image save
 * can share the vendor's profile line with an availability change.
 *
 * Pinned here:
 *
 * - Profile's Availability card: "Accepting new requests" as one switch stop
 *   with its state and the line under it, and the week in short
 * - turning new requests off asks first and Keep accepting sends nothing;
 *   turning them on does not ask; the switch is busy and locked while a change
 *   is in the air, and a second press sends nothing; a failure puts it back
 *   and says why
 * - an availability change waits in the vendor's one profile line behind a
 *   shop-image save, so Profile ends with both — an older answer never lands
 *   after it
 * - the profile form's save keeps availability and the week
 * - the Working hours screen: seven days, each one stop; times chosen from a
 *   list that opens on the current one; a day closing at or before it opens is
 *   said on that day and Save sends nothing; the week sent has times on open
 *   days only; Save is locked in flight; a failure keeps the week and the
 *   reason; "Copy Monday to all weekdays"
 * - leaving with changes asks, without them does not; a leave during a save is
 *   held — taken after a success, and asked about after a failure (3E-11)
 * - the dashboard's notice: absent while accepting; while not, it says so and
 *   "Turn on" turns new requests on without asking
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { AuthUser } from '@/features/auth/types';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { VendorNavigator } from '@/navigation/VendorNavigator';
import { ToastProvider } from '@/shared/components';
import { formatTimeValue } from '@/shared/presentation/clockTime';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type {
  ImageAsset,
  ImageService,
  ImageUploadResult,
} from '@/shared/services/types/ImageService';
import type { PermissionService } from '@/shared/services/types/PermissionService';
import type {
  VendorProfile,
  VendorWorkingDay,
} from '@/shared/services/types/VendorProfileService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const COPY = VENDOR_COPY.availability;
const HOURS = VENDOR_COPY.workingHours;
const PROFILE = VENDOR_COPY.profile;
const FORM = VENDOR_COPY.profileForm;
const SHOP = VENDOR_COPY.shopImages;

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

const time = formatTimeValue;
const NINE = time('09:00');
const SEVEN = time('19:00');

const open = (day: string, opensAt: string, closesAt: string): VendorWorkingDay => ({
  day,
  isOpen: true,
  opensAt,
  closesAt,
});
const closed = (day: string): VendorWorkingDay => ({ day, isOpen: false });

const DEFAULT_WEEK: VendorWorkingDay[] = [
  open('MON', '09:00', '19:00'),
  open('TUE', '09:00', '19:00'),
  open('WED', '09:00', '19:00'),
  open('THU', '09:00', '19:00'),
  open('FRI', '09:00', '19:00'),
  open('SAT', '09:00', '19:00'),
  closed('SUN'),
];

/** The default week with some days replaced. */
function weekWith(changes: Record<string, VendorWorkingDay>): VendorWorkingDay[] {
  return DEFAULT_WEEK.map(day => changes[day.day] ?? day);
}

const offline = () => new AppError({ kind: 'network', message: 'offline' });

/** The switch's spoken name in each state. */
const ACCEPTING_ON = COPY.acceptingSpoken(COPY.acceptingOn);
const ACCEPTING_OFF = COPY.acceptingSpoken(COPY.acceptingOff);

const SWITCH = 'vendor-profile-availability-accepting';
const STOP_DIALOG = 'vendor-profile-availability-stop-dialog';

let current: AuthUser;
let profiles: MockVendorProfileService;

async function uploaded(asset: ImageAsset): Promise<ImageUploadResult> {
  return { assetId: asset.id, remoteUrl: `https://cdn.example.com/${asset.id}.jpg` };
}

beforeEach(async () => {
  resetServices();
  current = RAVI;
  const currentUser = async () => current;

  profiles = new MockVendorProfileService({ latency: NO_LATENCY, currentUser });
  registerService('vendorProfile', profiles);
  registerService('vendorRequests', new MockVendorRequestService({ latency: NO_LATENCY, currentUser }));
  registerService('vendorDashboard', new MockVendorDashboardService({ latency: NO_LATENCY, currentUser }));
  registerService('category', {
    listServiceCategories: jest.fn(async () => [{ id: 'cat_electrician', name: 'Electrician' }]),
    listSubCategories: jest.fn(async () => []),
  } as CategoryService);

  // For the shop-image save that shares the profile line with availability.
  let picks = 0;
  const pickOne = async (): Promise<ImageAsset[]> => {
    picks += 1;
    return [
      {
        id: `img_${picks}`,
        uri: `file:///cache/img_${picks}.jpg`,
        fileName: `img_${picks}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
        width: 800,
        height: 600,
      },
    ];
  };
  registerService('image', {
    pickFromCamera: jest.fn(pickOne),
    pickFromGallery: jest.fn(pickOne),
    compress: jest.fn(async (asset: ImageAsset) => asset),
    generatePreview: jest.fn(async (asset: ImageAsset) => asset.uri),
    validate: jest.fn(() => ({ valid: true })),
    upload: jest.fn(uploaded),
    retryUpload: jest.fn(uploaded),
    remove: jest.fn(async () => undefined),
  } as ImageService);
  registerService('permission', {
    check: jest.fn(async () => 'granted' as const),
    request: jest.fn(async () => 'granted' as const),
    openSettings: jest.fn(async () => undefined),
  } as PermissionService);

  setSessionStorage({
    read: async () => ({ token: 'token', user: current }),
    write: async () => undefined,
    clear: async () => undefined,
  });

  // Availability and hours are offered only once the business is set up.
  await profiles.saveProfile({
    businessName: 'Kumar Electricals',
    serviceCategoryIds: ['cat_electrician'],
  });
});

type Instance = ReactTestRenderer.ReactTestInstance;

/*
  Unmounted after every test: a toast's dwell timer and a tree left mid-save
  outlive a renderer that is never unmounted.
*/
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
});

function textOf(node: Instance): string {
  return node.children.map(child => (typeof child === 'string' ? child : textOf(child))).join(' ');
}

async function flush() {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {});
  }
}

function held<T>() {
  let land!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    land = resolve;
    fail = reject;
  });
  return { promise, land, fail };
}

/** Renders the vendor application on the Dashboard. */
async function render() {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user: current }));

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>
          <ToastProvider>
            <NavigationContainer>
              <VendorNavigator />
            </NavigationContainer>
          </ToastProvider>
        </ThemeProvider>
      </Provider>,
    );
  });
  mounted.push(renderer);
  await flush();

  const hosts = (match: (id: string) => boolean, within: Instance = renderer.root) =>
    within.findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props?.testID === 'string' &&
        match(node.props.testID),
    );
  const host = (id: string) => hosts(testID => testID === id)[0];
  const has = (id: string) => hosts(testID => testID === id).length > 0;

  const pressable = (label: string, within: Instance = renderer.root) =>
    within
      .findAll(node => node.props?.accessibilityLabel === label)
      .filter(node => typeof node.props?.onPress === 'function');

  const press = async (label: string, within?: Instance) => {
    const [target] = pressable(label, within);
    if (!target) {
      throw new Error(`Nothing pressable labelled "${label}"`);
    }
    await act(async () => {
      target.props.onPress();
    });
    await flush();
  };

  /** By test id, for a control whose words are not what the test is about. */
  const control = (id: string) => {
    const [target] = renderer.root.findAll(
      node => node.props?.testID === id && typeof node.props?.onPress === 'function',
    );
    if (!target) {
      throw new Error(`No control "${id}"`);
    }
    return target;
  };

  const tap = async (id: string) => {
    const target = control(id);
    await act(async () => {
      target.props.onPress();
    });
    await flush();
  };

  const screen = {
    renderer,
    host,
    has,
    pressable,
    press,
    control,
    tap,
    flush,
    text: (id: string) => (has(id) ? textOf(host(id)) : ''),
    /** What a control says to a screen reader: its name and its state. */
    spoken: (id: string) => host(id)?.props.accessibilityLabel as string | undefined,
    stateOf: (id: string) => host(id)?.props.accessibilityState,
    toast: (): string | undefined =>
      renderer.root.findAll(
        node =>
          node.props?.accessibilityHint === 'Dismisses this message' &&
          typeof node.props.onPress === 'function',
      )[0]?.props.accessibilityLabel,

    /* Profile */
    openProfile: () => screen.press('Profile'),
    /** Flips the availability switch — the whole row is the control. */
    flipAccepting: () => screen.tap(SWITCH),
    stopDialog: () => host(STOP_DIALOG),
    /** The summary's lines, as spoken. */
    hoursSpoken: () =>
      hosts(id => id.startsWith('vendor-profile-availability-hours-')).map(
        node => node.props.accessibilityLabel as string,
      ),
    profilePhotos: () =>
      host('vendor-profile-shop-images').findAll(
        node => typeof node.type === 'string' && node.props?.accessibilityRole === 'image',
      ),

    /* Working hours */
    openHours: async () => {
      await screen.openProfile();
      await screen.press(COPY.hoursEdit);
    },
    onHours: () => has('working-hours'),
    day: (code: string) => `working-hours-day-${code}`,
    /** Opens a day's time list, then chooses a time on it. */
    choose: async (code: string, edge: 'opens' | 'closes', value: string) => {
      await screen.tap(`working-hours-day-${code}-${edge}`);
      await screen.tap(`working-hours-times-${value}`);
    },
    save: () => screen.press(HOURS.save, host('working-hours')),
    back: () => screen.press(HOURS.back, host('working-hours')),
    discardDialog: () => host('working-hours-discard-dialog'),
  };

  return screen;
}

type Screen = Awaited<ReturnType<typeof render>>;

/** The stored values, as a restarted app would read them. */
async function stored() {
  const { acceptingRequests, workingHours } = await profiles.getProfile();
  return { acceptingRequests, workingHours };
}

/* -------------------------------------------------------------------------- */

describe('Availability — on the Profile tab', () => {
  it('shows new requests on as one switch stop, its line, and the week in short', async () => {
    const screen = await render();
    await screen.openProfile();

    const row = screen.host(SWITCH);
    expect(row.props.accessibilityRole).toBe('switch');
    expect(row.props.accessibilityLabel).toBe(ACCEPTING_ON);
    expect(row.props.accessibilityState).toEqual({ checked: true, disabled: false, busy: false });
    expect(row.props.accessibilityHint).toBe(COPY.turnOffHint);
    expect(screen.text(SWITCH)).toContain(COPY.acceptingLabel);
    expect(screen.text(SWITCH)).toContain(COPY.acceptingOn);

    expect(screen.text('vendor-profile-availability')).toContain('Mon–Sat');
    expect(screen.hoursSpoken()).toEqual([
      `Monday to Saturday, ${NINE} to ${SEVEN}`,
      'Sunday, closed',
    ]);
    expect(screen.pressable(COPY.hoursEdit)[0].props.accessibilityHint).toBe(COPY.hoursEditHint);
  });

  it('asks before turning new requests off — and Keep accepting sends nothing', async () => {
    const setAccepting = jest.spyOn(profiles, 'setAcceptingRequests');
    const screen = await render();
    await screen.openProfile();

    await screen.flipAccepting();

    expect(screen.stopDialog()).toBeDefined();
    expect(screen.text(STOP_DIALOG)).toContain(COPY.stopTitle);
    expect(screen.text(STOP_DIALOG)).toContain(COPY.stopMessage);
    await screen.press(COPY.stopCancel, screen.stopDialog());

    expect(screen.has(STOP_DIALOG)).toBe(false);
    expect(setAccepting).not.toHaveBeenCalled();
    expect(screen.stateOf(SWITCH)).toMatchObject({ checked: true });
    expect((await stored()).acceptingRequests).toBe(true);
  });

  it('stops them once confirmed: sent once, the switch and its line follow, and a toast says so', async () => {
    const setAccepting = jest.spyOn(profiles, 'setAcceptingRequests');
    const screen = await render();
    await screen.openProfile();

    await screen.flipAccepting();
    await screen.press(COPY.stopConfirm, screen.stopDialog());

    expect(setAccepting).toHaveBeenCalledTimes(1);
    expect(setAccepting).toHaveBeenCalledWith(false);
    expect(screen.has(STOP_DIALOG)).toBe(false);
    expect(screen.stateOf(SWITCH)).toEqual({ checked: false, disabled: false, busy: false });
    expect(screen.spoken(SWITCH)).toBe(ACCEPTING_OFF);
    expect(screen.text(SWITCH)).toContain(COPY.acceptingOff);
    expect(screen.host(SWITCH).props.accessibilityHint).toBe(COPY.turnOnHint);
    expect(screen.toast()).toBe(COPY.turnedOff);
    expect((await stored()).acceptingRequests).toBe(false);
  });

  it('turns them back on without asking', async () => {
    await profiles.setAcceptingRequests(false);
    const setAccepting = jest.spyOn(profiles, 'setAcceptingRequests');
    const screen = await render();
    await screen.openProfile();
    expect(screen.stateOf(SWITCH)).toMatchObject({ checked: false });

    await screen.flipAccepting();

    expect(screen.has(STOP_DIALOG)).toBe(false);
    expect(setAccepting).toHaveBeenCalledTimes(1);
    expect(setAccepting).toHaveBeenCalledWith(true);
    expect(screen.stateOf(SWITCH)).toMatchObject({ checked: true });
    expect(screen.toast()).toBe(COPY.turnedOn);
    expect((await stored()).acceptingRequests).toBe(true);
  });

  it('is busy and locked while the change is in the air — a second press sends nothing', async () => {
    await profiles.setAcceptingRequests(false);
    const real = profiles.setAcceptingRequests.bind(profiles);
    const answer = held<VendorProfile>();
    const setAccepting = jest
      .spyOn(profiles, 'setAcceptingRequests')
      .mockReturnValueOnce(answer.promise);
    const screen = await render();
    await screen.openProfile();

    // Twice before a render can lock it: only the hook's own guard stands between.
    const row = screen.control(SWITCH);
    await act(async () => {
      row.props.onPress();
      row.props.onPress();
    });
    await screen.flush();

    expect(setAccepting).toHaveBeenCalledTimes(1);
    // Shows what was asked for, busy, and refuses another press.
    expect(screen.stateOf(SWITCH)).toEqual({ checked: true, disabled: true, busy: true });
    await screen.flipAccepting();
    expect(setAccepting).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer.land(await real(true));
    });
    await screen.flush();

    // Counted after the answer too: a second request waiting in the line would be sent now.
    expect(setAccepting).toHaveBeenCalledTimes(1);
    expect(screen.stateOf(SWITCH)).toEqual({ checked: true, disabled: false, busy: false });
  });

  it('puts the switch back and says why when the change fails', async () => {
    jest.spyOn(profiles, 'setAcceptingRequests').mockRejectedValueOnce(offline());
    const screen = await render();
    await screen.openProfile();

    await screen.flipAccepting();
    await screen.press(COPY.stopConfirm, screen.stopDialog());

    expect(screen.stateOf(SWITCH)).toEqual({ checked: true, disabled: false, busy: false });
    expect(screen.spoken(SWITCH)).toBe(ACCEPTING_ON);
    expect(screen.toast()).toBe(`${COPY.turnOffFailed} ${offline().userMessage}`);
    expect(screen.toast()).not.toContain('offline');
    expect((await stored()).acceptingRequests).toBe(true);
  });

  it('waits in the profile line behind a shop-image save, so Profile ends with both', async () => {
    /*
      The photo's save is stored at once but its answer — the profile as it
      was before the switch — comes back late. Out of line, the switch's answer
      would land first and that late answer would then put "accepting" back.
    */
    const real = profiles.updateShopImages.bind(profiles);
    const late = held<void>();
    jest.spyOn(profiles, 'updateShopImages').mockImplementationOnce(async urls => {
      const answer = await real(urls);
      await late.promise;
      return answer;
    });
    const setAccepting = jest.spyOn(profiles, 'setAcceptingRequests');
    const screen = await render();
    await screen.openProfile();
    await screen.press(PROFILE.shopImages);
    await screen.tap('shop-images-add-gallery');
    // Sent and unanswered; leaving cannot stop it, so leaving asks nothing.
    await screen.press(SHOP.back, screen.host('shop-images'));
    expect(screen.has('shop-images')).toBe(false);

    await screen.flipAccepting();
    await screen.press(COPY.stopConfirm, screen.stopDialog());

    // In line behind the photo: not sent yet, and the switch says it is on its way.
    expect(setAccepting).not.toHaveBeenCalled();
    expect(screen.stateOf(SWITCH)).toEqual({ checked: false, disabled: true, busy: true });

    await act(async () => {
      late.land();
    });
    await screen.flush();

    expect(setAccepting).toHaveBeenCalledTimes(1);
    expect(screen.profilePhotos()).toHaveLength(1);
    expect(screen.stateOf(SWITCH)).toEqual({ checked: false, disabled: false, busy: false });
    const reloaded = await profiles.getProfile();
    expect(reloaded.shopImageUrls).toHaveLength(1);
    expect(reloaded.acceptingRequests).toBe(false);
  });

  it('survives the business profile form being saved', async () => {
    await profiles.setAcceptingRequests(false);
    const week = weekWith({ SAT: open('SAT', '10:00', '14:00') });
    await profiles.updateWorkingHours(week);
    const screen = await render();
    await screen.openProfile();

    await screen.press(PROFILE.edit);
    await act(async () => {
      screen.host('vendor-profile-description').findAll(
        node => typeof node.props?.onChangeText === 'function',
      )[0].props.onChangeText('Now with a van.');
    });
    await screen.press(FORM.saveEdit);

    expect(screen.has('vendor-profile-edit')).toBe(false);
    expect(screen.stateOf(SWITCH)).toMatchObject({ checked: false });
    expect(screen.hoursSpoken()).toContain(`Saturday, ${time('10:00')} to ${time('14:00')}`);
    expect(await stored()).toEqual({ acceptingRequests: false, workingHours: week });
    expect((await profiles.getProfile()).description).toBe('Now with a van.');
  });
});

/* -------------------------------------------------------------------------- */

describe('Working hours — the screen', () => {
  it('opens from Profile on the stored week, each day one stop that says its hours', async () => {
    const screen = await render();
    await screen.openHours();

    expect(screen.onHours()).toBe(true);
    expect(screen.text('working-hours-heading')).toBe(HOURS.title);

    const monday = screen.host(`${screen.day('MON')}-switch`);
    expect(monday.props.accessibilityRole).toBe('switch');
    expect(monday.props.accessibilityLabel).toBe(
      HOURS.dayOpenSpoken('Monday', HOURS.hoursSpoken(NINE, SEVEN)),
    );
    expect(monday.props.accessibilityState).toMatchObject({ checked: true });

    const sunday = screen.host(`${screen.day('SUN')}-switch`);
    expect(sunday.props.accessibilityLabel).toBe(HOURS.dayClosedSpoken('Sunday'));
    expect(sunday.props.accessibilityState).toMatchObject({ checked: false });

    // Times are their own stops, named for their day — and only on open days.
    expect(screen.spoken(`${screen.day('MON')}-closes`)).toBe(HOURS.closesSpoken('Monday', SEVEN));
    expect(screen.has(`${screen.day('SUN')}-opens`)).toBe(false);
    expect(screen.has(`${screen.day('SUN')}-closes`)).toBe(false);
  });

  it('opens the list of times on the current one, and applies the time chosen', async () => {
    const screen = await render();
    await screen.openHours();

    await screen.tap(`${screen.day('MON')}-closes`);

    expect(screen.text('working-hours-times')).toContain(HOURS.closesTitle('Monday'));
    expect(screen.stateOf('working-hours-times-19:00')).toMatchObject({ checked: true });
    expect(screen.stateOf('working-hours-times-17:30')).toMatchObject({ checked: false });

    await screen.tap('working-hours-times-17:30');

    expect(screen.has('working-hours-times')).toBe(false);
    expect(screen.spoken(`${screen.day('MON')}-closes`)).toBe(
      HOURS.closesSpoken('Monday', time('17:30')),
    );
    expect(screen.spoken(`${screen.day('MON')}-switch`)).toBe(
      HOURS.dayOpenSpoken('Monday', HOURS.hoursSpoken(NINE, time('17:30'))),
    );
  });

  it('changes nothing when the list is cancelled', async () => {
    const screen = await render();
    await screen.openHours();

    await screen.tap(`${screen.day('MON')}-opens`);
    await screen.press(HOURS.chooseCancel, screen.host('working-hours-times'));

    expect(screen.has('working-hours-times')).toBe(false);
    expect(screen.spoken(`${screen.day('MON')}-opens`)).toBe(HOURS.opensSpoken('Monday', NINE));
  });

  it('says on the day when it closes before it opens, and Save sends nothing', async () => {
    const updateWorkingHours = jest.spyOn(profiles, 'updateWorkingHours');
    const screen = await render();
    await screen.openHours();

    await screen.choose('MON', 'closes', '08:00');

    expect(screen.text(`${screen.day('MON')}-problem`)).toBe(HOURS.closesBeforeOpens);
    expect(screen.has(`${screen.day('TUE')}-problem`)).toBe(false);
    expect(screen.has('working-hours-fix-errors')).toBe(false);

    await screen.save();

    expect(updateWorkingHours).not.toHaveBeenCalled();
    expect(screen.text('working-hours-fix-errors')).toBe(HOURS.fixErrors);
    expect(screen.onHours()).toBe(true);

    // Put right, it saves.
    await screen.choose('MON', 'closes', '18:00');
    expect(screen.has(`${screen.day('MON')}-problem`)).toBe(false);
    expect(screen.has('working-hours-fix-errors')).toBe(false);
    await screen.save();
    expect(updateWorkingHours).toHaveBeenCalledTimes(1);
  });

  it('saves the week as edited — times on open days only — says so, and goes back to it on Profile', async () => {
    const updateWorkingHours = jest.spyOn(profiles, 'updateWorkingHours');
    const screen = await render();
    await screen.openHours();

    await screen.tap(`${screen.day('SAT')}-switch`);
    await screen.choose('MON', 'opens', '08:00');
    await screen.save();

    const expected = weekWith({ MON: open('MON', '08:00', '19:00'), SAT: closed('SAT') });
    expect(updateWorkingHours).toHaveBeenCalledTimes(1);
    expect(updateWorkingHours).toHaveBeenCalledWith(expected);
    const sent = updateWorkingHours.mock.calls[0][0];
    expect(Object.keys(sent[5]).sort()).toEqual(['day', 'isOpen']);
    expect(screen.toast()).toBe(HOURS.saved);
    expect(screen.onHours()).toBe(false);
    expect(screen.hoursSpoken()).toEqual([
      `Monday, ${time('08:00')} to ${SEVEN}`,
      `Tuesday to Friday, ${NINE} to ${SEVEN}`,
      'Saturday to Sunday, closed',
    ]);
    expect((await stored()).workingHours).toEqual(expected);
  });

  it('locks Save and every day while saving — two presses send one week', async () => {
    const real = profiles.updateWorkingHours.bind(profiles);
    const answer = held<VendorProfile>();
    const updateWorkingHours = jest
      .spyOn(profiles, 'updateWorkingHours')
      .mockReturnValueOnce(answer.promise);
    const screen = await render();
    await screen.openHours();

    const [save] = screen.pressable(HOURS.save, screen.host('working-hours'));
    await act(async () => {
      save.props.onPress();
      save.props.onPress();
    });
    await screen.flush();

    expect(updateWorkingHours).toHaveBeenCalledTimes(1);
    const [busy] = screen
      .pressable(HOURS.saving, screen.host('working-hours'))
      .filter(node => node.props.accessibilityState !== undefined);
    expect(busy.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(screen.stateOf(`${screen.day('MON')}-switch`)).toMatchObject({ disabled: true });

    await act(async () => {
      answer.land(await real(DEFAULT_WEEK));
    });
    await screen.flush();
    // Counted after the answer too: a second save waiting in the line would be sent now.
    expect(updateWorkingHours).toHaveBeenCalledTimes(1);
    expect(screen.onHours()).toBe(false);
  });

  it('keeps the week as edited and says why when saving fails; Save again sends it', async () => {
    const updateWorkingHours = jest
      .spyOn(profiles, 'updateWorkingHours')
      .mockRejectedValueOnce(offline());
    const screen = await render();
    await screen.openHours();

    await screen.tap(`${screen.day('SAT')}-switch`);
    await screen.save();

    expect(screen.onHours()).toBe(true);
    expect(screen.text('working-hours-save-error')).toContain(HOURS.saveFailedTitle);
    expect(screen.text('working-hours-save-error')).not.toContain('offline');
    expect(screen.stateOf(`${screen.day('SAT')}-switch`)).toMatchObject({ checked: false });
    expect((await stored()).workingHours).toEqual(DEFAULT_WEEK);

    await screen.save();

    expect(updateWorkingHours).toHaveBeenCalledTimes(2);
    expect(updateWorkingHours.mock.calls[1][0]).toEqual(updateWorkingHours.mock.calls[0][0]);
    expect(screen.onHours()).toBe(false);
    expect((await stored()).workingHours).toEqual(weekWith({ SAT: closed('SAT') }));
  });

  it('copies Monday to Tuesday to Friday, leaves the weekend, and says so', async () => {
    const updateWorkingHours = jest.spyOn(profiles, 'updateWorkingHours');
    const screen = await render();
    await screen.openHours();

    await screen.choose('MON', 'closes', '17:30');
    await screen.press(HOURS.copyMonday, screen.host('working-hours'));

    for (const [code, name] of [
      ['TUE', 'Tuesday'],
      ['FRI', 'Friday'],
    ]) {
      expect(screen.spoken(`${screen.day(code)}-closes`)).toBe(HOURS.closesSpoken(name, time('17:30')));
    }
    expect(screen.spoken(`${screen.day('SAT')}-closes`)).toBe(HOURS.closesSpoken('Saturday', SEVEN));
    expect(screen.text('working-hours-copied')).toBe(HOURS.copiedMonday);

    // Said about the copy, not about whatever is changed after it.
    await screen.tap(`${screen.day('SUN')}-switch`);
    expect(screen.has('working-hours-copied')).toBe(false);
    await screen.tap(`${screen.day('SUN')}-switch`);

    await screen.save();

    const halfFive = (day: string) => open(day, '09:00', '17:30');
    expect(updateWorkingHours).toHaveBeenCalledWith(
      weekWith({
        MON: halfFive('MON'),
        TUE: halfFive('TUE'),
        WED: halfFive('WED'),
        THU: halfFive('THU'),
        FRI: halfFive('FRI'),
      }),
    );
  });

  it('does not offer to copy a Monday that is wrong', async () => {
    const screen = await render();
    await screen.openHours();

    await screen.choose('MON', 'closes', '08:00');

    const [copy] = screen
      .pressable(HOURS.copyMonday, screen.host('working-hours'))
      .filter(node => node.props.accessibilityState !== undefined);
    expect(copy.props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('Working hours — leaving', () => {
  it('asks before leaving unsaved changes; Keep editing stays, Discard leaves without saving', async () => {
    const updateWorkingHours = jest.spyOn(profiles, 'updateWorkingHours');
    const screen = await render();
    await screen.openHours();
    await screen.tap(`${screen.day('SAT')}-switch`);

    await screen.back();
    expect(screen.discardDialog()).toBeDefined();
    await screen.press(HOURS.discardKeep, screen.discardDialog());
    expect(screen.onHours()).toBe(true);
    expect(screen.stateOf(`${screen.day('SAT')}-switch`)).toMatchObject({ checked: false });

    await screen.back();
    await screen.press(HOURS.discardConfirm, screen.discardDialog());

    expect(screen.onHours()).toBe(false);
    expect(updateWorkingHours).not.toHaveBeenCalled();
    expect((await stored()).workingHours).toEqual(DEFAULT_WEEK);
  });

  it('leaves without asking when nothing would be lost — a change undone included', async () => {
    const screen = await render();
    await screen.openHours();
    // Closed and opened again: the same week as stored.
    await screen.tap(`${screen.day('SAT')}-switch`);
    await screen.tap(`${screen.day('SAT')}-switch`);

    await screen.back();

    expect(screen.has('working-hours-discard-dialog')).toBe(false);
    expect(screen.onHours()).toBe(false);
  });

  it('holds a leave asked for during the save, and takes it once the save lands', async () => {
    const answer = held<VendorProfile>();
    const updateWorkingHours = jest
      .spyOn(profiles, 'updateWorkingHours')
      .mockReturnValueOnce(answer.promise);
    const screen = await render();
    await screen.openHours();
    await screen.tap(`${screen.day('SAT')}-switch`);

    await screen.save();
    await screen.back();

    expect(screen.onHours()).toBe(true);
    expect(screen.has('working-hours-discard-dialog')).toBe(false);

    updateWorkingHours.mockRestore();
    await act(async () => {
      answer.land(await profiles.updateWorkingHours(weekWith({ SAT: closed('SAT') })));
    });
    await screen.flush();

    expect(screen.onHours()).toBe(false);
    // Back once, to Profile — not past it.
    expect(screen.has('vendor-profile')).toBe(true);
    expect(screen.hoursSpoken()).toContain('Saturday to Sunday, closed');
  });

  it('asks about the unsaved week when a held leave meets a failed save (3E-11)', async () => {
    const answer = held<VendorProfile>();
    jest.spyOn(profiles, 'updateWorkingHours').mockReturnValueOnce(answer.promise);
    const screen = await render();
    await screen.openHours();
    await screen.tap(`${screen.day('SAT')}-switch`);

    await screen.save();
    await screen.back();
    await act(async () => {
      answer.fail(offline());
    });
    await screen.flush();

    // Not let out by the held action skipping the guard: asked, and still here.
    expect(screen.onHours()).toBe(true);
    expect(screen.discardDialog()).toBeDefined();
    expect(screen.text('working-hours-save-error')).toContain(HOURS.saveFailedTitle);

    await screen.press(HOURS.discardConfirm, screen.discardDialog());
    expect(screen.onHours()).toBe(false);
    expect((await stored()).workingHours).toEqual(DEFAULT_WEEK);
  });
});

/* -------------------------------------------------------------------------- */

describe('Availability — the dashboard notice', () => {
  const notice = (screen: Screen) => screen.has('dashboard-availability');

  it('draws nothing while new requests are on', async () => {
    const screen = await render();

    expect(screen.has('vendor-dashboard')).toBe(true);
    expect(notice(screen)).toBe(false);
  });

  it('says so while they are off, and Turn on turns them on without asking', async () => {
    await profiles.setAcceptingRequests(false);
    const setAccepting = jest.spyOn(profiles, 'setAcceptingRequests');
    const screen = await render();

    expect(notice(screen)).toBe(true);
    expect(screen.text('dashboard-availability')).toContain(COPY.noticeTitle);
    const [turnOn] = screen.pressable(COPY.noticeTurnOnSpoken);
    expect(turnOn.props.accessibilityHint).toBe(COPY.noticeTurnOnHint);
    // The spoken name starts with the words on the button, for voice control.
    expect(COPY.noticeTurnOnSpoken.startsWith(COPY.noticeTurnOn)).toBe(true);

    await screen.press(COPY.noticeTurnOnSpoken);

    expect(screen.has(STOP_DIALOG)).toBe(false);
    expect(setAccepting).toHaveBeenCalledTimes(1);
    expect(setAccepting).toHaveBeenCalledWith(true);
    expect(notice(screen)).toBe(false);
    expect(screen.toast()).toBe(COPY.turnedOn);
    expect((await stored()).acceptingRequests).toBe(true);
  });

  it('stays, busy, until the service says yes — and stays after a failure, saying why', async () => {
    await profiles.setAcceptingRequests(false);
    const answer = held<VendorProfile>();
    jest.spyOn(profiles, 'setAcceptingRequests').mockReturnValueOnce(answer.promise);
    const screen = await render();

    await screen.press(COPY.noticeTurnOnSpoken);

    expect(notice(screen)).toBe(true);
    // The pressable that carries the state; the button components above it only pass props on.
    const [turnOn] = screen
      .pressable(COPY.noticeTurnOnSpoken)
      .filter(node => node.props.accessibilityState !== undefined);
    expect(turnOn.props.accessibilityState).toMatchObject({ busy: true, disabled: true });

    await act(async () => {
      answer.fail(offline());
    });
    await screen.flush();

    expect(notice(screen)).toBe(true);
    expect(screen.toast()).toBe(`${COPY.turnOnFailed} ${offline().userMessage}`);
    expect((await stored()).acceptingRequests).toBe(false);
  });

  it('appears when new requests are turned off on Profile', async () => {
    const screen = await render();
    await screen.openProfile();
    await screen.flipAccepting();
    await screen.press(COPY.stopConfirm, screen.stopDialog());

    await screen.press('Dashboard');

    expect(notice(screen)).toBe(true);
  });
});
