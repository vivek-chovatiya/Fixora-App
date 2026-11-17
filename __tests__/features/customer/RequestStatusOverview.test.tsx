/**
 * RequestStatusOverview's glyph disc takes its ink from the tint it sits on
 * (owner's rule, 21/10/2026, Phase 3G-4).
 *
 * The disc's tint follows the status's tone, so the glyph's ink is chosen at
 * run time — through `SUBTLE_INK`, never the tone's own colour, which is under
 * 4.5:1 on its tint in at least one theme. Every status, known or not, is
 * checked in both themes; the table's own ratios are held centrally in
 * `__tests__/shared/theme/subtleInk.test.ts`.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, useColorScheme } from 'react-native';

import { RequestStatusOverview } from '@/features/customer/components/RequestStatusOverview';
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

const STATUSES = [
  'CREATED',
  'PENDING_VENDOR',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
  'REJECTED',
  'CANCELLED',
  'ON_HOLD',
  'SOMETHING_NEW',
];

/** The disc's fill and the glyph's resolved ink, as drawn. */
function discOf(status: string) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <RequestStatusOverview status={status} dispatch="open" />
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  // The first glyph is the disc's; the icon library receives a numeric size.
  const [glyph] = renderer.root.findAll(
    node => typeof node.props?.name === 'string' && typeof node.props?.size === 'number',
  );
  let disc = glyph.parent;
  while (disc && (typeof disc.type !== 'string' || !StyleSheet.flatten(disc.props.style)?.backgroundColor)) {
    disc = disc.parent;
  }
  return {
    fill: StyleSheet.flatten(disc?.props.style).backgroundColor as string,
    ink: glyph.props.color as string,
  };
}

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
] as const)('RequestStatusOverview in %s mode', (scheme, theme) => {
  beforeEach(() => {
    appearance.mockReturnValue(scheme);
  });

  it.each(STATUSES)('inks the %s disc in its tint’s own ink', status => {
    const { fill, ink } = discOf(status);

    const tint = (Object.keys(SUBTLE_INK) as SubtleTint[]).find(key => theme.colors[key] === fill);
    expect(tint).toBeDefined();
    expect(ink).toBe(theme.colors[SUBTLE_INK[tint!]]);
  });
});
