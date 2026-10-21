/**
 * The vendor's team (PROJECT_BIBLE.md section 39, Phase 3E-7), through the real
 * VendorNavigator and the real mock team service.
 *
 * Pinned here:
 *
 * - the Team tab is the team, and Profile's "Manage team" opens it; the tab bar
 *   is unchanged
 * - each member reads as one block (name, role, phone when there is one), with
 *   Edit and Remove named for them
 * - nobody yet is section 48's sentence with its one Add
 * - loading, a failed first read and its retry (once, however often pressed),
 *   a failed pull keeping the team under a notice, and a read on returning
 * - adding: required fields said under each field and nothing sent; success
 *   said and the member listed; a failure keeps every value; Save sends once
 * - editing: opens on the stored details; saves; a failure keeps the edits;
 *   Save sends once; a member no longer on the team says so; leaving unsaved
 *   asks first
 * - removing: asks first; Cancel sends nothing; success said and the team the
 *   service answered with drawn; a failure leaves the member; one call however
 *   often confirmed
 * - one vendor never sees another's team, and a route cannot reach it
 * - status (section 39): a disabled member's card carries a "Disabled" badge
 *   and says so in its block, an active one nothing, an unknown status
 *   "Status unavailable" and never the raw value; the order does not change.
 *   The edit form — never the add form — ends with the status: Disable asks
 *   first, Enable does not; either applies at once, once however often
 *   pressed, busy while it runs with Save waiting; success and failure are
 *   toasts; what was typed survives, and the change alone never wakes the
 *   discard guard; saving afterwards keeps the status
 * - the photo (section 39's Profile Image, 2026-10-21): the card shows it and
 *   says exactly what it said before; the form adds, replaces and removes it,
 *   uploads it when chosen, keeps everything typed when the upload fails,
 *   never saves while an upload runs nor uploads while a save does, and asks
 *   before a chosen photo is left behind
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  CommonActions,
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { setSessionStorage } from '@/core/storage/SessionStorage';
import { authReducer, signedIn } from '@/features/auth/state/authSlice';
import type { AuthUser } from '@/features/auth/types';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { TeamMemberFormScreen } from '@/features/vendor/screens/TeamMemberFormScreen';
import type { VendorStackParamList } from '@/navigation/types';
import { VendorNavigator } from '@/navigation/VendorNavigator';
import { ToastProvider } from '@/shared/components';
import { MockVendorDashboardService } from '@/shared/services/mock/MockVendorDashboardService';
import { MockVendorProfileService } from '@/shared/services/mock/MockVendorProfileService';
import { MockVendorRequestService } from '@/shared/services/mock/MockVendorRequestService';
import { MockVendorTeamService } from '@/shared/services/mock/MockVendorTeamService';
import { NO_LATENCY } from '@/shared/services/mock/mockUtils';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService } from '@/shared/services/types/CategoryService';
import type { ImageAsset, ImageService } from '@/shared/services/types/ImageService';
import type { TeamMember } from '@/shared/services/types/VendorTeamService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const COPY = VENDOR_COPY.team;
const FORM = VENDOR_COPY.teamForm;
const RULES = VENDOR_COPY.validation;
const PROFILE = VENDOR_COPY.profile;

const RAVI: AuthUser = {
  id: 'usr_vendor_1',
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '9000000001',
  role: 'vendor',
};

const MEENA: AuthUser = {
  id: 'usr_vendor_2',
  firstName: 'Meena',
  lastName: 'Iyer',
  phone: '9000000002',
  role: 'vendor',
};

/** Ravi's starting team, by name, in order. */
const RAVI_NAMES = [
  'Suresh Naik',
  'Venkata Subrahmanya Lakshmi Narasimhamurthy-Ramachandran',
  'Farhan Ali',
];

/** Anything that would assign, schedule, pay, track or invite. None may exist. */
const OUT_OF_SCOPE = /assign|dispatch|schedule|availability|attendance|salary|payroll|invite|permission|location/i;

const offline = () => new AppError({ kind: 'network', message: 'offline' });

let current: AuthUser;
let team: MockVendorTeamService;

beforeEach(async () => {
  resetServices();
  current = RAVI;
  const currentUser = async () => current;

  const profiles = new MockVendorProfileService({ latency: NO_LATENCY, currentUser });
  registerService('vendorProfile', profiles);
  registerService('vendorRequests', new MockVendorRequestService({ latency: NO_LATENCY, currentUser }));
  registerService('vendorDashboard', new MockVendorDashboardService({ latency: NO_LATENCY, currentUser }));
  registerService('category', {
    listServiceCategories: jest.fn(async () => [{ id: 'cat_electrician', name: 'Electrician' }]),
    listSubCategories: jest.fn(async () => []),
  } as CategoryService);

  team = new MockVendorTeamService({ latency: NO_LATENCY, currentUser });
  registerService('vendorTeam', team);

  setSessionStorage({
    read: async () => ({ token: 'token', user: current }),
    write: async () => undefined,
    clear: async () => undefined,
  });

  // Both vendors have finished setup: this suite is about what comes after it.
  await profiles.saveProfile({ businessName: 'Kumar Electricals', serviceCategoryIds: ['cat_electrician'] });
  current = MEENA;
  await profiles.saveProfile({ businessName: 'Iyer Interiors', serviceCategoryIds: ['cat_electrician'] });
  current = RAVI;
});

type Instance = ReactTestRenderer.ReactTestInstance;

/*
  Unmounted after every test: a tree left loading leaves the placeholders
  animating, and switching tabs leaves work scheduled.
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
  for (let i = 0; i < 6; i += 1) {
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

/** Renders the vendor application and, unless told otherwise, opens the Team tab. */
async function render({ open = true }: { open?: boolean } = {}) {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(signedIn({ token: 'token', user: current }));
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

  const list = () =>
    renderer.root.findAll(
      node => node.props?.testID === 'vendor-team-list' && 'data' in (node.props ?? {}),
    )[0];

  const field = (id: string) => {
    const [target] = renderer.root.findAll(
      node => node.props?.testID === id && typeof node.props?.onChangeText === 'function',
    );
    if (!target) {
      throw new Error(`No field "${id}"`);
    }
    return target;
  };

  const screen = {
    renderer,
    navigation,
    host,
    has,
    pressable,
    press,
    list,
    field,
    flush,
    text: (id: string) => (has(id) ? textOf(host(id)) : ''),
    /** Who the list holds, read from its data: a FlatList mounts only its first screenful. */
    members: (): TeamMember[] => list().props.data as TeamMember[],
    names: () => screen.members().map(member => member.name),
    /** The placeholders in the loading region, which is not the list. */
    placeholders: (): number =>
      has('vendor-team-loading') ? host('vendor-team-loading').children.length : 0,
    /**
     * The testID of every native view on the team screen that says it is busy
     * — the other tabs stay mounted, so only this screen's subtree is read.
     *
     * Ids, not the nodes: a failed match on a test instance makes jest print it,
     * and printing one walks the whole fiber tree — the run never finishes.
     */
    busy: (): Array<string | undefined> =>
      host('vendor-team')
        .findAll(
          node => typeof node.type === 'string' && node.props?.accessibilityState?.busy === true,
        )
        .map(node => node.props.testID),
    /** The one spoken block a card's details are. */
    details: (memberId: string) =>
      host(`team-member-${memberId}`).findAll(
        node => typeof node.type === 'string' && node.props?.accessible === true,
      )[0]?.props.accessibilityLabel,
    toast: (): string | undefined =>
      renderer.root.findAll(
        node =>
          node.props?.accessibilityHint === 'Dismisses this message' &&
          typeof node.props.onPress === 'function',
      )[0]?.props.accessibilityLabel,
    type: async (id: string, value: string) => {
      await act(async () => {
        field(id).props.onChangeText(value);
      });
    },
    /** The message a field is showing, if any. */
    fieldError: (id: string): string | undefined =>
      renderer.root.findAll(node => node.props?.testID === id && 'error' in (node.props ?? {}))[0]
        ?.props.error,
    /**
     * The form, to press within: the team list stays mounted underneath it, and
     * its "Add team member" has the same words as the form's Save.
     */
    form: () => host('team-member-form'),
    pull: async () => {
      await act(async () => {
        list().props.onRefresh();
      });
      await flush();
    },
    switchTo: async (user: AuthUser) => {
      current = user;
      await act(async () => {
        store.dispatch(signedIn({ token: 'token', user }));
      });
      await flush();
    },
    openTeam: () => screen.press('Team'),
    /** Within the remove dialog, so its Remove is never confused with a card's. */
    dialog: () => host('vendor-team-remove-dialog'),
    onForm: () => has('team-member-form'),
  };

  if (open) {
    await screen.openTeam();
  }

  return screen;
}

type Screen = Awaited<ReturnType<typeof render>>;

/** Fills the add form and saves it. */
async function addThroughForm(screen: Screen, values: { name: string; role: string; phone?: string }) {
  await screen.press(COPY.add);
  await screen.type('team-member-name', values.name);
  await screen.type('team-member-role', values.role);
  if (values.phone !== undefined) {
    await screen.type('team-member-phone', values.phone);
  }
  await screen.press(FORM.saveAdd, screen.form());
}

