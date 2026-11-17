/**
 * RoleCard's outcome badge must be readable on its tint (Phase 3G-4,
 * 21/10/2026).
 *
 * The badge's words are 12sp `label`, so they need 4.5:1. They were the
 * card's accent — `success` on `successSubtle`, 3.0:1 in light; `primary` on
 * `primarySubtle`, 4.2:1 / 4.0:1 — and are now each tint's own ink
 * (`SUBTLE_INK`), as is the glyph on the same tint. This suite pins that the
 * card takes the ink from the theme's table; the table's ratios are held in
 * `__tests__/shared/theme/subtleInk.test.ts`.
 *
 * Colours are read off the rendered card and the ratio computed here.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, useColorScheme } from 'react-native';

import { RoleCard, type RoleCardTone } from '@/features/auth/components/RoleCard';
import { darkTheme, lightTheme, ThemeProvider } from '@/shared/theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme');

const appearance = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

/** WCAG 2 relative luminance of a `#RRGGBB` colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(at => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two `#RRGGBB` colours. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const LABEL_CONTRAST = 4.5;
const BADGE = 'Get started';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  appearance.mockReset();
});

/** The badge's words' ink and the fill of the pill they sit on. */
function badgeOf(tone: RoleCardTone) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <RoleCard
          tone={tone}
          title="Title"
          description="Description"
          badge={BADGE}
          hint="Hint"
          onPress={jest.fn()}
          testID="role-card"
        />
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  const [text] = renderer.root.findAll(
    node => typeof node.type === 'string' && node.props?.children === BADGE,
  );
  // The pill is the nearest host view above the words.
  let pill = text.parent;
  while (pill && typeof pill.type !== 'string') {
    pill = pill.parent;
  }
  while (pill && StyleSheet.flatten(pill.props.style)?.backgroundColor === undefined) {
    pill = pill.parent;
  }

  return {
    ink: StyleSheet.flatten(text.props.style).color as string,
    fill: StyleSheet.flatten(pill?.props.style).backgroundColor as string,
  };
}

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
] as const)('RoleCard badge in %s mode', (scheme, theme) => {
  beforeEach(() => {
    appearance.mockReturnValue(scheme);
  });

  it('words the vendor badge in onSuccessSubtle, at 4.5:1 or more on its tint', () => {
    const { ink, fill } = badgeOf('vendor');

    expect(fill).toBe(theme.colors.successSubtle);
    expect(ink).toBe(theme.colors.onSuccessSubtle);
    expect(contrast(ink, fill)).toBeGreaterThanOrEqual(LABEL_CONTRAST);
  });

  it('words the customer badge in onPrimarySubtle, at 4.5:1 or more on its tint', () => {
    const { ink, fill } = badgeOf('customer');

    expect(fill).toBe(theme.colors.primarySubtle);
    expect(ink).toBe(theme.colors.onPrimarySubtle);
    expect(contrast(ink, fill)).toBeGreaterThanOrEqual(LABEL_CONTRAST);
  });
});
