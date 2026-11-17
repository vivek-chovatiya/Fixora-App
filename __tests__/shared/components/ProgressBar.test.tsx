/**
 * ProgressBar: the one drawing of a bar (Phase 3G-4, 21/10/2026).
 *
 * The rules a bar gets wrong:
 *
 * - its fill is never longer than its track, nor shorter than nothing: a value
 *   past either end is held to it, and one that is not a number draws an empty
 *   bar
 * - the width is the fraction as a whole percent — what the figure beside a
 *   bar says, so the two agree
 * - colours and thickness are theme tokens, read from the theme here
 * - it says nothing unless its caller asks: every place it is used already
 *   speaks the value another way
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, useColorScheme } from 'react-native';

import { ProgressBar, progressPercent, type ProgressBarProps } from '@/shared/components';
import { darkTheme, lightTheme, ThemeProvider } from '@/shared/theme';

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

function draw(props: ProgressBarProps) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <ProgressBar testID="bar" fillTestID="fill" {...props} />
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  const host = (id: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id)[0];
  return {
    track: host('bar'),
    trackStyle: StyleSheet.flatten(host('bar').props.style),
    fillStyle: StyleSheet.flatten(host('fill').props.style),
  };
}

describe('ProgressBar — how long the fill is', () => {
  it.each([
    [0.42, '42%'],
    [0, '0%'],
    [1, '100%'],
    [0.005, '1%'],
    [-0.2, '0%'],
    [1.3, '100%'],
    [Number.NaN, '0%'],
    [Number.POSITIVE_INFINITY, '0%'],
  ])('draws %p as %s of the track', (value, width) => {
    expect(draw({ value }).fillStyle.width).toBe(width);
  });

  it('gives the same whole percent it draws, for the words beside it', () => {
    expect(progressPercent(0.42)).toBe(42);
    expect(progressPercent(-1)).toBe(0);
    expect(progressPercent(2)).toBe(100);
    expect(progressPercent(Number.NaN)).toBe(0);
  });
});

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
] as const)('ProgressBar — colours and size from the theme, in %s mode', (scheme, theme) => {
  beforeEach(() => {
    appearance.mockReturnValue(scheme);
  });

  it('draws a borderStrong track and a primary fill, 4dp and round, by default', () => {
    const { trackStyle, fillStyle } = draw({ value: 0.5 });

    expect(trackStyle.backgroundColor).toBe(theme.colors.borderStrong);
    expect(fillStyle.backgroundColor).toBe(theme.colors.primary);
    expect(trackStyle.height).toBe(theme.spacing.xs);
    expect(trackStyle.borderRadius).toBe(theme.radius.full);
    expect(fillStyle.borderRadius).toBe(theme.radius.full);
  });

  it('takes the colours and thickness its caller names', () => {
    const { trackStyle, fillStyle } = draw({
      value: 0.5,
      trackColor: 'border',
      fillColor: 'warning',
      thickness: 'sm',
    });

    expect(trackStyle.backgroundColor).toBe(theme.colors.border);
    expect(fillStyle.backgroundColor).toBe(theme.colors.warning);
    expect(trackStyle.height).toBe(theme.spacing.sm);
  });

  it('squares its ends when laid along an edge', () => {
    const { trackStyle, fillStyle } = draw({ value: 0.5, rounded: false });

    expect(trackStyle.borderRadius).toBe(0);
    expect(fillStyle.borderRadius).toBe(0);
  });
});

describe('ProgressBar — what it says', () => {
  it('says nothing by itself: no role, no value, not a stop', () => {
    const { track } = draw({ value: 0.5 });

    expect(track.props.accessible).toBeUndefined();
    expect(track.props.accessibilityRole).toBeUndefined();
    expect(track.props.accessibilityValue).toBeUndefined();
  });

  it('carries exactly what its caller passes when the bar is to be the stop', () => {
    const { track } = draw({
      value: 0.5,
      accessible: true,
      accessibilityRole: 'progressbar',
      accessibilityLabel: 'Uploading',
      accessibilityValue: { min: 0, max: 100, now: 50 },
    });

    expect(track.props.accessible).toBe(true);
    expect(track.props.accessibilityRole).toBe('progressbar');
    expect(track.props.accessibilityLabel).toBe('Uploading');
    expect(track.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 50 });
  });

  it('can be hidden whole, for a caller that speaks for it', () => {
    const { track } = draw({
      value: 0.5,
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });

    expect(track.props.accessibilityElementsHidden).toBe(true);
    expect(track.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