describe('Vendor team — getting there', () => {
  it('is the Team tab', async () => {
    const screen = await render();

    expect(screen.has('vendor-team')).toBe(true);
    expect(screen.text('vendor-team-heading')).toBe(COPY.title);
    expect(screen.names()).toEqual(RAVI_NAMES);
  });

  it('is what Profile’s "Manage team" opens', async () => {
    const screen = await render({ open: false });
    await screen.press('Profile');

    const [button] = screen.pressable(PROFILE.team);
    expect(button.props.accessibilityHint).toBe(PROFILE.teamHint);

    await screen.press(PROFILE.team);
    expect(screen.has('vendor-team')).toBe(true);
    expect(screen.names()).toEqual(RAVI_NAMES);
  });

  it('keeps the tab bar to Dashboard, Requests, Team and Profile', async () => {
    const screen = await render();

    for (const tab of ['Dashboard', 'Requests', 'Team', 'Profile']) {
      expect(screen.pressable(tab).length).toBeGreaterThan(0);
    }
    expect(screen.text('vendor-team')).not.toContain('Not built yet');
  });
});

describe('Vendor team — the list', () => {
  it('says each member as one block — the phone only when there is one', async () => {
    const screen = await render();

    expect(screen.details('tm_1')).toBe('Suresh Naik, Senior technician. Phone 9000000101');
    expect(screen.details('tm_3')).toBe('Farhan Ali, Helper');
    expect(screen.has('team-member-tm_3-phone')).toBe(false);
    expect(screen.text('team-member-tm_1-phone')).toBe('9000000101');
  });

  it('draws a long name and role whole in what is said', async () => {
    const screen = await render();

    expect(screen.details('tm_2')).toBe(
      'Venkata Subrahmanya Lakshmi Narasimhamurthy-Ramachandran, Installation and wiring specialist, weekend shifts. Phone 9000000102',
    );
    expect(screen.host('team-member-tm_2-name').props.numberOfLines).toBe(2);
  });

  it('names every action for the member it acts on', async () => {
    const screen = await render();

    for (const name of RAVI_NAMES) {
      expect(screen.pressable(COPY.editSpoken(name)).length).toBeGreaterThan(0);
      expect(screen.pressable(COPY.removeSpoken(name)).length).toBeGreaterThan(0);
    }
  });

  it('offers one Add, over the team', async () => {
    const screen = await render();

    // One button: its composite and its pressable both carry the label and the handler.
    const adds = screen.pressable(COPY.add).filter(node => node.props.accessibilityRole === 'button');
    expect(new Set(adds.map(node => node.props.onPress)).size).toBe(1);
    expect(screen.has('vendor-team-empty')).toBe(false);
  });

  it('offers nothing beyond the team itself', async () => {
    const screen = await render();

    expect(screen.text('vendor-team')).not.toMatch(OUT_OF_SCOPE);
    const controls = screen
      .host('vendor-team')
      .findAll(node => typeof node.props?.onPress === 'function')
      .map(node => String(node.props.accessibilityLabel ?? ''));
    expect(controls.join(' ')).not.toMatch(OUT_OF_SCOPE);
  });

  it('leaves the list unnamed, so it is no stop of its own, with nothing busy', async () => {
    // The list used to be named on every render — "Your team" once loaded — so
    // TalkBack stopped on it to say what the heading had just said.
    const screen = await render();

    expect(screen.names()).toEqual(RAVI_NAMES);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.list().props.accessibilityRole).toBeUndefined();
    expect(screen.busy()).toEqual([]);
  });
});

describe('Vendor team — nobody yet', () => {
  it('says so in section 48’s words, with the one Add', async () => {
    current = MEENA;
    const screen = await render();

    expect(screen.has('vendor-team-empty')).toBe(true);
    expect(screen.text('vendor-team-empty')).toContain(COPY.emptyTitle);
    expect(screen.text('vendor-team-empty')).toContain(COPY.emptyMessage);
    // The empty state's own Add, and no second one over it.
    expect(screen.pressable(COPY.add, screen.host('vendor-team-empty')).length).toBeGreaterThan(0);
    expect(
      screen.pressable(COPY.add).filter(
        node => !screen.host('vendor-team-empty').findAll(inner => inner === node).length,
      ),
    ).toHaveLength(0);
    expect(screen.names()).toEqual([]);
    // Its own words, under a list that is still no stop of its own.
    expect(screen.has('vendor-team-loading')).toBe(false);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.busy()).toEqual([]);
  });

  it('opens the add form from the empty team', async () => {
    current = MEENA;
    const screen = await render();

    await screen.press(COPY.add);

    expect(screen.onForm()).toBe(true);
    expect(screen.text('team-member-form-heading')).toBe(FORM.addTitle);
  });
});

describe('Vendor team — loading and failing', () => {
  it('fills the list with placeholders, named and busy, until the team arrives', async () => {
    const answer = held<TeamMember[]>();
    const listMembers = jest.spyOn(team, 'listMembers').mockReturnValueOnce(answer.promise);
    const screen = await render();

    expect(screen.placeholders()).toBeGreaterThan(0);
    // One region says the wait once, named and busy — not the list itself.
    const waiting = screen.host('vendor-team-loading');
    expect(waiting.props.accessibilityLabel).toBe(COPY.loading);
    expect(waiting.props.accessibilityState).toEqual({ busy: true });
    expect(screen.busy()).toEqual(['vendor-team-loading']);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.list().props.accessibilityRole).toBeUndefined();
    expect(screen.has('vendor-team-empty')).toBe(false);
    expect(screen.pressable(COPY.add)).toHaveLength(0);

    listMembers.mockRestore();
    await act(async () => {
      answer.land(await team.listMembers());
    });
    await screen.flush();

    expect(screen.names()).toEqual(RAVI_NAMES);
    // Not hidden or emptied: no longer in the tree at all, so its busy cannot outlive it.
    expect(screen.has('vendor-team-loading')).toBe(false);
    expect(screen.list() === waiting).toBe(false);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.list().props.accessibilityRole).toBeUndefined();
    // Nothing anywhere on the loaded screen still says busy.
    expect(screen.busy()).toEqual([]);
  });

  it('says a failed first read failed, with a retry and no pull or Add over it', async () => {
    jest.spyOn(team, 'listMembers').mockRejectedValueOnce(offline());
    const screen = await render();

    expect(screen.has('vendor-team-error')).toBe(true);
    expect(screen.text('vendor-team-error')).toContain(COPY.failedTitle);
    expect(screen.text('vendor-team-error')).not.toContain('offline');
    expect(screen.has('vendor-team-empty')).toBe(false);
    expect(screen.pressable(COPY.add)).toHaveLength(0);
    expect(screen.list().props.onRefresh).toBeUndefined();
    // Its own words, under a list that is still no stop of its own.
    expect(screen.has('vendor-team-loading')).toBe(false);
    expect(screen.list().props.accessibilityLabel).toBeUndefined();
    expect(screen.list().props.accessibilityState).toBeUndefined();
    expect(screen.busy()).toEqual([]);
  });

  it('reads again on Try again — even after failing at once, twice', async () => {
    const listMembers = jest
      .spyOn(team, 'listMembers')
      .mockRejectedValueOnce(offline())
      .mockRejectedValueOnce(offline())
      .mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.press('Try again');
    await screen.press('Try again');
    await screen.press('Try again');

    expect(listMembers).toHaveBeenCalledTimes(4);
    expect(screen.names()).toEqual(RAVI_NAMES);
  });

  it('tries again once, however often Try again is pressed', async () => {
    const listMembers = jest.spyOn(team, 'listMembers').mockRejectedValueOnce(offline());
    const screen = await render();

    const [retry] = screen.pressable('Try again');
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        retry.props.onPress();
      }
    });
    await screen.flush();

    expect(listMembers).toHaveBeenCalledTimes(2);
    expect(screen.names()).toEqual(RAVI_NAMES);
  });
});

describe('Vendor team — reading again', () => {
  it('reads again on a pull, once for two pulls in a row', async () => {
    const listMembers = jest.spyOn(team, 'listMembers');
    const screen = await render();

    await act(async () => {
      screen.list().props.onRefresh();
      screen.list().props.onRefresh();
    });
    await screen.flush();

    expect(listMembers).toHaveBeenCalledTimes(2);
  });

  it('keeps the team and says it may be out of date when a pull fails, until a read works', async () => {
    const screen = await render();
    jest.spyOn(team, 'listMembers').mockRejectedValueOnce(offline());

    await screen.pull();

    expect(screen.names()).toEqual(RAVI_NAMES);
    expect(screen.has('vendor-team-stale')).toBe(true);
    expect(screen.text('vendor-team-stale')).toContain(COPY.staleMessage);

    await screen.press(COPY.staleRetry, screen.host('vendor-team-stale'));
    expect(screen.has('vendor-team-stale')).toBe(false);
  });

  it('reads again on returning to the tab, but not on first opening it', async () => {
    const listMembers = jest.spyOn(team, 'listMembers');
    const screen = await render();
    expect(listMembers).toHaveBeenCalledTimes(1);

    await screen.press('Dashboard');
    await screen.openTeam();

    expect(listMembers).toHaveBeenCalledTimes(2);
  });
});

