/**
 * The splash is the first frame of the application, so it is worth pinning that
 * it carries the brand rather than a placeholder, and that it renders in both
 * appearances — a screen shown before anything else is a poor place to discover
 * that a colour was hardcoded.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { useColorScheme } from 'react-native';

import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { SplashScreen } from '@/features/auth/screens/SplashScreen';
import { darkTheme, lightTheme, ThemeProvider } from '@/shared/theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme');

const appearance = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

async function render() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <SplashScreen />
      </ThemeProvider>,
    );
  });

  return {
    renderer,
    text: () => textOf(renderer.toJSON()),
    background: () => {
      const root = renderer.root.findByProps({ testID: 'splash-screen' });
      return StyleSheetFlatten(root.props.style).backgroundColor;
    },
  };
}

/** The style prop arrives as an array; only the background is asserted on. */
function StyleSheetFlatten(style: unknown): { backgroundColor?: string } {
  if (Array.isArray(style)) {
    return style.reduce<{ backgroundColor?: string }>(
      (merged, entry) => ({ ...merged, ...StyleSheetFlatten(entry) }),
      {},
    );
  }
  return (style ?? {}) as { backgroundColor?: string };
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

afterEach(() => {
  jest.clearAllMocks();
});

describe('SplashScreen', () => {
  it('leads with the brand, not with a loading message', async () => {
    appearance.mockReturnValue('light');
    const { text, renderer } = await render();

    expect(text()).toContain(AUTH_COPY.brand.wordmark);
    expect(text()).toContain(AUTH_COPY.brand.tagline);
    // The mark is present as a mark rather than as the letter of its name.
    expect(renderer.root.findByProps({ testID: 'splash-brand-mark' })).toBeDefined();
  });

  it('says nothing about loading, which the user can already see', async () => {
    appearance.mockReturnValue('light');
    const { text } = await render();

    expect(text()).not.toMatch(/loading/i);
    expect(text()).not.toMatch(/please wait/i);
  });

  it('takes its background from the theme in both appearances', async () => {
    appearance.mockReturnValue('light');
    const light = await render();
    expect(light.background()).toBe(lightTheme.colors.background);

    appearance.mockReturnValue('dark');
    const dark = await render();
    expect(dark.background()).toBe(darkTheme.colors.background);

    // Different in the two appearances, which is the point of asserting it: a
    // hardcoded colour would pass one of these and fail the other.
    expect(light.background()).not.toBe(dark.background());
  });
});
