/**
 * ConfirmDialog asks once, and every way out but the confirm button is Cancel —
 * except while the confirmed action runs, when nothing dismisses it and nothing
 * can be pressed twice.
 *
 * And it lays its two answers out by itself: side by side when both labels fit
 * their half of the row at this window, one above the other when either might
 * not — a button's label is one line, so a half that is too narrow cuts it off.
 * The window is set for each of those tests; Jest's default (750dp at font
 * scale 2) is no phone anybody holds.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Dimensions, Modal, StyleSheet } from 'react-native';

import { ConfirmDialog, type ConfirmDialogProps } from '@/shared/components';
import { answersFitSideBySide } from '@/shared/components/ConfirmDialog';
import { lightTheme, ThemeProvider } from '@/shared/theme';

const ORIGINAL_WINDOW = Dimensions.get('window');
const ORIGINAL_SCREEN = Dimensions.get('screen');

/**
 * A phone window, as Android reports one: width in dp and the system font
 * scale. Inside `act`, because a dialog already on screen hears the change.
 */
function setWindow(width: number, fontScale = 1) {
  const metrics = { width, height: 800, scale: 2.625, fontScale };
  act(() => {
    Dimensions.set({ window: metrics, screen: metrics });
  });
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  // Unmounted first, so putting the window back is news to nobody.
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  Dimensions.set({ window: ORIGINAL_WINDOW, screen: ORIGINAL_SCREEN });
});

function render(overrides: Partial<ConfirmDialogProps> = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <ConfirmDialog
          visible
          title="Log out?"
          message="You will need to sign in again to access your account."
          cancelLabel="Cancel"
          confirmLabel="Log out"
          onConfirm={onConfirm}
          onCancel={onCancel}
          testID="dialog"
          {...overrides}
        />
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  const button = (label: string) =>
    renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === label &&
        typeof node.props?.onPress === 'function',
    )[0];

  const backdrop = () =>
    renderer.root.findAll(
      node => node.props?.testID === 'dialog-backdrop' && typeof node.props?.onPress === 'function',
    )[0];

  return { renderer, onConfirm, onCancel, button, backdrop, modal: () => renderer.root.findByType(Modal) };
}