describe('Vendor team — adding', () => {
  it('says what is missing under each field, and sends nothing', async () => {
    const addMember = jest.spyOn(team, 'addMember');
    const screen = await render();

    await screen.press(COPY.add);
    await screen.press(FORM.saveAdd, screen.form());

    expect(screen.fieldError('team-member-name')).toBe(RULES.memberNameRequired);
    expect(screen.fieldError('team-member-role')).toBe(RULES.memberRoleRequired);
    expect(screen.fieldError('team-member-phone')).toBeUndefined();
    expect(screen.has('team-member-fix-errors')).toBe(true);
    expect(addMember).not.toHaveBeenCalled();
    expect(screen.onForm()).toBe(true);
  });

  it('holds a typed phone to the phone rule, and sends nothing', async () => {
    const addMember = jest.spyOn(team, 'addMember');
    const screen = await render();

    await screen.press(COPY.add);
    await screen.type('team-member-name', 'Kiran Rao');
    await screen.type('team-member-role', 'Apprentice');
    await screen.type('team-member-phone', '12345');
    await screen.press(FORM.saveAdd, screen.form());

    expect(screen.fieldError('team-member-phone')).toBe('That number looks too short. Please check it.');
    expect(addMember).not.toHaveBeenCalled();
  });

  it('adds the member, says so, and lists them on the team', async () => {
    const addMember = jest.spyOn(team, 'addMember');
    const screen = await render();

    await addThroughForm(screen, { name: '  Kiran Rao ', role: 'Apprentice', phone: '90000 00104' });

    expect(addMember).toHaveBeenCalledTimes(1);
    expect(addMember).toHaveBeenCalledWith({ name: 'Kiran Rao', role: 'Apprentice', phone: '9000000104' });
    expect(screen.toast()).toBe(FORM.added);
    expect(screen.onForm()).toBe(false);
    expect(screen.names()).toEqual([...RAVI_NAMES, 'Kiran Rao']);
  });

  it('sends no phone at all when none was typed', async () => {
    const addMember = jest.spyOn(team, 'addMember');
    const screen = await render();

    await addThroughForm(screen, { name: 'Kiran Rao', role: 'Apprentice' });

    expect(Object.keys(addMember.mock.calls[0][0]).sort()).toEqual(['name', 'role']);
  });

  it('keeps everything typed when adding fails, and Save tries again', async () => {
    const addMember = jest.spyOn(team, 'addMember').mockRejectedValueOnce(offline());
    const screen = await render();

    await addThroughForm(screen, { name: 'Kiran Rao', role: 'Apprentice', phone: '9000000104' });

    expect(screen.onForm()).toBe(true);
    expect(screen.has('team-member-save-error')).toBe(true);
    expect(screen.text('team-member-save-error')).toContain(FORM.saveFailedTitle);
    expect(screen.field('team-member-name').props.value).toBe('Kiran Rao');
    expect(screen.field('team-member-role').props.value).toBe('Apprentice');
    expect(screen.field('team-member-phone').props.value).toBe('9000000104');

    await screen.press(FORM.saveAdd, screen.form());

    expect(addMember).toHaveBeenCalledTimes(2);
    expect(screen.onForm()).toBe(false);
    expect(screen.names()).toEqual([...RAVI_NAMES, 'Kiran Rao']);
  });

  it('adds once, however often Save is pressed', async () => {
    const answer = held<TeamMember[]>();
    const addMember = jest.spyOn(team, 'addMember').mockReturnValueOnce(answer.promise);
    const screen = await render();

    await screen.press(COPY.add);
    await screen.type('team-member-name', 'Kiran Rao');
    await screen.type('team-member-role', 'Apprentice');
    const [save] = screen.pressable(FORM.saveAdd, screen.form());
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        save.props.onPress();
      }
    });
    await screen.flush();

    expect(addMember).toHaveBeenCalledTimes(1);

    addMember.mockRestore();
    await act(async () => {
      answer.land(await team.addMember({ name: 'Kiran Rao', role: 'Apprentice' }));
    });
    await screen.flush();

    expect(screen.onForm()).toBe(false);
  });
});

describe('Vendor team — editing', () => {
  it('opens on the member’s stored details', async () => {
    const screen = await render();

    await screen.press(COPY.editSpoken('Suresh Naik'));

    expect(screen.text('team-member-form-heading')).toBe(FORM.editTitle);
    expect(screen.field('team-member-name').props.value).toBe('Suresh Naik');
    expect(screen.field('team-member-role').props.value).toBe('Senior technician');
    expect(screen.field('team-member-phone').props.value).toBe('9000000101');
  });

  it('saves the change, says so, and the team shows it in the same place', async () => {
    const updateMember = jest.spyOn(team, 'updateMember');
    const screen = await render();

    await screen.press(COPY.editSpoken('Suresh Naik'));
    await screen.type('team-member-role', 'Supervisor');
    await screen.press(FORM.saveEdit, screen.form());

    expect(updateMember).toHaveBeenCalledWith('tm_1', {
      name: 'Suresh Naik',
      role: 'Supervisor',
      phone: '9000000101',
    });
    expect(screen.toast()).toBe(FORM.saved);
    expect(screen.onForm()).toBe(false);
    expect(screen.members()[0]).toEqual({
      id: 'tm_1',
      name: 'Suresh Naik',
      role: 'Supervisor',
      phone: '9000000101',
      status: 'ACTIVE',
    });
  });

  it('keeps the edits when saving fails, and changes nobody', async () => {
    jest.spyOn(team, 'updateMember').mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.press(COPY.editSpoken('Suresh Naik'));
    await screen.type('team-member-role', 'Supervisor');
    await screen.press(FORM.saveEdit, screen.form());

    expect(screen.onForm()).toBe(true);
    expect(screen.has('team-member-save-error')).toBe(true);
    expect(screen.field('team-member-role').props.value).toBe('Supervisor');
    expect((await team.listMembers())[0].role).toBe('Senior technician');
  });

  it('saves once, however often Save is pressed', async () => {
    const answer = held<TeamMember[]>();
    const updateMember = jest.spyOn(team, 'updateMember').mockReturnValueOnce(answer.promise);
    const screen = await render();

    await screen.press(COPY.editSpoken('Suresh Naik'));
    await screen.type('team-member-role', 'Supervisor');
    const [save] = screen.pressable(FORM.saveEdit, screen.form());
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        save.props.onPress();
      }
    });
    await screen.flush();

    expect(updateMember).toHaveBeenCalledTimes(1);

    updateMember.mockRestore();
    await act(async () => {
      answer.land(await team.listMembers());
    });
    await screen.flush();
  });

  it('asks before leaving with unsaved changes — and leaves at once without any', async () => {
    const screen = await render();

    await screen.press(COPY.editSpoken('Suresh Naik'));
    await screen.press(FORM.back);
    expect(screen.onForm()).toBe(false);

    await screen.press(COPY.editSpoken('Suresh Naik'));
    await screen.type('team-member-role', 'Supervisor');
    await screen.press(FORM.back);
    expect(screen.onForm()).toBe(true);
    expect(screen.pressable(FORM.discardKeep)).toHaveLength(1);

    await screen.press(FORM.discardKeep);
    expect(screen.onForm()).toBe(true);
    expect(screen.field('team-member-role').props.value).toBe('Supervisor');

    await screen.press(FORM.back);
    await screen.press(FORM.discardConfirm);
    expect(screen.onForm()).toBe(false);
    expect(screen.members()[0].role).toBe('Senior technician');
  });

  it('says a member is no longer on the team, with no form', async () => {
    const screen = await render();

    await act(async () => {
      screen.navigation.dispatch(
        CommonActions.navigate({ name: 'EditTeamMember', params: { memberId: 'tm_404' } }),
      );
    });
    await screen.flush();

    expect(screen.has('team-member-form-not-found')).toBe(true);
    expect(screen.text('team-member-form-not-found')).toContain(FORM.notFoundTitle);
    expect(screen.pressable(FORM.saveEdit)).toHaveLength(0);
  });

  it('says a member could not be read, and reads again on Try again', async () => {
    const screen = await render();
    jest.spyOn(team, 'listMembers').mockRejectedValueOnce(offline());

    await screen.press(COPY.editSpoken('Suresh Naik'));
    expect(screen.has('team-member-form-error')).toBe(true);

    await screen.press('Try again', screen.host('team-member-form'));
    expect(screen.field('team-member-name').props.value).toBe('Suresh Naik');
  });
});

