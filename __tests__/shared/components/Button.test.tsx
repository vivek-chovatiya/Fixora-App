/**
 * The danger button has to stay readable in the dark (owner's decision,
 * 21/10/2026). Its label, its icon and its busy spinner are drawn in
 * `onDanger` — white in both themes, 4.8:1 on the danger red — and never in
 * `textInverse`, which flips to near-black in dark mode and is 4.2:1 there,
 * under the 4.5:1 a label needs. Dark is where the borrowed token fails, so
 * dark is what these tests render.
 *
 * The colour change must leave the button's own states alone: busy still
 * locks it and says so, disabled still refuses a press.
 *
 * Phase 3G-4 (21/10/2026) added two rules, tested in both themes:
 *
 * - a press shows on the filled danger button — `dangerPressed`, where the
 *   pressed fill used to be `danger` itself, so a press changed nothing
 * - the tonal `dangerSecondary` is a red tint with `onDangerSubtle` words,
 *   never the base red (under 4.5:1 on its own tint), its own pressed step,
 *   and the same lock, busy state and refusals as every other variant
 *
 * Colours are read from the theme objects, never written here, so a token
 * changed later is still checked against the rule rather than a copy of it.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

import { Button, type ButtonProps } from '@/shared/components';
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

/** What a 16sp label needs (WCAG 1.4.3): it is not large text. */
const LABEL_CONTRAST = 4.5;

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  appearance.mockReset();
});

function render(props: Partial<ButtonProps> = {}) {
  const onPress = jest.fn();

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <Button label="Log out" variant="danger" icon="logout" onPress={onPress} {...props} />
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  /** The Pressable itself: the node with both the role and the handler. */
  const control = () =>
    renderer.root.findAll(
      node => node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function',
    )[0];

  /** The host text node that draws the label. */
  const labelColor = () => {
    const [text] = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.children === (props.label ?? 'Log out'),
    );
    return StyleSheet.flatten(text.props.style).color;
  };

  /**
   * The glyph's resolved colour, as the icon library receives it — the node
   * with a numeric size, not the `Icon` above it, whose colour is still a token
   * name.
   */
  const iconColor = (glyph: string) =>
    renderer.root.findAll(
      node => node.props?.name === glyph && typeof node.props?.size === 'number',
    )[0]?.props.color;

  /**
   * The capsule's fill at rest or under a finger — `Pressable` hands its
   * style function `pressed`, so the function is asked directly.
   */
  const fill = (pressed: boolean) =>
    StyleSheet.flatten(control().props.style({ pressed, hovered: false })).backgroundColor;

  return { renderer, onPress, control, labelColor, iconColor, fill };
}

describe.each([
  ['dark', darkTheme],
  ['light', lightTheme],
] as const)('Button — a press shows, in %s mode', (scheme, theme) => {
  beforeEach(() => {
    appearance.mockReturnValue(scheme);
  });

  it('darkens the filled danger button to dangerPressed', () => {
    const { fill } = render();

    expect(fill(false)).toBe(theme.colors.danger);
    expect(fill(true)).toBe(theme.colors.dangerPressed);
    // The defect itself: the pressed fill was the resting one, so nothing changed.
    expect(fill(true)).not.toBe(fill(false));
  });

  it('keeps the danger button white-labelled on its pressed fill, and readable there', () => {
    const { labelColor, fill } = render();

    // The label does not follow the press, so it must read on both fills.
    expect(labelColor()).toBe(theme.colors.onDanger);
    expect(contrast(labelColor(), fill(true))).toBeGreaterThanOrEqual(LABEL_CONTRAST);
  });

  it('shows no press on a busy or disabled danger button', () => {
    expect(render({ isLoading: true }).fill(true)).toBe(theme.colors.danger);
    expect(render({ disabled: true }).fill(true)).toBe(theme.colors.danger);
  });
});

