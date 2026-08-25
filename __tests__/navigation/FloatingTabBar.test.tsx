/**
 * The bar is mostly motion, and motion is the part of it that must never matter.
 *
 * So these tests are about everything else: that a tap navigates without waiting
 * for anything to move, that the router's press contract still holds, that the
 * selected destination is stated rather than merely animated to, and that the
 * floating button — the one piece with no meaning at all — cannot be reached by
 * a finger or by a screen reader.
 *
 * The button's position is not asserted. It comes from layout, which a test
 * renderer does not perform, and a test that pinned it would be pinning the
 * mock rather than the bar.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { FloatingTabBar } from '@/navigation/components/FloatingTabBar';
import { createTabIcon } from '@/navigation/tabIcon';
import { Text } from '@/shared/components';
import { ThemeProvider, lightTheme } from '@/shared/theme';

const TABS = [
  { name: 'Home', icon: createTabIcon('home') },
  { name: 'Requests', icon: createTabIcon('requests') },
  { name: 'Profile', icon: createTabIcon('profile') },
] as const;

interface Harness {
  index?: number;
  /** Makes every `tabPress` preventable and prevented, as a screen may. */
  preventDefault?: boolean;
}

function buildProps({ index = 0, preventDefault = false }: Harness) {
  const navigate = jest.fn();
  const emit = jest.fn(() => ({ defaultPrevented: preventDefault }));

  const routes = TABS.map((tab, i) => ({
    key: `${tab.name}-${i}`,
    name: tab.name,
    params: undefined,
  }));

  const descriptors = Object.fromEntries(
    routes.map((route, i) => [
      route.key,
      {
        options: {
          title: TABS[i].name,
          tabBarIcon: TABS[i].icon,
          tabBarLabel: ({ focused, children }: { focused: boolean; children: string }) => (
            <Text variant={focused ? 'label' : 'caption'}>{children}</Text>
          ),
        },
      },
    ]),
  );

  return {
    props: {
      state: { index, routes },
      descriptors,
      navigation: { navigate, emit },
      insets: { top: 0, bottom: 24, left: 0, right: 0 },
    } as unknown as BottomTabBarProps,
    navigate,
    emit,
    routes,
  };
}

async function render(harness: Harness = {}) {
  const built = buildProps(harness);

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <FloatingTabBar {...built.props} />
      </ThemeProvider>,
    );
  });

  /*
    A tab is two nodes, and each holds half of what these tests need.

    `findAll` walks composite elements as well as host ones, so the Pressable
    matches several times over. The composite is where `onPress` lives; the view
    it renders is where the accessibility props land, because Pressable turns a
    press handler into responder callbacks on the way down.
  */
  const tabs = renderer.root.findAll(
    node => typeof node.type === 'string' && node.props?.accessibilityRole === 'tab',
  );

  const pressables = renderer.root.findAll(
    node =>
      node.props?.accessibilityRole === 'tab' && typeof node.props?.onPress === 'function',
  );

  return {
    ...built,
    renderer,
    tabs,
    press: async (i: number) => {
      await act(async () => {
        pressables[i].props.onPress();
      });
    },
    longPress: async (i: number) => {
      await act(async () => {
        pressables[i].props.onLongPress();
      });
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

describe('FloatingTabBar — the destinations are the navigator\'s', () => {
  it('draws one tab per route, in the router\'s order', async () => {
    const { tabs } = await render();

    expect(tabs).toHaveLength(TABS.length);
    expect(tabs.map(tab => tab.props.accessibilityLabel)).toEqual(
      TABS.map(tab => tab.name),
    );
  });

  it('shows every destination\'s label', async () => {
    const { renderer } = await render();
    const text = textOf(renderer.toJSON());

    for (const tab of TABS) {
      expect(text).toContain(tab.name);
    }
  });
});

describe('FloatingTabBar — navigation does not wait for the animation', () => {
  it('navigates from the press handler itself', async () => {
    const { press, navigate, routes } = await render({ index: 0 });

    await press(2);

    // Synchronously, in the same handler. Nothing is scheduled, delayed or
    // chained behind a callback that an animation would have to reach first.
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(routes[2].name, undefined);
  });

  it('leaves the selected destination alone', async () => {
    const { press, navigate } = await render({ index: 1 });

    await press(1);

    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('FloatingTabBar — the router\'s press contract survives', () => {
  it('emits a preventable tabPress before navigating', async () => {
    const { press, emit, routes } = await render({ index: 0 });

    await press(1);

    expect(emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: routes[1].key,
      canPreventDefault: true,
    });
  });

  it('does not navigate when a screen prevents the default', async () => {
    // This is how "tap the current tab to scroll to top" is built. A bar that
    // ignored it would break the screens quietly.
    const { press, navigate } = await render({ index: 0, preventDefault: true });

    await press(2);

    expect(navigate).not.toHaveBeenCalled();
  });

  it('emits tabLongPress', async () => {
    const { longPress, emit, routes } = await render();

    await longPress(2);

    expect(emit).toHaveBeenCalledWith({ type: 'tabLongPress', target: routes[2].key });
  });
});

describe('FloatingTabBar — the selected state is said, not shown', () => {
  it('marks exactly one tab selected', async () => {
    const { tabs } = await render({ index: 1 });

    expect(tabs.map(tab => tab.props.accessibilityState.selected)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('names every tab without reading out the icon glyph', async () => {
    const { tabs } = await render();

    for (const tab of tabs) {
      expect(typeof tab.props.accessibilityLabel).toBe('string');
      // The icon set draws glyphs from the private use area. One reaching a
      // screen reader is announced as an unpronounceable character.
      expect(tab.props.accessibilityLabel).not.toMatch(/[-]|[\u{F0000}-\u{FFFFD}]/u);
    }
  });
});

describe('FloatingTabBar — the floating button is decoration', () => {
  it('cannot be touched or read', async () => {
    const { renderer } = await render();

    const [indicator] = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.testID === 'tab-bar-indicator',
    );

    expect(indicator.props.pointerEvents).toBe('none');
    expect(indicator.props.accessibilityElementsHidden).toBe(true);
    expect(indicator.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('draws the selected glyph in the ink that reads on the accent', async () => {
    const { renderer } = await render({ index: 2 });

    const [indicator] = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.testID === 'tab-bar-indicator',
    );

    // The vector-icon element, which is the innermost of the matches and the
    // one carrying the resolved colour — everything above it still holds the
    // token that Icon has yet to map.
    const glyphs = indicator.findAll(
      node => typeof node.props?.name === 'string' && typeof node.props?.color === 'string',
    );

    // The bar's own icons are drawn in the accent, which would be invisible on
    // a button filled with it.
    expect(glyphs.length).toBeGreaterThan(0);
    expect(glyphs[glyphs.length - 1].props.color).toBe(lightTheme.colors.textInverse);
  });
});