describe('Vendor team — removing', () => {
  it('asks first, naming the member; Cancel sends nothing', async () => {
    const removeMember = jest.spyOn(team, 'removeMember');
    const screen = await render();

    await screen.press(COPY.removeSpoken('Suresh Naik'));

    expect(screen.has('vendor-team-remove-dialog')).toBe(true);
    expect(textOf(screen.dialog())).toContain(COPY.removeTitle);
    expect(textOf(screen.dialog())).toContain(COPY.removeMessage('Suresh Naik'));

    await screen.press(COPY.removeCancel, screen.dialog());

    expect(screen.has('vendor-team-remove-dialog')).toBe(false);
    expect(removeMember).not.toHaveBeenCalled();
    expect(screen.names()).toEqual(RAVI_NAMES);
  });

  it('removes once confirmed, says so, and shows the team the service answered with', async () => {
    const removeMember = jest.spyOn(team, 'removeMember');
    const listMembers = jest.spyOn(team, 'listMembers');
    const screen = await render();

    await screen.press(COPY.removeSpoken('Suresh Naik'));
    await screen.press(COPY.removeConfirm, screen.dialog());

    expect(removeMember).toHaveBeenCalledWith('tm_1');
    expect(screen.toast()).toBe(COPY.removed);
    expect(screen.names()).toEqual(RAVI_NAMES.slice(1));
    // The removal's own answer refreshed the list: no second read was needed.
    expect(listMembers).toHaveBeenCalledTimes(1);
  });

  it('leaves the member where they were when removal fails, and says why', async () => {
    jest.spyOn(team, 'removeMember').mockRejectedValueOnce(offline());
    const screen = await render();

    await screen.press(COPY.removeSpoken('Suresh Naik'));
    await screen.press(COPY.removeConfirm, screen.dialog());

    expect(screen.toast()).toBe(`${COPY.removeFailed} ${offline().userMessage}`);
    expect(screen.names()).toEqual(RAVI_NAMES);
    // The member's Remove is the retry.
    expect(screen.pressable(COPY.removeSpoken('Suresh Naik'))[0].props.disabled).not.toBe(true);
  });

  it('removes once, however often it is confirmed, holding every action meanwhile', async () => {
    const answer = held<TeamMember[]>();
    const removeMember = jest.spyOn(team, 'removeMember').mockReturnValueOnce(answer.promise);
    const screen = await render();

    await screen.press(COPY.removeSpoken('Suresh Naik'));
    const [confirm] = screen.pressable(COPY.removeConfirm, screen.dialog());
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        confirm.props.onPress();
      }
    });
    await screen.flush();

    expect(removeMember).toHaveBeenCalledTimes(1);
    expect(screen.pressable(COPY.removeSpoken('Farhan Ali'))[0].props.disabled).toBe(true);
    expect(screen.pressable(COPY.editSpoken('Farhan Ali'))[0].props.disabled).toBe(true);

    removeMember.mockRestore();
    await act(async () => {
      answer.land(await team.removeMember('tm_1'));
    });
    await screen.flush();

    expect(screen.names()).toEqual(RAVI_NAMES.slice(1));
  });

  it('never lets a read from before the removal bring the member back', async () => {
    const screen = await render();
    const read = held<TeamMember[]>();
    const before = await team.listMembers();
    jest.spyOn(team, 'listMembers').mockReturnValueOnce(read.promise);

    // A pull is in the air, holding the team as it was …
    await act(async () => {
      screen.list().props.onRefresh();
    });
    // … when the removal is confirmed and answered.
    await screen.press(COPY.removeSpoken('Suresh Naik'));
    await screen.press(COPY.removeConfirm, screen.dialog());
    expect(screen.names()).toEqual(RAVI_NAMES.slice(1));

    await act(async () => {
      read.land(before);
    });
    await screen.flush();

    expect(screen.names()).toEqual(RAVI_NAMES.slice(1));
  });

  it('shows the empty team once the last member is removed', async () => {
    current = MEENA;
    await team.addMember({ name: 'Leela Das', role: 'Helper' });
    const screen = await render();

    const [leela] = screen.members();
    await screen.press(COPY.removeSpoken(leela.name));
    await screen.press(COPY.removeConfirm, screen.dialog());

    expect(screen.has('vendor-team-empty')).toBe(true);
  });
});

describe('Vendor team — whose team', () => {
  it('shows each vendor their own team, and never the last vendor’s', async () => {
    const screen = await render();
    await addThroughForm(screen, { name: 'Kiran Rao', role: 'Apprentice' });
    expect(screen.names()).toEqual([...RAVI_NAMES, 'Kiran Rao']);

    await screen.switchTo(MEENA);
    await screen.openTeam();
    expect(screen.names()).toEqual([]);
    expect(screen.text('vendor-team')).not.toContain('Kiran Rao');
    await addThroughForm(screen, { name: 'Leela Das', role: 'Helper' });
    expect(screen.names()).toEqual(['Leela Das']);

    await screen.switchTo(RAVI);
    await screen.openTeam();
    expect(screen.names()).toEqual([...RAVI_NAMES, 'Kiran Rao']);
  });

  it('cannot open or change another vendor’s member through a route', async () => {
    const updateMember = jest.spyOn(team, 'updateMember');
    current = MEENA;
    const screen = await render();

    await act(async () => {
      screen.navigation.dispatch(
        CommonActions.navigate({ name: 'EditTeamMember', params: { memberId: 'tm_1' } }),
      );
    });
    await screen.flush();

    expect(screen.has('team-member-form-not-found')).toBe(true);
    expect(screen.text('team-member-form')).not.toContain('Suresh Naik');
    expect(updateMember).not.toHaveBeenCalled();
  });
});

describe('Vendor team — status on the card', () => {
  /** Whether a node sits inside a part hidden from assistive technology. */
  const isHidden = (node: Instance): boolean => {
    for (let at: Instance | null = node.parent; at; at = at.parent) {
      if (at.props?.importantForAccessibility === 'no-hide-descendants') {
        return true;
      }
    }
    return false;
  };

  it('marks a disabled member with a badge, and says it in their block', async () => {
    await team.setMemberStatus('tm_3', 'DISABLED');
    const screen = await render();

    expect(screen.text('team-member-tm_3-status')).toBe(COPY.statusDisabled);
    expect(screen.details('tm_3')).toBe('Farhan Ali, Helper. Disabled');
    // Said once, as part of the block: the badge itself is not a second stop.
    expect(isHidden(screen.host('team-member-tm_3-status'))).toBe(true);
  });

  it('draws nothing for an active member', async () => {
    await team.setMemberStatus('tm_3', 'DISABLED');
    const screen = await render();

    expect(screen.has('team-member-tm_1-status')).toBe(false);
    expect(screen.details('tm_1')).toBe('Suresh Naik, Senior technician. Phone 9000000101');
    expect(screen.text('team-member-tm_1')).not.toContain(COPY.statusActive);
  });

  it('keeps a disabled member in their place, with Edit and Remove as before', async () => {
    await team.setMemberStatus('tm_1', 'DISABLED');
    const screen = await render();

    expect(screen.names()).toEqual(RAVI_NAMES);
    expect(screen.pressable(COPY.editSpoken('Suresh Naik'))[0].props.disabled).not.toBe(true);
    expect(screen.pressable(COPY.removeSpoken('Suresh Naik'))[0].props.disabled).not.toBe(true);
  });

  it('says a status it does not know is unavailable, and never shows the raw value', async () => {
    const stored = await team.listMembers();
    jest
      .spyOn(team, 'listMembers')
      .mockResolvedValue(stored.map(member => (member.id === 'tm_1' ? { ...member, status: 'ON_LEAVE' } : member)));
    const screen = await render();

    expect(screen.text('team-member-tm_1-status')).toBe(COPY.statusUnknown);
    expect(screen.details('tm_1')).toBe(
      'Suresh Naik, Senior technician. Phone 9000000101. Status unavailable',
    );
    expect(screen.text('vendor-team')).not.toMatch(/ON_LEAVE|on leave/i);
  });
});