describe.each([
  ['dark', darkTheme],
  ['light', lightTheme],
] as const)('Button — the quiet danger variant in %s mode', (scheme, theme) => {
  beforeEach(() => {
    appearance.mockReturnValue(scheme);
  });

  const quiet = (props: Partial<ButtonProps> = {}) =>
    render({ variant: 'dangerSecondary', label: 'Disable member', icon: 'remove', ...props });

  it('is a red tint, stepping to its own pressed tint', () => {
    const { fill } = quiet();

    expect(fill(false)).toBe(theme.colors.dangerSubtle);
    expect(fill(true)).toBe(theme.colors.dangerSubtlePressed);
    expect(fill(true)).not.toBe(fill(false));
  });

  it('is quieter than the filled danger button: never the danger fill, at rest or pressed', () => {
    const { fill } = quiet();

    expect([fill(false), fill(true)]).not.toContain(theme.colors.danger);
    expect([fill(false), fill(true)]).not.toContain(theme.colors.dangerPressed);
  });

  it('words and icon in onDangerSubtle — never the base red, which is too faint on the tint', () => {
    const { labelColor, iconColor } = quiet();

    expect(labelColor()).toBe(theme.colors.onDangerSubtle);
    expect(iconColor(theme.icons.remove)).toBe(theme.colors.onDangerSubtle);
    expect(labelColor()).not.toBe(theme.colors.danger);
  });

  it('reads at 4.5:1 or more on its tint, at rest and pressed', () => {
    const { labelColor, fill } = quiet();

    expect(contrast(labelColor(), fill(false))).toBeGreaterThanOrEqual(LABEL_CONTRAST);
    expect(contrast(labelColor(), fill(true))).toBeGreaterThanOrEqual(LABEL_CONTRAST);
    // Why the base red could not be the label: it falls short on its own tint.
    expect(contrast(theme.colors.danger, fill(false))).toBeLessThan(LABEL_CONTRAST);
  });

  it('is a tint that differs from the page it sits on', () => {
    const { fill } = quiet();

    // 1.17:1 in light and 1.25:1 in dark when chosen — above the secondary
    // button's grey in light (1.05:1). A floor, so a later tint cannot fade
    // into the page unnoticed.
    expect(contrast(fill(false), theme.colors.background)).toBeGreaterThanOrEqual(1.15);
    expect(fill(false)).not.toBe(theme.colors.surface);
    expect(fill(false)).not.toBe(theme.colors.surfaceAlt);
  });

  it('spins in its label colour while busy, and is locked and says so', () => {
    const { renderer, control, onPress, fill } = quiet({ isLoading: true });

    expect(renderer.root.findByType(ActivityIndicator).props.color).toBe(theme.colors.onDangerSubtle);
    expect(control().props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(StyleSheet.flatten(control().props.style({ pressed: false })).opacity).toBe(
      theme.opacity.disabled,
    );
    // Locked: a finger on it shows nothing, and the press goes nowhere.
    expect(fill(true)).toBe(theme.colors.dangerSubtle);
    act(() => control().props.onPress());
    expect(onPress).not.toHaveBeenCalled();
  });

  it('refuses a press when disabled, and says so', () => {
    const { control, onPress } = quiet({ disabled: true });

    expect(control().props.accessibilityState).toEqual({ disabled: true, busy: false });
    act(() => control().props.onPress());
    expect(onPress).not.toHaveBeenCalled();
  });

  it('presses when it is neither busy nor disabled, as a button with its own words', () => {
    const { control, onPress } = quiet({ accessibilityHint: 'Asks first' });

    expect(control().props.accessibilityRole).toBe('button');
    expect(control().props.accessibilityLabel).toBe('Disable member');
    expect(control().props.accessibilityHint).toBe('Asks first');
    expect(control().props.accessibilityState).toEqual({ disabled: false, busy: false });
    expect(StyleSheet.flatten(control().props.style({ pressed: false })).opacity).toBe(1);
    act(() => control().props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Button — the danger variant in dark mode', () => {
  beforeEach(() => {
    appearance.mockReturnValue('dark');
  });

  it('labels it in onDanger, not the near-black textInverse', () => {
    const { labelColor } = render();

    expect(labelColor()).toBe(darkTheme.colors.onDanger);
    // The defect itself: the two tokens differ in dark, and the label must be the readable one.
    expect(darkTheme.colors.textInverse).not.toBe(darkTheme.colors.onDanger);
    expect(labelColor()).not.toBe(darkTheme.colors.textInverse);
  });

  it('draws its icon in the same colour as its words', () => {
    const { iconColor } = render();

    expect(iconColor(darkTheme.icons.logout)).toBe(darkTheme.colors.onDanger);
  });

  it('spins in onDanger while busy, and is locked and says so', () => {
    const { renderer, control, onPress } = render({ isLoading: true });

    expect(renderer.root.findByType(ActivityIndicator).props.color).toBe(darkTheme.colors.onDanger);
    expect(control().props.accessibilityState).toEqual({ disabled: true, busy: true });

    act(() => control().props.onPress());
    expect(onPress).not.toHaveBeenCalled();
  });

  it('still refuses a press when disabled, with the words still in onDanger', () => {
    const { control, onPress, labelColor } = render({ disabled: true });

    expect(control().props.accessibilityState).toEqual({ disabled: true, busy: false });
    act(() => control().props.onPress());
    expect(onPress).not.toHaveBeenCalled();
    expect(labelColor()).toBe(darkTheme.colors.onDanger);
  });

  it('still presses when it is neither busy nor disabled', () => {
    const { control, onPress } = render();

    act(() => control().props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('leaves the other variants’ labels as they were', () => {
    expect(render({ variant: 'primary', label: 'Save' }).labelColor()).toBe(darkTheme.colors.onPrimary);
    expect(render({ variant: 'secondary', label: 'Cancel' }).labelColor()).toBe(
      darkTheme.colors.textPrimary,
    );
  });
});

describe('Button — the danger variant in light mode', () => {
  it('is white on red there too', () => {
    appearance.mockReturnValue('light');
    const { labelColor, iconColor } = render();

    expect(labelColor()).toBe(lightTheme.colors.onDanger);
    expect(iconColor(lightTheme.icons.logout)).toBe(lightTheme.colors.onDanger);
  });
});
