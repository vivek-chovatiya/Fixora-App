/**
 * The vendor's figure discs — the dashboard's three counts and every
 * `ReportFigureCard` (Reports, and the dashboard's Today and Rating) — draw
 * their glyph in the disc tint's own ink (owner's rule, 21/10/2026, 3G-4).
 *
 * Both components take one `tint` and look the ink up in `SUBTLE_INK`, so a
 * tint and an ink cannot be mismatched by a caller. Checked in both themes;
 * the table's ratios are held in `__tests__/shared/theme/subtleInk.test.ts`.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, useColorScheme } from 'react-native';

import { DashboardOverview } from '@/features/vendor/components/DashboardOverview';
import { ReportFigureCard } from '@/features/vendor/components/ReportFigureCard';
import { SUBTLE_INK, darkTheme, lightTheme, ThemeProvider, type SubtleTint } from '@/shared/theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme');

const appearance = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  appearance.mockReset();
});

function draw(element: React.ReactElement) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<ThemeProvider>{element}</ThemeProvider>);
  });
  mounted.push(renderer);
  return renderer;
}

/** Each glyph's resolved ink and the fill of the disc it sits in. */
function discs(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAll(node => typeof node.props?.name === 'string' && typeof node.props?.size === 'number')
    .map(glyph => {
      let disc = glyph.parent;
      while (disc && (typeof disc.type !== 'string' || !StyleSheet.flatten(disc.props.style)?.backgroundColor)) {
        disc = disc.parent;
      }
      return {
        ink: glyph.props.color as string,
        fill: StyleSheet.flatten(disc?.props.style)?.backgroundColor as string,
      };
    });
}

const TINTS = Object.keys(SUBTLE_INK) as SubtleTint[];

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
] as const)('vendor figure discs in %s mode', (scheme, theme) => {
  beforeEach(() => {
    appearance.mockReturnValue(scheme);
  });

  it('inks each of the dashboard’s three counts in its disc’s own ink', () => {
    const drawn = discs(draw(<DashboardOverview counts={{ pending: 2, active: 1, completed: 5 }} />));

    expect(drawn).toEqual([
      { fill: theme.colors.warningSubtle, ink: theme.colors[SUBTLE_INK.warningSubtle] },
      { fill: theme.colors.infoSubtle, ink: theme.colors[SUBTLE_INK.infoSubtle] },
      { fill: theme.colors.successSubtle, ink: theme.colors[SUBTLE_INK.successSubtle] },
    ]);
  });

  it.each(TINTS)('inks a figure card on %s in that tint’s own ink', tint => {
    const [disc] = discs(
      draw(<ReportFigureCard label="Completed" value="5" spoken="5 completed" icon="success" tint={tint} />),
    );

    expect(disc).toEqual({ fill: theme.colors[tint], ink: theme.colors[SUBTLE_INK[tint]] });
  });
});
