/**
 * Every stack in the app runs with no header, so screens that could be
 * returned from showed nothing that said so — sign in first among them.
 *
 * The Android hardware button and the iOS edge swipe both worked, so this was
 * never a dead end — but neither is visible. A user who does not know the
 * gesture had no way off a pushed screen that they could see.
 *
 * These tests pin the affordance and, just as importantly, its limits: it is a
 * button with a name and a hint, it is big enough to hit, and it does exactly
 * what the gesture does and nothing more. A back control that navigated
 * somewhere of its own choosing would be a second opinion about the stack.
 *
 * Written for auth's own copy of this control, `AuthBackButton`, and kept when
 * the two became one (21/10/2026): the rules were the same rules. Auth's words
 * on it are pinned in AuthTopBar's suite.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

import { BackButton, type BackButtonProps } from '@/shared/components';
import { ThemeProvider, lightTheme } from '@/shared/theme';

/** Every renderer a test made, unmounted after it (CLAUDE.md section 7). */
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
});

async function render(
  onBack: () => void = jest.fn(),
  props: Partial<Omit<BackButtonProps, 'onPress'>> = {},
) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <BackButton onPress={onBack} testID="header-back" {...props} />
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  /**
   * The Pressable itself, not the component wrapping it or the View beneath.
   * All three carry the testID, and the wrapper takes the handler as `onPress`
   * too; only the Pressable has the handler and the role together, and the
   * style function that resolves the pressed state.
   */
  const control = () => {
    const [pressable] = renderer.root.findAll(
      node =>
        node.props?.testID === 'header-back' &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props.onPress === 'function',
    );
    return pressable;
  };

  return {
    renderer,
    control,
    press: async () => {
      await act(async () => {
        control().props.onPress();
      });
    },
  };
}

describe('BackButton', () => {
  it('is a button a screen reader can name and explain, without being told how', async () => {
    const { control } = await render();

    expect(control().props.accessibilityRole).toBe('button');
    expect(control().props.accessibilityLabel).toBe('Back');
    expect(control().props.accessibilityHint).toBe('Returns to the previous screen');
  });

  it('says the caller’s words when it is given them', async () => {
    const { control } = await render(jest.fn(), {
      accessibilityLabel: 'Back to services',
      accessibilityHint: 'Returns to the list of services',
    });

    expect(control().props.accessibilityLabel).toBe('Back to services');
    expect(control().props.accessibilityHint).toBe('Returns to the list of services');
  });

  it('steps its fill up when pressed rather than fading the chevron', async () => {
    const { control } = await render();

    const at = (pressed: boolean) => StyleSheet.flatten(control().props.style({ pressed }));

    expect(at(false).backgroundColor).toBe(lightTheme.colors.surface);
    expect(at(true).backgroundColor).toBe(lightTheme.colors.surfaceAlt);
    // The ring is what carries the disc where a shadow cannot (the dark theme).
    expect(at(false).borderColor).toBe(lightTheme.colors.borderStrong);
    expect(at(true).opacity).toBeUndefined();
  });

  it('is at least a full touch target, not the size of the chevron', async () => {
    const { control } = await render();

    // The glyph is 24dp. Hitting a 24dp target is the defect, not the design.
    const style = control().props.style({ pressed: false });
    const frame = style.find(
      (entry: { width?: number } | undefined) => entry?.width !== undefined,
    );

    expect(frame.width).toBeGreaterThanOrEqual(lightTheme.hitSlop.minTarget);
    expect(frame.height).toBeGreaterThanOrEqual(lightTheme.hitSlop.minTarget);
  });

  it('hands the press straight back to the caller', async () => {
    const onBack = jest.fn();
    const { press } = await render(onBack);

    await press();

    // Once, and to the caller's own handler — `navigation.goBack`, so the
    // same movement the gesture makes. What arguments a real press passes is
    // the Pressable's business; this test presses without an event, so it
    // proves the hand-over, not what travels with it.
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does not act until it is pressed', async () => {
    const onBack = jest.fn();
    await render(onBack);

    // A back control that fires on mount would empty the stack on arrival.
    expect(onBack).not.toHaveBeenCalled();
  });
});