describe('Vendor team — changing the status on the edit form', () => {
  const disableDialog = (screen: Screen) => screen.host('team-member-disable-dialog');
  const statusBadge = (screen: Screen) => screen.text('team-member-status-badge');

  it('is not on the add form: a new member is always active', async () => {
    const screen = await render();

    await screen.press(COPY.add);

    expect(screen.onForm()).toBe(true);
    expect(screen.has('team-member-status')).toBe(false);
    expect(screen.pressable(FORM.disable)).toHaveLength(0);
    expect(screen.pressable(FORM.enable)).toHaveLength(0);
  });

  it('shows an active member as active, with Disable and no Enable', async () => {
    const screen = await render();

    await screen.press(COPY.editSpoken('Suresh Naik'));

    expect(screen.has('team-member-status')).toBe(true);
    expect(screen.text('team-member-status')).toContain(FORM.statusSection);
    expect(statusBadge(screen)).toBe(COPY.statusActive);
    expect(screen.pressable(FORM.disable, screen.form())).not.toHaveLength(0);
    expect(screen.pressable(FORM.disable, screen.form())[0].props.accessibilityHint).toBe(
      FORM.disableHint,
    );
    expect(screen.pressable(FORM.enable)).toHaveLength(0);
  });

  it('asks before disabling, naming the member; Cancel sends nothing', async () => {
    const setMemberStatus = jest.spyOn(team, 'setMemberStatus');
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));

    await screen.press(FORM.disable, screen.form());

    expect(screen.has('team-member-disable-dialog')).toBe(true);
    expect(textOf(disableDialog(screen))).toContain(FORM.disableTitle('Suresh Naik'));
    expect(textOf(disableDialog(screen))).toContain(FORM.disableMessage);

    await screen.press(FORM.disableCancel, disableDialog(screen));

    expect(screen.has('team-member-disable-dialog')).toBe(false);
    expect(setMemberStatus).not.toHaveBeenCalled();
    expect(statusBadge(screen)).toBe(COPY.statusActive);
  });

  it('disables at once once confirmed, says so, and stays on the form showing Enable', async () => {
    const setMemberStatus = jest.spyOn(team, 'setMemberStatus');
    const updateMember = jest.spyOn(team, 'updateMember');
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));

    await screen.press(FORM.disable, screen.form());
    await screen.press(FORM.disableConfirm, disableDialog(screen));

    expect(setMemberStatus).toHaveBeenCalledTimes(1);
    expect(setMemberStatus).toHaveBeenCalledWith('tm_1', 'DISABLED');
    expect(updateMember).not.toHaveBeenCalled();
    expect(screen.toast()).toBe(FORM.disabled);
    expect(screen.has('team-member-disable-dialog')).toBe(false);
    expect(screen.onForm()).toBe(true);
    expect(statusBadge(screen)).toBe(COPY.statusDisabled);
    expect(screen.pressable(FORM.enable, screen.form())).not.toHaveLength(0);
    expect(screen.pressable(FORM.disable)).toHaveLength(0);
    expect((await team.listMembers())[0].status).toBe('DISABLED');
  });

  it('enables a disabled member at once, without asking', async () => {
    await team.setMemberStatus('tm_3', 'DISABLED');
    const setMemberStatus = jest.spyOn(team, 'setMemberStatus');
    const screen = await render();
    await screen.press(COPY.editSpoken('Farhan Ali'));

    expect(statusBadge(screen)).toBe(COPY.statusDisabled);
    expect(screen.pressable(FORM.enable, screen.form())[0].props.accessibilityHint).toBe(FORM.enableHint);

    await screen.press(FORM.enable, screen.form());

    expect(screen.has('team-member-disable-dialog')).toBe(false);
    expect(setMemberStatus).toHaveBeenCalledTimes(1);
    expect(setMemberStatus).toHaveBeenCalledWith('tm_3', 'ACTIVE');
    expect(screen.toast()).toBe(FORM.enabled);
    expect(statusBadge(screen)).toBe(COPY.statusActive);
    expect(screen.pressable(FORM.disable, screen.form())).not.toHaveLength(0);
  });

  it('disables once however often it is confirmed, busy meanwhile, with Save waiting', async () => {
    const answer = held<TeamMember[]>();
    const setMemberStatus = jest.spyOn(team, 'setMemberStatus').mockReturnValueOnce(answer.promise);
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));
    await screen.press(FORM.disable, screen.form());

    const [confirm] = screen.pressable(FORM.disableConfirm, disableDialog(screen));
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        confirm.props.onPress();
      }
    });
    await screen.flush();

    expect(setMemberStatus).toHaveBeenCalledTimes(1);
    // The dialog stays, busy, and cannot be cancelled half-way.
    expect(screen.has('team-member-disable-dialog')).toBe(true);
    expect(
      screen.pressable(FORM.disableConfirm, disableDialog(screen))[0].props.accessibilityState,
    ).toMatchObject({ busy: true });
    expect(screen.pressable(FORM.disableCancel, disableDialog(screen))[0].props.disabled).toBe(true);
    expect(screen.pressable(FORM.saveEdit, screen.form())[0].props.disabled).toBe(true);

    setMemberStatus.mockRestore();
    await act(async () => {
      answer.land(await team.setMemberStatus('tm_1', 'DISABLED'));
    });
    await screen.flush();

    expect(screen.has('team-member-disable-dialog')).toBe(false);
    expect(statusBadge(screen)).toBe(COPY.statusDisabled);
    expect(screen.pressable(FORM.saveEdit, screen.form())[0].props.disabled).not.toBe(true);
  });

  it('enables once however often it is pressed, busy meanwhile, with Save waiting', async () => {
    await team.setMemberStatus('tm_3', 'DISABLED');
    const answer = held<TeamMember[]>();
    const setMemberStatus = jest.spyOn(team, 'setMemberStatus').mockReturnValueOnce(answer.promise);
    const screen = await render();
    await screen.press(COPY.editSpoken('Farhan Ali'));

    const [enable] = screen.pressable(FORM.enable, screen.form());
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        enable.props.onPress();
      }
    });
    await screen.flush();

    expect(setMemberStatus).toHaveBeenCalledTimes(1);
    expect(screen.pressable(FORM.enable, screen.form())[0].props.accessibilityState).toMatchObject({
      busy: true,
    });
    expect(screen.pressable(FORM.saveEdit, screen.form())[0].props.disabled).toBe(true);

    setMemberStatus.mockRestore();
    await act(async () => {
      answer.land(await team.setMemberStatus('tm_3', 'ACTIVE'));
    });
    await screen.flush();

    expect(statusBadge(screen)).toBe(COPY.statusActive);
    expect(screen.pressable(FORM.saveEdit, screen.form())[0].props.disabled).not.toBe(true);
  });

  it('waits while Save is running', async () => {
    const answer = held<TeamMember[]>();
    const updateMember = jest.spyOn(team, 'updateMember').mockReturnValueOnce(answer.promise);
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));
    await screen.type('team-member-role', 'Supervisor');
    await screen.press(FORM.saveEdit, screen.form());

    expect(screen.pressable(FORM.disable, screen.form())[0].props.disabled).toBe(true);

    updateMember.mockRestore();
    await act(async () => {
      answer.land(await team.listMembers());
    });
    await screen.flush();
  });

  it('says a failed change failed and leaves the status as it was; trying again works', async () => {
    jest.spyOn(team, 'setMemberStatus').mockRejectedValueOnce(offline());
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));

    await screen.press(FORM.disable, screen.form());
    await screen.press(FORM.disableConfirm, disableDialog(screen));

    expect(screen.toast()).toBe(`${FORM.disableFailed} ${offline().userMessage}`);
    expect(screen.has('team-member-disable-dialog')).toBe(false);
    expect(statusBadge(screen)).toBe(COPY.statusActive);
    expect(screen.pressable(FORM.disable, screen.form())[0].props.disabled).not.toBe(true);
    expect((await team.listMembers())[0].status).toBe('ACTIVE');

    await screen.press(FORM.disable, screen.form());
    await screen.press(FORM.disableConfirm, disableDialog(screen));

    expect(statusBadge(screen)).toBe(COPY.statusDisabled);
  });

  it('says a failed enable failed', async () => {
    await team.setMemberStatus('tm_3', 'DISABLED');
    jest.spyOn(team, 'setMemberStatus').mockRejectedValueOnce(offline());
    const screen = await render();
    await screen.press(COPY.editSpoken('Farhan Ali'));

    await screen.press(FORM.enable, screen.form());

    expect(screen.toast()).toBe(`${FORM.enableFailed} ${offline().userMessage}`);
    expect(statusBadge(screen)).toBe(COPY.statusDisabled);
  });

  it('keeps everything typed above it, through success and failure alike', async () => {
    jest.spyOn(team, 'setMemberStatus').mockRejectedValueOnce(offline());
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));
    await screen.type('team-member-name', 'Suresh N.');
    await screen.type('team-member-role', 'Supervisor');

    // Fails first, then works.
    await screen.press(FORM.disable, screen.form());
    await screen.press(FORM.disableConfirm, disableDialog(screen));
    await screen.press(FORM.disable, screen.form());
    await screen.press(FORM.disableConfirm, disableDialog(screen));

    expect(statusBadge(screen)).toBe(COPY.statusDisabled);
    expect(screen.field('team-member-name').props.value).toBe('Suresh N.');
    expect(screen.field('team-member-role').props.value).toBe('Supervisor');
    expect(screen.field('team-member-phone').props.value).toBe('9000000101');
    // The typing is still unsaved, and the guard still guards it.
    await screen.press(FORM.back);
    expect(screen.onForm()).toBe(true);
    expect(screen.pressable(FORM.discardKeep)).toHaveLength(1);
  });

  it('never wakes the discard guard by itself', async () => {
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));

    await screen.press(FORM.disable, screen.form());
    await screen.press(FORM.disableConfirm, disableDialog(screen));
    await screen.press(FORM.back);

    expect(screen.onForm()).toBe(false);
    expect(screen.pressable(FORM.discardKeep)).toHaveLength(0);
  });

  it('saves details afterwards without touching the status, and the team shows the badge', async () => {
    const updateMember = jest.spyOn(team, 'updateMember');
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));
    await screen.type('team-member-role', 'Supervisor');

    await screen.press(FORM.disable, screen.form());
    await screen.press(FORM.disableConfirm, disableDialog(screen));
    await screen.press(FORM.saveEdit, screen.form());

    expect(Object.keys(updateMember.mock.calls[0][1]).sort()).toEqual(['name', 'phone', 'role']);
    expect(screen.onForm()).toBe(false);
    expect(screen.members()[0]).toEqual({
      id: 'tm_1',
      name: 'Suresh Naik',
      role: 'Supervisor',
      phone: '9000000101',
      status: 'DISABLED',
    });
    expect(screen.details('tm_1')).toBe('Suresh Naik, Supervisor. Phone 9000000101. Disabled');
  });

  it('shows the change on the team after going back', async () => {
    const screen = await render();
    await screen.press(COPY.editSpoken('Farhan Ali'));

    await screen.press(FORM.disable, screen.form());
    await screen.press(FORM.disableConfirm, disableDialog(screen));
    await screen.press(FORM.back);

    expect(screen.text('team-member-tm_3-status')).toBe(COPY.statusDisabled);
    expect(screen.names()).toEqual(RAVI_NAMES);
  });

  it('offers Disable, never Enable, for a status it does not know', async () => {
    const stored = await team.listMembers();
    jest
      .spyOn(team, 'listMembers')
      .mockResolvedValue(stored.map(member => (member.id === 'tm_1' ? { ...member, status: 'ON_LEAVE' } : member)));
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));

    expect(statusBadge(screen)).toBe(COPY.statusUnknown);
    expect(screen.pressable(FORM.disable, screen.form())).not.toHaveLength(0);
    expect(screen.pressable(FORM.enable)).toHaveLength(0);
    expect(screen.text('team-member-form')).not.toMatch(/ON_LEAVE|on leave/i);
  });

  it('never calls a member whose status it does not know active', async () => {
    const stored = await team.listMembers();
    jest
      .spyOn(team, 'listMembers')
      .mockResolvedValue(stored.map(member => (member.id === 'tm_1' ? { ...member, status: 'ON_LEAVE' } : member)));
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));

    expect(screen.text('team-member-status-message')).toBe(FORM.statusUnknownMessage);
    expect(screen.text('team-member-status')).not.toMatch(/\bactive\b/i);

    await screen.press(FORM.disable, screen.form());
    const [cancel] = screen.pressable(FORM.disableCancel, disableDialog(screen));
    expect(cancel.props.accessibilityHint).toBe(FORM.disableCancelHint);
    expect(textOf(disableDialog(screen))).not.toMatch(/\bactive\b/i);
    expect(cancel.props.accessibilityHint).not.toMatch(/\bactive\b/i);
  });

  it('words each known status for what it is', async () => {
    await team.setMemberStatus('tm_3', 'DISABLED');
    const screen = await render();

    await screen.press(COPY.editSpoken('Suresh Naik'));
    expect(screen.text('team-member-status-message')).toBe(FORM.statusActiveMessage);
    await screen.press(FORM.back);

    await screen.press(COPY.editSpoken('Farhan Ali'));
    expect(screen.text('team-member-status-message')).toBe(FORM.statusDisabledMessage);
  });
});

