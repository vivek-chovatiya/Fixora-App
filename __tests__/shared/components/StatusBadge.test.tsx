/**
 * StatusBadge's words must be readable on their own tint, in both themes
 * (Phase 3G-4, 21/10/2026).
 *
 * A badge's label is 12sp caption, so WCAG 1.4.3 asks 4.5:1 of it. The
 * colours are read off the rendered badge — the pill's fill, the label's ink,
 * the icon's ink — and the ratio is computed here, so a token changed later
 * is checked against the rule, not against a copy of today's value.
 *
 * - every tone reads at 4.5:1 or more in both themes
 * - each coloured tone is worded in its tint's own ink (`onDangerSubtle`,
 *   `onInfoSubtle`, `onSuccessSubtle`, `onWarningSubtle`), never its base
 *   colour — which is what failed: danger 3.9 / 3.3, info 4.2 / 4.0, success
 *   3.0 and warning 2.9 in light
 * - neutral is worded in `textSecondary` (gray500 was 4.4:1 in light)
 * - the icon always takes the label's ink, so the two never part
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, useColorScheme } from 'react-native';

import { StatusBadge, type StatusTone } from '@/shared/components';
import { darkTheme, lightTheme, ThemeProvider, type ColorTokens } from '@/shared/theme';

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

/** What 12sp caption text needs: it is not large text. */
const LABEL_CONTRAST = 4.5;

const LABEL = 'Disabled';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  appearance.mockReset();
});

/** The badge's fill, its label's ink and its icon's ink, as drawn. */
function drawn(tone: StatusTone) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <StatusBadge label={LABEL} tone={tone} icon="reject" testID="badge" />
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  const [pill] = renderer.root.findAll(
    node => typeof node.type === 'string' && node.props?.testID === 'badge',
  );
  const [text] = renderer.root.findAll(
    node => typeof node.type === 'string' && node.props?.children === LABEL,
  );
  // The glyph as the icon library receives it: a numeric size, a resolved colour.
  const [glyph] = renderer.root.findAll(
    node => typeof node.props?.name === 'string' && typeof node.props?.size === 'number',
  );

  return {
    fill: StyleSheet.flatten(pill.props.style).backgroundColor as string,
    ink: StyleSheet.flatten(text.props.style).color as string,
    icon: glyph?.props.color as string,
  };
}

const TONES: readonly StatusTone[] = ['danger', 'neutral', 'info', 'success', 'warning'];

/** Each coloured tone: its tint, its tint's own ink, and the base colour it must not use. */
const COLOURED = [
  ['danger', 'dangerSubtle', 'onDangerSubtle', 'danger'],
  ['info', 'infoSubtle', 'onInfoSubtle', 'info'],
  ['success', 'successSubtle', 'onSuccessSubtle', 'success'],
  ['warning', 'warningSubtle', 'onWarningSubtle', 'warning'],
] as const satisfies readonly (readonly [StatusTone, keyof ColorTokens, keyof ColorTokens, keyof ColorTokens])[];

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
] as const)('StatusBadge in %s mode', (scheme, theme) => {
  beforeEach(() => {
    appearance.mockReturnValue(scheme);
  });

  it.each([...TONES])('words a %s badge at 4.5:1 or more on its tint', tone => {
    const { fill, ink } = drawn(tone);

    expect(contrast(ink, fill)).toBeGreaterThanOrEqual(LABEL_CONTRAST);
  });

  it.each([...TONES])('draws a %s badge’s icon in its words’ ink', tone => {
    const { ink, icon } = drawn(tone);

    expect(icon).toBe(ink);
  });

  it.each([...COLOURED])(
    'words a %s badge in its tint’s own ink, never the base colour',
    (tone, tint, ink, base) => {
      const drawnBadge = drawn(tone);

      expect(drawnBadge.fill).toBe(theme.colors[tint]);
      expect(drawnBadge.ink).toBe(theme.colors[ink]);
      expect(drawnBadge.ink).not.toBe(theme.colors[base]);
    },
  );

  it('words a neutral badge in textSecondary on neutralSubtle', () => {
    const { fill, ink } = drawn('neutral');

    expect(fill).toBe(theme.colors.neutralSubtle);
    expect(ink).toBe(theme.colors.textSecondary);
  });
});

describe('StatusBadge — why the base colours were not enough', () => {
  it('measures each base colour under 4.5:1 on its own tint in at least one theme', () => {
    for (const [, tint, , base] of COLOURED) {
      const worst = Math.min(
        contrast(lightTheme.colors[base], lightTheme.colors[tint]),
        contrast(darkTheme.colors[base], darkTheme.colors[tint]),
      );
      expect(worst).toBeLessThan(LABEL_CONTRAST);
    }
  });
});