describe('ConfirmDialog', () => {
  it('is a modal named by its title, with a heading and the message', () => {
    const { renderer } = render();

    const [dialog] = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.testID === 'dialog',
    );
    expect(dialog.props.accessibilityViewIsModal).toBe(true);
    expect(dialog.props.accessibilityLabel).toBe('Log out?');
    expect(
      renderer.root.findAll(
        node => node.props?.accessibilityRole === 'header' && node.props?.children === 'Log out?',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('confirms only from the confirm button', () => {
    const { button, onConfirm, onCancel } = render();

    act(() => button('Log out').props.onPress());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('treats Cancel, the back button and the backdrop as Cancel', () => {
    const { button, backdrop, modal, onCancel, onConfirm } = render();

    act(() => button('Cancel').props.onPress());
    act(() => modal().props.onRequestClose());
    act(() => backdrop().props.onPress());

    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps the backdrop out of the screen reader’s way', () => {
    const { backdrop } = render();

    expect(backdrop().props.importantForAccessibility).toBe('no');
  });

  it('refuses every dismissal while confirming, and shows the confirm button busy', () => {
    const { button, backdrop, modal, onCancel } = render({ isConfirming: true });

    act(() => modal().props.onRequestClose());
    // The backdrop has nothing to do while the action runs.
    expect(backdrop()).toBeUndefined();
    expect(onCancel).not.toHaveBeenCalled();

    expect(button('Log out')?.props.accessibilityState).toMatchObject({ busy: true });
    expect(button('Cancel')?.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('draws nothing when not visible', () => {
    const { modal } = render({ visible: false });

    expect(modal().props.visible).toBe(false);
  });

  /**
   * The two answers' container, the style each answer is given, and the order
   * they are rendered in — which is the order a screen reader meets them.
   * `labels` is always [cancel, confirm].
   */
  function layoutOf(renderer: ReactTestRenderer.ReactTestRenderer, labels: [string, string]) {
    const answers = labels.map(
      label => renderer.root.findAll(node => node.props?.label === label && 'variant' in node.props)[0],
    );
    const row = answers[0].parent!;
    return {
      direction: StyleSheet.flatten(row.props.style).flexDirection,
      answers: answers.map(answer => StyleSheet.flatten(answer.props.style)),
      order: row.children.map(child => (typeof child === 'string' ? child : child.props.label)),
    };
  }

  /** Side by side: one row, each answer an equal half, the way out first. */
  function expectRow(layout: ReturnType<typeof layoutOf>, [cancel, confirm]: [string, string]) {
    expect(layout.direction).toBe('row');
    expect(layout.answers.every(style => style.flexBasis === 0)).toBe(true);
    expect(layout.order).toEqual([cancel, confirm]);
  }

  /**
   * Stacked: each answer the dialog's full width, the confirming action on top
   * and the way out at the bottom, nearest the thumb.
   */
  function expectStacked(layout: ReturnType<typeof layoutOf>, [cancel, confirm]: [string, string]) {
    expect(layout.direction).toBe('column');
    expect(layout.answers.every(style => style.alignSelf === 'stretch')).toBe(true);
    expect(layout.answers.every(style => style.flexBasis === undefined)).toBe(true);
    expect(layout.order).toEqual([confirm, cancel]);
  }

  describe('at a 360dp phone', () => {
    beforeEach(() => setWindow(360));

    it('keeps one-word answers side by side', () => {
      // About 86dp each for the words; "Cancel" and "Log out" need far less.
      const { renderer } = render();

      expectRow(layoutOf(renderer, ['Cancel', 'Log out']), ['Cancel', 'Log out']);
    });

    it('stacks the answers by itself when a label would be cut off', () => {
      // "Keep editing" is about 88dp at button size: wider than its half.
      const { renderer } = render({ cancelLabel: 'Keep editing', confirmLabel: 'Discard' });

      expectStacked(layoutOf(renderer, ['Keep editing', 'Discard']), ['Keep editing', 'Discard']);
    });

    it('stacks when only the confirming label is long, the way out at the bottom', () => {
      const { renderer } = render({ cancelLabel: 'Cancel', confirmLabel: 'Stop new requests' });

      expectStacked(layoutOf(renderer, ['Cancel', 'Stop new requests']), [
        'Cancel',
        'Stop new requests',
      ]);
    });

    it('counts the system font size: words a size up need more room than the row has', () => {
      setWindow(360, 1.3);
      const { renderer } = render();

      expectStacked(layoutOf(renderer, ['Cancel', 'Log out']), ['Cancel', 'Log out']);
    });
  });

  describe('at a wider window', () => {
    it('keeps side by side, at 411dp, a label that would be stacked at 360dp', () => {
      // Ten characters: past the 360dp half, inside the 411dp one.
      const labels = { cancelLabel: 'Keep photo', confirmLabel: 'Remove' };

      setWindow(360);
      expectStacked(layoutOf(render(labels).renderer, ['Keep photo', 'Remove']), [
        'Keep photo',
        'Remove',
      ]);

      setWindow(411);
      expectRow(layoutOf(render(labels).renderer, ['Keep photo', 'Remove']), [
        'Keep photo',
        'Remove',
      ]);
    });

    it('still stacks a label too long for any phone, and a tablet gives it no more room', () => {
      // The dialog stops growing at 360dp wide, so a tablet's half is a large phone's.
      for (const width of [411, 1080]) {
        setWindow(width);
        const { renderer } = render({ cancelLabel: 'Keep request', confirmLabel: 'Cancel request' });

        expectStacked(layoutOf(renderer, ['Keep request', 'Cancel request']), [
          'Keep request',
          'Cancel request',
        ]);
      }
    });

    it('lays itself out again when the window changes under it', () => {
      setWindow(411);
      const { renderer } = render({ cancelLabel: 'Keep photo', confirmLabel: 'Remove' });
      expectRow(layoutOf(renderer, ['Keep photo', 'Remove']), ['Keep photo', 'Remove']);

      // Split screen, or a narrower window after rotating back.
      setWindow(360);

      expectStacked(layoutOf(renderer, ['Keep photo', 'Remove']), ['Keep photo', 'Remove']);
    });
  });

  describe('when the caller overrides it', () => {
    it('stacks short answers when asked, at any width', () => {
      setWindow(411);
      const { renderer } = render({ stacked: true });

      expectStacked(layoutOf(renderer, ['Cancel', 'Log out']), ['Cancel', 'Log out']);
    });

    it('keeps long answers side by side when told to', () => {
      setWindow(360);
      const { renderer } = render({
        stacked: false,
        cancelLabel: 'Keep request',
        confirmLabel: 'Cancel request',
      });

      expectRow(layoutOf(renderer, ['Keep request', 'Cancel request']), [
        'Keep request',
        'Cancel request',
      ]);
    });
  });
});

/**
 * The calculation on its own, at its edges. Room for a label is 86dp at 360dp
 * and 106dp from 400dp up; a character is taken as 0.6 of the 16sp font,
 * 9.6dp at font scale 1 — so eight characters fit at 360dp and nine do not,
 * eleven fit at 400dp and up and twelve do not.
 */
describe('answersFitSideBySide', () => {
  const fits = (length: number, width: number, fontScale = 1) =>
    answersFitSideBySide(['Cancel', 'x'.repeat(length)], { width, fontScale }, lightTheme);

  it('gives each label 86dp at 360dp', () => {
    expect(fits(8, 360)).toBe(true);
    expect(fits(9, 360)).toBe(false);
  });

  it('gives each label 106dp once the dialog reaches its widest, and no more after', () => {
    for (const width of [400, 411, 600, 1080]) {
      expect(fits(11, width)).toBe(true);
      expect(fits(12, width)).toBe(false);
    }
  });

  it('asks about both labels, not only the confirming one', () => {
    const window = { width: 360, fontScale: 1 };

    expect(answersFitSideBySide(['x'.repeat(9), 'Remove'], window, lightTheme)).toBe(false);
  });

  it('scales with the system font size', () => {
    // At 1.3 a character is 12.48dp: six fit in 86dp, seven do not.
    expect(fits(6, 360, 1.3)).toBe(true);
    expect(fits(7, 360, 1.3)).toBe(false);
  });

  it('keeps every two-answer dialog in the app today side by side at 360dp, where its labels are one word', () => {
    // The pairs the app's dialogs use, at the narrowest phone the app supports.
    const pairs: [string, string][] = [
      ['Cancel', 'Log out'],
      ['Cancel', 'Delete'],
      ['Cancel', 'Reject'],
      ['Cancel', 'Complete'],
      ['Cancel', 'Remove'],
      ['Cancel', 'Disable'],
      ['Cancel', 'Stop'],
      ['Stay', 'Leave'],
    ];
    for (const pair of pairs) {
      expect(answersFitSideBySide(pair, { width: 360, fontScale: 1 }, lightTheme)).toBe(true);
    }
  });
});
