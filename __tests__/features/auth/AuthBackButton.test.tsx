/**
 * Three auth screens could be returned from and showed nothing that said so.
 *
 * The Android hardware button and the iOS edge swipe both worked, so this was
 * never a dead end — but neither is visible, and the auth stack renders no
 * header. A user who does not know the gesture had no way off sign in that they
 * could see.
 *
 * These tests pin the affordance and, just as importantly, its limits: it is a
 * button with a name and a hint, it is big enough to hit, and it does exactly
 * what the gesture does and nothing more. A back control that navigated
 * somewhere of its own choosing would be a second opinion about the stack.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { AuthBackButton } from '@/features/auth/components/AuthBackButton';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { ThemeProvider, lightTheme } from '@/shared/theme';

async function render(onBack: () => void = jest.fn()) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthBackButton onBack={onBack} testID="header-back" />
      </ThemeProvider>,
    );
  });

  /**
   * The Pressable itself, not the component wrapping it or the View beneath.
   * Both carry the testID; only this one carries the handler and the style
   * function that resolves the pressed state.
   */
  const control = () => {
    const [pressable] = renderer.root.findAll(
      node => node.props?.testID === 'header-back' && typeof node.props.onPress === 'function',
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

describe('AuthBackButton', () => {
  it('is a button a screen reader can name and explain', async () => {
    const { control } = await render();

    expect(control().props.accessibilityRole).toBe('button');
    expect(control().props.accessibilityLabel).toBe(AUTH_COPY.common.back);
    expect(control().props.accessibilityHint).toBe(AUTH_COPY.common.backHint);
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

    // Once, with nothing added. The caller passes `navigation.goBack`, so this
    // is the same movement the gesture makes.
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledWith();
  });

  it('does not act until it is pressed', async () => {
    const onBack = jest.fn();
    await render(onBack);

    // A back control that fires on mount would empty the stack on arrival.
    expect(onBack).not.toHaveBeenCalled();
  });
});
