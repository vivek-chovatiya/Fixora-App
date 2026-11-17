/**
 * The introduction is the first thing a new user meets and the one screen that
 * asks for permissions, so these tests pin the two things that would be worst to
 * get wrong: that it is shown once and never again, and that every way of
 * answering a permission leaves the user able to continue.
 *
 * A stub PermissionService is registered throughout. The point is what the
 * screen does with each outcome, and driving a real native dialog would test the
 * platform instead.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';

import {
  setOnboardingStorage,
  type OnboardingStorage,
} from '@/core/storage/OnboardingStorage';
import { ONBOARDING_COPY } from '@/features/onboarding/constants/onboardingCopy';
import { OnboardingScreen } from '@/features/onboarding/screens/OnboardingScreen';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type {
  PermissionKind,
  PermissionService,
  PermissionStatus,
} from '@/shared/services/types/PermissionService';
import { ToastProvider } from '@/shared/components';
import { ThemeProvider } from '@/shared/theme';

const PAGES = ONBOARDING_COPY.pages;

/** The pager measures itself, so tests hand it a plausible phone. */
const FRAME = { width: 360, height: 640 };

function memoryOnboardingStorage(completed = false) {
  let value = completed;

  const storage: OnboardingStorage & { peek: () => boolean } = {
    hasCompletedOnboarding: jest.fn(async () => value),
    setOnboardingCompleted: jest.fn(async () => {
      value = true;
    }),
    clear: jest.fn(async () => {
      value = false;
    }),
    peek: () => value,
  };

  return storage;
}

function stubPermissions(overrides: Partial<PermissionService> = {}): PermissionService {
  return {
    check: jest.fn(async () => 'denied' as PermissionStatus),
    request: jest.fn(async () => 'granted' as PermissionStatus),
    openSettings: jest.fn(async () => undefined),
    ...overrides,
  };
}

async function render(options: {
  storage?: ReturnType<typeof memoryOnboardingStorage>;
  permissions?: PermissionService;
} = {}) {
  const storage = options.storage ?? memoryOnboardingStorage();
  const permissions = options.permissions ?? stubPermissions();

  setOnboardingStorage(storage);
  registerService('permission', permissions);

  const replace = jest.fn();
  const navigation = { replace, navigate: jest.fn(), goBack: jest.fn() } as never;
  const route = { key: 'Onboarding', name: 'Onboarding' as const, params: undefined } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <ToastProvider>
          <OnboardingScreen navigation={navigation} route={route} />
        </ToastProvider>
      </ThemeProvider>,
    );
  });

  /** The pager only renders pages once it knows how wide it is. */
  await act(async () => {
    renderer.root
      .findByProps({ testID: 'onboarding-pager-frame' })
      .props.onLayout({ nativeEvent: { layout: FRAME } });
  });

  /**
   * All three pages are mounted at once — that is what makes a swipe a swipe —
   * so a label like "Allow" is never unique. Anything belonging to a page is
   * pressed through `pressIn`, scoped to that page's card.
   */
  const pressable = (root: ReactTestRenderer.ReactTestInstance, accessibilityLabel: string) =>
    root
      .findAllByProps({ accessibilityLabel })
      .filter(node => typeof node.props.onPress === 'function');

  const scope = (testID: string) => renderer.root.findAllByProps({ testID })[0];

  const press = async (accessibilityLabel: string) => {
    const [target] = pressable(renderer.root, accessibilityLabel);
    await act(async () => {
      target.props.onPress();
    });
  };

  const pressIn = async (pageId: string, accessibilityLabel: string) => {
    const [target] = pressable(scope(`onboarding-permission-${pageId}`), accessibilityLabel);
    await act(async () => {
      target.props.onPress();
    });
  };

  /** Settles the swipe at a page, as the platform reports it. */
  const swipeTo = async (index: number) => {
    await act(async () => {
      renderer.root.findByProps({ testID: 'onboarding-pager' }).props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: index * FRAME.width } },
      });
    });
  };

  const has = (accessibilityLabel: string) =>
    pressable(renderer.root, accessibilityLabel).length > 0;

  const hasIn = (pageId: string, accessibilityLabel: string) =>
    pressable(scope(`onboarding-permission-${pageId}`), accessibilityLabel).length > 0;

  const pagination = () => scope('onboarding-pagination').props;

  /** The host node, which is where the accessible name actually lands. */
  const paginationLabel = () =>
    renderer.root
      .findAllByProps({ testID: 'onboarding-pagination' })
      .map(node => node.props.accessibilityLabel)
      .find(Boolean);

  const outcomeFor = (id: string) => {
    const found = renderer.root.findAllByProps({
      testID: `onboarding-permission-${id}-outcome`,
    });
    return found.length > 0 ? textOf(found[0].props.children) : undefined;
  };

  return {
    renderer,
    storage,
    permissions,
    replace,
    press,
    pressIn,
    swipeTo,
    has,
    hasIn,
    pagination,
    paginationLabel,
    outcomeFor,
    text: () => textOf(renderer.toJSON()),
  };
}

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join(' ');
  }
  return textOf((node as ReactTestRendererJSON).children);
}

