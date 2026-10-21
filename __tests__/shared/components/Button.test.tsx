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
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

import { Button, type ButtonProps } from '@/shared/components';
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

  return { renderer, onPress, control, labelColor, iconColor };
}

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
