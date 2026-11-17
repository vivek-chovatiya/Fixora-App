/**
 * The two dialogs on the platform `Modal` keep clear of the status bar and the
 * gesture bar, whatever the device's insets are — found on a Pixel 7, where the
 * time list's title was drawn under the status bar (21/10/2026).
 *
 * The insets are mocked here, for this file only: the app-wide setup answers
 * zero on every edge, which is exactly the case in which the defect cannot be
 * seen. And while the offline banner shows, the provider every screen sits
 * under reports no top inset at all, so the window offset has to carry it.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

import { TimeChoiceDialog } from '@/features/vendor/components/TimeChoiceDialog';
import { ConfirmDialog, WindowOffsetContext } from '@/shared/components';
import { ThemeProvider, spacing } from '@/shared/theme';

let mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => mockInsets,
}));

/** A Pixel 7 in dp: a 52dp status bar, a 24dp gesture bar. */
const PIXEL_7 = { top: 52, right: 0, bottom: 24, left: 0 };

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
});

function render(dialog: React.ReactElement, windowOffset = 0) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <WindowOffsetContext.Provider value={windowOffset}>{dialog}</WindowOffsetContext.Provider>
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);
  return renderer;
}

/** The backdrop: the nearest drawn view above the dismissing press area. */
function backdropPadding(renderer: ReactTestRenderer.ReactTestRenderer, testID: string) {
  const [pressArea] = renderer.root.findAll(
    node => typeof node.type === 'string' && node.props?.testID === `${testID}-backdrop`,
  );
  let node = pressArea.parent;
  while (node && typeof node.type !== 'string') {
    node = node.parent;
  }
  const style = StyleSheet.flatten(node!.props.style);
  return {
    top: style.paddingTop,
    bottom: style.paddingBottom,
    left: style.paddingLeft ?? style.paddingHorizontal,
    right: style.paddingRight ?? style.paddingHorizontal,
  };
}

const confirmDialog = (
  <ConfirmDialog
    visible
    title="Log out?"
    cancelLabel="Cancel"
    confirmLabel="Log out"
    onConfirm={jest.fn()}
    onCancel={jest.fn()}
    testID="dialog"
  />
);

const timeDialog = (
  <TimeChoiceDialog
    visible
    title="Monday closes at"
    options={[
      { value: '09:00', label: '9:00 AM' },
      { value: '09:30', label: '9:30 AM' },
    ]}
    value="09:00"
    onChoose={jest.fn()}
    onCancel={jest.fn()}
    groupLabel="Closing times"
    cancelLabel="Cancel"
    testID="times"
  />
);

describe.each([
  ['ConfirmDialog', confirmDialog, 'dialog'],
  ['TimeChoiceDialog', timeDialog, 'times'],
])('%s backdrop', (_name, dialog, testID) => {
  it('adds the status bar and the gesture bar to its own spacing, top and bottom', () => {
    mockInsets = PIXEL_7;

    expect(backdropPadding(render(dialog), testID)).toEqual({
      top: spacing.xl + 52,
      bottom: spacing.xl + 24,
      left: spacing.xl,
      right: spacing.xl,
    });
  });

  it('is the spacing alone on a device with no bars over the window', () => {
    expect(backdropPadding(render(dialog), testID)).toEqual({
      top: spacing.xl,
      bottom: spacing.xl,
      left: spacing.xl,
      right: spacing.xl,
    });
  });

  it('stays below the offline banner, which has already taken the status bar’s inset', () => {
    // Under the banner the screens' provider reports no top inset; the banner's
    // height is the window offset, and it covers the status bar.
    mockInsets = { ...PIXEL_7, top: 0 };

    expect(backdropPadding(render(dialog, 96), testID).top).toBe(spacing.xl + 96);
  });
});