afterEach(() => {
  resetServices();
  jest.restoreAllMocks();
});

describe('OnboardingScreen — moving through it', () => {
  it('starts on the first page', async () => {
    const { pagination, text } = await render();

    expect(pagination().activeIndex).toBe(0);
    expect(text()).toContain(PAGES[0].title);
  });

  it('advances when a permission is answered, and comes back with Back', async () => {
    const { press, pressIn, pagination, has } = await render();

    // Back is absent on the first page: there is nothing behind it.
    expect(has(ONBOARDING_COPY.back)).toBe(false);

    // Answering is what moves the introduction on; there is nothing else to tap.
    await pressIn('services', PAGES[0].permission.decline);
    expect(pagination().activeIndex).toBe(1);
    expect(has(ONBOARDING_COPY.back)).toBe(true);

    await pressIn('compare', PAGES[1].permission.decline);
    expect(pagination().activeIndex).toBe(2);

    await press(ONBOARDING_COPY.back);
    expect(pagination().activeIndex).toBe(1);
  });

  it('offers no separate forward button', async () => {
    const { has, hasIn } = await render();

    // The pair in the card is the whole forward affordance. A Next beneath it
    // asked the user to confirm a decision they had already made.
    expect(has('Next')).toBe(false);
    expect(has('Get Started')).toBe(false);
    expect(hasIn('services', PAGES[0].permission.allow)).toBe(true);
    expect(hasIn('services', PAGES[0].permission.decline)).toBe(true);
  });

  it('follows a swipe rather than only its own buttons', async () => {
    const { swipeTo, pagination } = await render();

    await swipeTo(2);

    expect(pagination().activeIndex).toBe(2);
  });

  it('offers a way onward again when an answered page is revisited', async () => {
    const { press, pressIn, hasIn, pagination } = await render();

    await pressIn('services', PAGES[0].permission.decline);
    await press(ONBOARDING_COPY.back);
    expect(pagination().activeIndex).toBe(0);

    // Declining leaves the question open, so the pair is still there.
    expect(hasIn('services', PAGES[0].permission.allow)).toBe(true);
  });
});

describe('OnboardingScreen — finishing', () => {
  it('records completion and goes to sign in when finished', async () => {
    const { pressIn, storage, replace } = await render();

    await pressIn('services', PAGES[0].permission.decline);
    await pressIn('compare', PAGES[1].permission.decline);
    // Answering the last page's question is what ends the introduction.
    await pressIn('track', PAGES[2].permission.decline);

    expect(storage.setOnboardingCompleted).toHaveBeenCalled();
    expect(storage.peek()).toBe(true);
    // Replaced, not pushed: there is nothing to come back to.
    expect(replace).toHaveBeenCalledWith('AuthEntry');
  });

  it('treats Skip as finishing, so it is not shown again', async () => {
    const { press, storage, replace } = await render();

    await press(ONBOARDING_COPY.skip);

    expect(storage.setOnboardingCompleted).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('AuthEntry');
  });

  it('still reaches sign in when completion cannot be recorded', async () => {
    const storage = memoryOnboardingStorage();
    storage.setOnboardingCompleted = jest.fn(async () => {
      throw new Error('device full');
    });

    const { press, replace } = await render({ storage });

    await press(ONBOARDING_COPY.skip);

    // The worst case is seeing the introduction again. Being trapped on it
    // because a write failed would be far worse.
    expect(replace).toHaveBeenCalledWith('AuthEntry');
  });

  it('asks for no permission on the way out', async () => {
    const { press, permissions } = await render();

    await press(ONBOARDING_COPY.skip);

    // Skipping is not consent. Whatever was not granted stays ungranted, to be
    // asked for by the feature that actually needs it.
    expect(permissions.request).not.toHaveBeenCalled();
  });
});