describe('Vendor team — leaving while a change is being sent', () => {
  const currentRoute = (screen: Screen) => screen.navigation.getCurrentRoute()?.name;

  /**
   * Counts the form's own navigation calls from here on. `goBack` is its own
   * helper, not routed through `dispatch`, so both are watched. A second call
   * from a screen already gone is dropped by the router, so the route alone
   * cannot show it — the count can.
   */
  const watchFormNavigation = (screen: Screen) => {
    const formNavigation = screen.renderer.root.findByType(TeamMemberFormScreen).props.navigation;
    const dispatch = jest.spyOn(formNavigation, 'dispatch');
    const goBack = jest.spyOn(formNavigation, 'goBack');
    return () => dispatch.mock.calls.length + goBack.mock.calls.length;
  };

  it('holds Back while Enable is sent, then leaves once, to a team that shows the new status', async () => {
    await team.setMemberStatus('tm_3', 'DISABLED');
    const answer = held<TeamMember[]>();
    const setMemberStatus = jest.spyOn(team, 'setMemberStatus').mockReturnValueOnce(answer.promise);
    const listMembers = jest.spyOn(team, 'listMembers');
    const screen = await render();
    await screen.press(COPY.editSpoken('Farhan Ali'));
    const readsBefore = listMembers.mock.calls.length;

    await screen.press(FORM.enable, screen.form());
    await screen.press(FORM.back);

    // Held: still on the form, nothing asked, and the team has not read itself again.
    expect(currentRoute(screen)).toBe('EditTeamMember');
    expect(screen.onForm()).toBe(true);
    expect(screen.pressable(FORM.discardKeep)).toHaveLength(0);
    expect(listMembers).toHaveBeenCalledTimes(readsBefore);
    const navigations = watchFormNavigation(screen);

    // The write lands, then the answer.
    setMemberStatus.mockRestore();
    await act(async () => {
      answer.land(await team.setMemberStatus('tm_3', 'ACTIVE'));
    });
    await screen.flush();

    // Left once — to the Team tab, not past it — and the team read itself after the write.
    expect(navigations()).toBe(1);
    expect(screen.onForm()).toBe(false);
    expect(currentRoute(screen)).toBe('Team');
    expect(screen.toast()).toBe(FORM.enabled);
    expect(listMembers).toHaveBeenCalledTimes(readsBefore + 1);
    expect(screen.has('team-member-tm_3-status')).toBe(false);
    expect(screen.details('tm_3')).toBe('Farhan Ali, Helper');
  });

  it('holds Back while a status change fails, then leaves once, the status unchanged', async () => {
    await team.setMemberStatus('tm_3', 'DISABLED');
    const answer = held<TeamMember[]>();
    jest.spyOn(team, 'setMemberStatus').mockReturnValueOnce(answer.promise);
    const screen = await render();
    await screen.press(COPY.editSpoken('Farhan Ali'));

    await screen.press(FORM.enable, screen.form());
    await screen.press(FORM.back);
    expect(currentRoute(screen)).toBe('EditTeamMember');

    await act(async () => {
      answer.fail(offline());
    });
    await screen.flush();

    expect(screen.toast()).toBe(`${FORM.enableFailed} ${offline().userMessage}`);
    expect(currentRoute(screen)).toBe('Team');
    expect(screen.text('team-member-tm_3-status')).toBe(COPY.statusDisabled);
  });

  it('holds Back while Save is sent, then takes it as the save’s own way back — once', async () => {
    const answer = held<TeamMember[]>();
    const updateMember = jest.spyOn(team, 'updateMember').mockReturnValueOnce(answer.promise);
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));
    await screen.type('team-member-role', 'Supervisor');

    await screen.press(FORM.saveEdit, screen.form());
    await screen.press(FORM.back);

    expect(currentRoute(screen)).toBe('EditTeamMember');
    expect(screen.pressable(FORM.discardKeep)).toHaveLength(0);
    const navigations = watchFormNavigation(screen);

    updateMember.mockRestore();
    await act(async () => {
      answer.land(
        await team.updateMember('tm_1', { name: 'Suresh Naik', role: 'Supervisor', phone: '9000000101' }),
      );
    });
    await screen.flush();

    // The held leave is the save's way back — not the held leave and goBack as well.
    expect(navigations()).toBe(1);
    expect(screen.toast()).toBe(FORM.saved);
    expect(currentRoute(screen)).toBe('Team');
    expect(screen.members()[0].role).toBe('Supervisor');
  });

  it('asks about the unsaved typing when a Save that held Back fails', async () => {
    const answer = held<TeamMember[]>();
    jest.spyOn(team, 'updateMember').mockReturnValueOnce(answer.promise);
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));
    await screen.type('team-member-role', 'Supervisor');

    await screen.press(FORM.saveEdit, screen.form());
    await screen.press(FORM.back);
    await act(async () => {
      answer.fail(offline());
    });
    await screen.flush();

    expect(currentRoute(screen)).toBe('EditTeamMember');
    expect(screen.has('team-member-save-error')).toBe(true);
    expect(screen.field('team-member-role').props.value).toBe('Supervisor');
    expect(screen.pressable(FORM.discardKeep)).toHaveLength(1);

    await screen.press(FORM.discardConfirm);

    expect(currentRoute(screen)).toBe('Team');
    expect(screen.members()[0].role).toBe('Senior technician');
  });

  it('sends nothing after the form has gone', async () => {
    await team.setMemberStatus('tm_3', 'DISABLED');
    const answered = await team.setMemberStatus('tm_3', 'ACTIVE');
    await team.setMemberStatus('tm_3', 'DISABLED');
    const answer = held<TeamMember[]>();
    jest.spyOn(team, 'setMemberStatus').mockReturnValueOnce(answer.promise);
    const screen = await render();
    await screen.press(COPY.editSpoken('Farhan Ali'));
    // The form's own navigation, which a held leave would be sent through.
    const formNavigation = screen.renderer.root.findByType(TeamMemberFormScreen).props.navigation;
    const dispatch = jest.spyOn(formNavigation, 'dispatch');
    await screen.press(FORM.enable, screen.form());
    await screen.press(FORM.back);
    expect(dispatch).not.toHaveBeenCalled();

    await act(async () => {
      mounted.splice(mounted.indexOf(screen.renderer), 1);
      screen.renderer.unmount();
    });

    /*
      The tree is gone, toast provider and all, so the toast the answer raises
      would leave its dwell timer behind (in the app the provider outlives the
      form). Faked here, and cleared.
    */
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    try {
      answer.land(answered);
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }

      expect(dispatch).not.toHaveBeenCalled();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});

describe('Vendor team — saving and the status never overlap', () => {
  /*
    Each press below is the handler as drawn before the other change began —
    still enabled — so the button's own disabled state is out of the way and
    only the hook's ref guard can refuse it.
  */

  it('refuses a Save pressed while a status change is still being sent', async () => {
    await team.setMemberStatus('tm_3', 'DISABLED');
    const answer = held<TeamMember[]>();
    const setMemberStatus = jest.spyOn(team, 'setMemberStatus').mockReturnValueOnce(answer.promise);
    const updateMember = jest.spyOn(team, 'updateMember');
    const screen = await render();
    await screen.press(COPY.editSpoken('Farhan Ali'));
    await screen.type('team-member-role', 'Senior helper');
    const pressSave = screen.pressable(FORM.saveEdit, screen.form())[0].props.onPress;

    await screen.press(FORM.enable, screen.form());
    await act(async () => {
      pressSave();
    });
    await screen.flush();

    expect(setMemberStatus).toHaveBeenCalledTimes(1);
    expect(updateMember).not.toHaveBeenCalled();

    setMemberStatus.mockRestore();
    await act(async () => {
      answer.land(await team.setMemberStatus('tm_3', 'ACTIVE'));
    });
    await screen.flush();
  });

  it('refuses Enable pressed while a Save is still being sent', async () => {
    await team.setMemberStatus('tm_3', 'DISABLED');
    const answer = held<TeamMember[]>();
    const updateMember = jest.spyOn(team, 'updateMember').mockReturnValueOnce(answer.promise);
    const setMemberStatus = jest.spyOn(team, 'setMemberStatus');
    const screen = await render();
    await screen.press(COPY.editSpoken('Farhan Ali'));
    await screen.type('team-member-role', 'Senior helper');
    const pressEnable = screen.pressable(FORM.enable, screen.form())[0].props.onPress;

    await screen.press(FORM.saveEdit, screen.form());
    await act(async () => {
      pressEnable();
    });
    await screen.flush();

    expect(updateMember).toHaveBeenCalledTimes(1);
    expect(setMemberStatus).not.toHaveBeenCalled();

    updateMember.mockRestore();
    await act(async () => {
      answer.land(await team.listMembers());
    });
    await screen.flush();
  });

  it('refuses a Disable confirmed while a Save is still being sent', async () => {
    const answer = held<TeamMember[]>();
    const updateMember = jest.spyOn(team, 'updateMember').mockReturnValueOnce(answer.promise);
    const setMemberStatus = jest.spyOn(team, 'setMemberStatus');
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));
    await screen.type('team-member-role', 'Supervisor');
    await screen.press(FORM.disable, screen.form());
    const pressConfirm = screen.pressable(FORM.disableConfirm, screen.host('team-member-disable-dialog'))[0]
      .props.onPress;

    // On a phone Save is behind the dialog; pressed here, the hook is what must refuse.
    await act(async () => {
      screen.pressable(FORM.saveEdit, screen.form())[0].props.onPress();
    });
    await screen.flush();
    await act(async () => {
      pressConfirm();
    });
    await screen.flush();

    expect(updateMember).toHaveBeenCalledTimes(1);
    expect(setMemberStatus).not.toHaveBeenCalled();

    updateMember.mockRestore();
    await act(async () => {
      answer.land(await team.listMembers());
    });
    await screen.flush();
  });
});

/**
 * Section 39's Profile Image (2026-10-21), through the real form and the real
 * mock team service, with the device's picker and upload stubbed.
 */