describe('OnboardingScreen — permissions', () => {
  /** Every page carries one, and each is asked for only on its own page. */
  it('requests nothing until the user asks for it', async () => {
    const { permissions } = await render();

    expect(permissions.request).not.toHaveBeenCalled();
    expect(permissions.check).not.toHaveBeenCalled();
  });

  it('asks for the permission belonging to the page', async () => {
    const permissions = stubPermissions();
    const { pressIn } = await render({ permissions });

    await pressIn('services', PAGES[0].permission.allow);

    expect(permissions.request).toHaveBeenCalledWith<[PermissionKind]>('location');
  });

  it('reports a grant, and stops offering to ask', async () => {
    const permissions = stubPermissions({ request: jest.fn(async () => 'granted') });
    const { pressIn, outcomeFor, hasIn } = await render({ permissions });

    await pressIn('services', PAGES[0].permission.allow);

    expect(outcomeFor('services')).toContain(PAGES[0].permission.granted);
    // Nothing left to answer, so neither action is offered.
    expect(hasIn('services', PAGES[0].permission.allow)).toBe(false);
    expect(hasIn('services', PAGES[0].permission.decline)).toBe(false);
  });

  it('reassures on a denial and leaves the user able to continue', async () => {
    const permissions = stubPermissions({ request: jest.fn(async () => 'denied') });
    const { pressIn, outcomeFor, pagination } = await render({ permissions });

    await pressIn('services', PAGES[0].permission.allow);

    expect(outcomeFor('services')).toContain(PAGES[0].permission.denied);

    // A refusal from the system still carries the user onward.
    expect(pagination().activeIndex).toBe(1);
  });

  it('offers Settings rather than asking again once blocked', async () => {
    const permissions = stubPermissions({ request: jest.fn(async () => 'blocked') });
    const { pressIn, outcomeFor, hasIn, permissions: service } = await render({ permissions });

    await pressIn('services', PAGES[0].permission.allow);

    expect(outcomeFor('services')).toContain(PAGES[0].permission.blocked);
    // Asking again would show no dialog at all, so it is not offered.
    expect(hasIn('services', PAGES[0].permission.allow)).toBe(false);
    expect(hasIn('services', ONBOARDING_COPY.openSettings)).toBe(true);

    await pressIn('services', ONBOARDING_COPY.openSettings);
    expect(service.openSettings).toHaveBeenCalled();
  });

  it('does not ask when the system has already refused permanently', async () => {
    const permissions = stubPermissions({ check: jest.fn(async () => 'blocked') });
    const { pressIn } = await render({ permissions });

    await pressIn('services', PAGES[0].permission.allow);

    // Checked, found blocked, and not requested — which is what stops the app
    // hammering a dialog the platform will never show.
    expect(permissions.check).toHaveBeenCalled();
    expect(permissions.request).not.toHaveBeenCalled();
  });

  it('asks nobody when the user says Not Now', async () => {
    const { pressIn, permissions, pagination } = await render();

    await pressIn('services', PAGES[0].permission.decline);

    expect(permissions.request).not.toHaveBeenCalled();

    // Not Now is an answer, so it moves on exactly as Allow does.
    expect(pagination().activeIndex).toBe(1);
  });

  it('continues safely when the permission service fails outright', async () => {
    const permissions = stubPermissions({
      check: jest.fn(async () => {
        throw new Error('native module missing');
      }),
    });
    const { pressIn, pagination } = await render({ permissions });

    await pressIn('services', PAGES[0].permission.allow);

    // A misbehaving device capability must never become a wall across the
    // introduction.
    expect(pagination().activeIndex).toBe(1);
  });
});

describe('OnboardingScreen — accessibility', () => {
  it('names every control it offers', async () => {
    const { renderer, has, hasIn } = await render();

    expect(has(ONBOARDING_COPY.skip)).toBe(true);
    expect(hasIn('services', PAGES[0].permission.allow)).toBe(true);
    expect(hasIn('services', PAGES[0].permission.decline)).toBe(true);

    const [skip] = renderer.root
      .findAllByProps({ accessibilityLabel: ONBOARDING_COPY.skip })
      .filter(node => typeof node.props.onPress === 'function');
    expect(skip.props.accessibilityRole).toBe('button');
    expect(skip.props.accessibilityHint).toBe(ONBOARDING_COPY.skipHint);
  });

  it('says the position in words, since the dots cannot be seen', async () => {
    const { pressIn, paginationLabel } = await render();

    expect(paginationLabel()).toBe(ONBOARDING_COPY.stepLabel(1, PAGES.length));

    await pressIn('services', PAGES[0].permission.decline);
    expect(paginationLabel()).toBe(ONBOARDING_COPY.stepLabel(2, PAGES.length));
  });
});

describe('OnboardingScreen — what it promises', () => {
  it('advertises nothing the launch build cannot do', async () => {
    const { pressIn, text } = await render();

    const everything = [PAGES.map(page => `${page.title} ${page.body}`).join(' '), text()].join(
      ' ',
    );

    // Phase 2 features must not appear in an introduction shipped with Phase 1.
    expect(everything).not.toMatch(/real-?time/i);
    expect(everything).not.toMatch(/\bchat\b/i);
    expect(everything).not.toMatch(/\bwallet\b/i);

    await pressIn('services', PAGES[0].permission.decline);
    await pressIn('compare', PAGES[1].permission.decline);
    expect(text()).not.toMatch(/real-?time/i);
  });
});