describe('Vendor team — the photo', () => {
  const STORED = 'https://cdn.example.com/team/suresh.jpg';
  const UPLOADED = 'https://cdn.example.com/team/new.jpg';
  const SURESH = { name: 'Suresh Naik', role: 'Senior technician', phone: '9000000101' };

  const ASSET: ImageAsset = {
    id: 'img_1',
    uri: 'file:///cache/member.jpg',
    fileName: 'member.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1000,
    width: 800,
    height: 600,
  };

  let upload: jest.Mock;
  let pickFromCamera: jest.Mock;
  let pickFromGallery: jest.Mock;

  beforeEach(() => {
    upload = jest.fn(async () => ({ assetId: ASSET.id, remoteUrl: UPLOADED }));
    pickFromCamera = jest.fn(async () => [ASSET]);
    pickFromGallery = jest.fn(async () => [ASSET]);
    registerService('image', {
      pickFromCamera,
      pickFromGallery,
      validate: jest.fn(() => ({ valid: true })),
      compress: jest.fn(async (asset: ImageAsset) => asset),
      upload,
    } as unknown as ImageService);
  });

  /** The picture an avatar is drawing, or undefined when it draws initials. */
  const pictureOf = (screen: Screen, testID: string): unknown =>
    screen.renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.testID === testID && 'source' in node.props,
    )[0]?.props.source;

  /** Whether a node sits inside a block a screen reader cannot enter. */
  const hiddenFromScreenReader = (screen: Screen, testID: string): boolean => {
    const [node] = screen.renderer.root.findAll(
      candidate => typeof candidate.type === 'string' && candidate.props?.testID === testID,
    );
    for (let at = node?.parent ?? null; at; at = at.parent) {
      if (at.props?.importantForAccessibility === 'no-hide-descendants') {
        return true;
      }
    }
    return false;
  };

  const withStoredPhoto = () => team.updateMember('tm_1', { ...SURESH, photoUrl: STORED });

  it('shows a member’s photo on their card, and says the card exactly as before', async () => {
    await withStoredPhoto();
    const screen = await render();

    expect(pictureOf(screen, 'team-member-tm_1-avatar')).toEqual({ uri: STORED });
    // The same one sentence — "photo" is never a stop of its own.
    expect(screen.details('tm_1')).toBe(COPY.memberSpoken(SURESH.name, SURESH.role, SURESH.phone));
    expect(hiddenFromScreenReader(screen, 'team-member-tm_1-avatar')).toBe(true);
  });

  it('shows initials for a member with no photo', async () => {
    const screen = await render();

    expect(pictureOf(screen, 'team-member-tm_3-avatar')).toBeUndefined();
    expect(screen.text('team-member-tm_3-avatar')).toContain('FA');
  });

  it('opens the add form with the photo first, offering to add one and nothing to remove', async () => {
    const screen = await render();
    await screen.press(COPY.add);

    const order = screen
      .form()
      .findAll(
        node =>
          typeof node.type === 'string' &&
          (node.props?.testID === 'team-member-photo' || node.props?.testID === 'team-member-name'),
      )
      .map(node => node.props.testID);
    expect(order[0]).toBe('team-member-photo');
    expect(screen.pressable(FORM.photoAddCameraSpoken, screen.form()).length).toBeGreaterThan(0);
    expect(screen.pressable(FORM.photoAddGallerySpoken, screen.form()).length).toBeGreaterThan(0);
    expect(screen.pressable(FORM.photoRemoveSpoken)).toHaveLength(0);
    // The picture is not a stop: the actions say whether there is one.
    expect(hiddenFromScreenReader(screen, 'team-member-photo-avatar')).toBe(true);
  });

  it('uploads a chosen photo at once, and adds the member with it on Save', async () => {
    const addMember = jest.spyOn(team, 'addMember');
    const screen = await render();
    await screen.press(COPY.add);

    await screen.press(FORM.photoAddGallerySpoken, screen.form());

    expect(pickFromGallery).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(1);
    // Uploaded, not saved: nothing reaches the team until Save.
    expect(addMember).not.toHaveBeenCalled();
    expect(pictureOf(screen, 'team-member-photo-avatar')).toEqual({ uri: UPLOADED });
    expect(screen.pressable(FORM.photoReplaceGallerySpoken, screen.form()).length).toBeGreaterThan(0);
    expect(screen.pressable(FORM.photoRemoveSpoken, screen.form()).length).toBeGreaterThan(0);

    await screen.type('team-member-name', 'Kiran Rao');
    await screen.type('team-member-role', 'Apprentice');
    await screen.press(FORM.saveAdd, screen.form());

    expect(addMember).toHaveBeenCalledTimes(1);
    expect(addMember).toHaveBeenCalledWith({ name: 'Kiran Rao', role: 'Apprentice', photoUrl: UPLOADED });
    expect(screen.onForm()).toBe(false);
    expect(screen.members()[3]).toMatchObject({ name: 'Kiran Rao', photoUrl: UPLOADED });
  });

  it('opens an edit on the stored photo, and replaces it from the camera', async () => {
    await withStoredPhoto();
    const updateMember = jest.spyOn(team, 'updateMember');
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));

    expect(pictureOf(screen, 'team-member-photo-avatar')).toEqual({ uri: STORED });
    expect(screen.pressable(FORM.photoRemoveSpoken, screen.form()).length).toBeGreaterThan(0);

    await screen.press(FORM.photoReplaceCameraSpoken, screen.form());
    expect(pickFromCamera).toHaveBeenCalledTimes(1);
    await screen.press(FORM.saveEdit, screen.form());

    expect(updateMember).toHaveBeenCalledWith('tm_1', { ...SURESH, photoUrl: UPLOADED });
    expect(screen.members()[0].photoUrl).toBe(UPLOADED);
    expect(pictureOf(screen, 'team-member-tm_1-avatar')).toEqual({ uri: UPLOADED });
  });

  it('keeps the stored photo when only the other details are saved', async () => {
    await withStoredPhoto();
    const updateMember = jest.spyOn(team, 'updateMember');
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));

    await screen.type('team-member-role', 'Supervisor');
    await screen.press(FORM.saveEdit, screen.form());

    expect(updateMember).toHaveBeenCalledWith('tm_1', { ...SURESH, role: 'Supervisor', photoUrl: STORED });
    expect(screen.members()[0].photoUrl).toBe(STORED);
  });

  it('removes the photo: Save sends none, and the card goes back to initials', async () => {
    await withStoredPhoto();
    const updateMember = jest.spyOn(team, 'updateMember');
    const screen = await render();
    await screen.press(COPY.editSpoken('Suresh Naik'));

    await screen.press(FORM.photoRemoveSpoken, screen.form());
    expect(pictureOf(screen, 'team-member-photo-avatar')).toBeUndefined();
    expect(screen.pressable(FORM.photoAddCameraSpoken, screen.form()).length).toBeGreaterThan(0);
    // Not saved yet: the stored photo is untouched until Save.
    expect((await team.listMembers())[0].photoUrl).toBe(STORED);

    await screen.press(FORM.saveEdit, screen.form());

    expect(Object.keys(updateMember.mock.calls[0][1]).sort()).toEqual(['name', 'phone', 'role']);
    expect('photoUrl' in screen.members()[0]).toBe(false);
    expect(pictureOf(screen, 'team-member-tm_1-avatar')).toBeUndefined();
  });

  it('keeps everything typed when the upload fails, and Try again uploads the same photo', async () => {
    upload.mockRejectedValueOnce(offline());
    const addMember = jest.spyOn(team, 'addMember');
    const screen = await render();
    await screen.press(COPY.add);
    await screen.type('team-member-name', 'Kiran Rao');
    await screen.type('team-member-role', 'Apprentice');
    await screen.type('team-member-phone', '9000000104');

    await screen.press(FORM.photoAddGallerySpoken, screen.form());

    expect(screen.text('team-member-photo-error')).toContain(FORM.photoFailedTitle);
    // The failure's own words never reach the screen.
    expect(screen.text('team-member-photo')).not.toContain('offline');
    expect(screen.field('team-member-name').props.value).toBe('Kiran Rao');
    expect(screen.field('team-member-role').props.value).toBe('Apprentice');
    expect(screen.field('team-member-phone').props.value).toBe('9000000104');
    // Nothing was uploaded: there is no photo to remove, and none is drawn.
    expect(screen.pressable(FORM.photoRemoveSpoken)).toHaveLength(0);
    expect(pictureOf(screen, 'team-member-photo-avatar')).toBeUndefined();

    await screen.press(FORM.photoRetry, screen.host('team-member-photo'));

    // The same photo again: the vendor is not asked to choose it twice.
    expect(pickFromGallery).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(screen.has('team-member-photo-error')).toBe(false);

    await screen.press(FORM.saveAdd, screen.form());
    expect(addMember).toHaveBeenCalledWith({
      name: 'Kiran Rao',
      role: 'Apprentice',
      phone: '9000000104',
      photoUrl: UPLOADED,
    });
  });

  it('forgets a failed photo on Discard, and saves without one', async () => {
    upload.mockRejectedValueOnce(offline());
    const addMember = jest.spyOn(team, 'addMember');
    const screen = await render();
    await screen.press(COPY.add);

    await screen.press(FORM.photoAddCameraSpoken, screen.form());
    await screen.press(FORM.photoDiscard, screen.host('team-member-photo'));

    expect(screen.has('team-member-photo-error')).toBe(false);
    expect(screen.pressable(FORM.photoAddCameraSpoken, screen.form()).length).toBeGreaterThan(0);

    await screen.type('team-member-name', 'Kiran Rao');
    await screen.type('team-member-role', 'Apprentice');
    await screen.press(FORM.saveAdd, screen.form());

    expect(Object.keys(addMember.mock.calls[0][0]).sort()).toEqual(['name', 'role']);
  });

  it('holds Save while a photo uploads, says it is uploading, and saves with it once it is in', async () => {
    const uploading = held<{ assetId: string; remoteUrl: string }>();
    upload.mockReturnValueOnce(uploading.promise);
    const addMember = jest.spyOn(team, 'addMember');
    const screen = await render();
    await screen.press(COPY.add);
    await screen.type('team-member-name', 'Kiran Rao');
    await screen.type('team-member-role', 'Apprentice');

    await screen.press(FORM.photoAddCameraSpoken, screen.form());

    expect(screen.text('team-member-photo-busy')).toContain(FORM.photoUploading);
    expect(screen.host('team-member-photo-busy').props.accessibilityLiveRegion).toBe('polite');
    expect(screen.pressable(FORM.saveAdd, screen.form())[0].props.disabled).toBe(true);
    // Nothing else can start another photo meanwhile.
    expect(screen.pressable(FORM.photoAddGallerySpoken, screen.form())[0].props.disabled).toBe(true);
    await screen.press(FORM.saveAdd, screen.form());
    expect(addMember).not.toHaveBeenCalled();

    await act(async () => {
      uploading.land({ assetId: ASSET.id, remoteUrl: UPLOADED });
    });
    await screen.flush();

    expect(screen.has('team-member-photo-busy')).toBe(false);
    expect(screen.pressable(FORM.saveAdd, screen.form())[0].props.disabled).not.toBe(true);
    await screen.press(FORM.saveAdd, screen.form());
    expect(addMember).toHaveBeenCalledTimes(1);
    expect(addMember).toHaveBeenCalledWith({ name: 'Kiran Rao', role: 'Apprentice', photoUrl: UPLOADED });
  });

  it('refuses a Save pressed in the same moment a photo starts uploading', async () => {
    const uploading = held<{ assetId: string; remoteUrl: string }>();
    upload.mockReturnValueOnce(uploading.promise);
    const addMember = jest.spyOn(team, 'addMember');
    const screen = await render();
    await screen.press(COPY.add);
    await screen.type('team-member-name', 'Kiran Rao');
    await screen.type('team-member-role', 'Apprentice');

    const [camera] = screen.pressable(FORM.photoAddCameraSpoken, screen.form());
    const [save] = screen.pressable(FORM.saveAdd, screen.form());
    // One frame: Save is pressed before the screen has drawn the upload as running.
    await act(async () => {
      camera.props.onPress();
      save.props.onPress();
    });
    await screen.flush();

    expect(addMember).not.toHaveBeenCalled();

    await act(async () => {
      uploading.land({ assetId: ASSET.id, remoteUrl: UPLOADED });
    });
    await screen.flush();
    expect(screen.onForm()).toBe(true);
  });

  it('holds the photo while Save is running — even a tap that gets past the button', async () => {
    const answer = held<TeamMember[]>();
    const addMember = jest.spyOn(team, 'addMember').mockReturnValueOnce(answer.promise);
    const screen = await render();
    await screen.press(COPY.add);
    await screen.type('team-member-name', 'Kiran Rao');
    await screen.type('team-member-role', 'Apprentice');

    await screen.press(FORM.saveAdd, screen.form());
    expect(addMember).toHaveBeenCalledTimes(1);
    expect(screen.pressable(FORM.photoAddCameraSpoken, screen.form())[0].props.disabled).toBe(true);

    // Straight to the form's own handler, as a tap in the frame before the button greyed out.
    const [handler] = screen
      .form()
      .findAll(node => node.props?.label === FORM.photoCamera && typeof node.props?.onPress === 'function');
    await act(async () => {
      handler.props.onPress();
    });
    await screen.flush();
    expect(pickFromCamera).not.toHaveBeenCalled();

    addMember.mockRestore();
    await act(async () => {
      answer.land(await team.addMember({ name: 'Kiran Rao', role: 'Apprentice' }));
    });
    await screen.flush();
  });

  it('asks before leaving a changed photo behind — and leaves at once when nothing changed', async () => {
    await withStoredPhoto();
    const screen = await render();

    await screen.press(COPY.editSpoken('Suresh Naik'));
    await screen.press(FORM.back);
    expect(screen.onForm()).toBe(false);

    await screen.press(COPY.editSpoken('Suresh Naik'));
    await screen.press(FORM.photoRemoveSpoken, screen.form());
    await screen.press(FORM.back);
    expect(screen.onForm()).toBe(true);
    expect(screen.pressable(FORM.discardKeep)).toHaveLength(1);

    await screen.press(FORM.discardConfirm, screen.host('team-member-discard-dialog'));
    expect(screen.onForm()).toBe(false);
    expect(screen.members()[0].photoUrl).toBe(STORED);
  });

  it('asks before leaving a photo that failed to upload', async () => {
    upload.mockRejectedValueOnce(offline());
    const screen = await render();
    await screen.press(COPY.add);

    await screen.press(FORM.photoAddGallerySpoken, screen.form());
    await screen.press(FORM.back);

    expect(screen.onForm()).toBe(true);
    expect(screen.pressable(FORM.discardKeep)).toHaveLength(1);
  });
});
