/**
 * NotificationCard's swipe to delete (T133, reviewer finding 28/11/2026): a
 * partial swipe used to delete, because the swipe's own threshold — half the
 * delete panel, which spans the row — was the only bar. Pinned here:
 *
 * - the row cannot be swiped until it has been measured, so there is never a
 *   moment with no threshold (or the library's half) standing in front of a
 *   delete;
 * - once measured, the threshold is 60% of the row's own width, recomputed
 *   when the width changes;
 * - only the swipe opening (crossing it) deletes, and then exactly that row;
 * - the screen reader's Delete action is still offered.
 *
 * ⚠️ A drag released short of the threshold cannot be acted out here. The
 * decision is the library's, at release, on the UI thread, from panel widths it
 * takes with Reanimated's `measure` — which answers nothing under Jest, so the
 * panel is zero wide and nothing ever opens. What this file can prove is that
 * the library is handed the right threshold; that a short drag springs back is
 * the device check's.
 */

import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReactTestRenderer, { act } from 'react-test-renderer';

import {
  DELETE_SWIPE_SHARE,
  NotificationCard,
} from '@/features/notifications/components/NotificationCard';
import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import type { AppNotification } from '@/shared/services/types/NotificationService';
import { ThemeProvider } from '@/shared/theme';

type Instance = ReactTestRenderer.ReactTestInstance;

const NOTIFICATION: AppNotification = {
  id: 'ntf_1',
  title: 'Request accepted',
  body: 'Ravi accepted your request.',
  createdAt: new Date().toISOString(),
  read: false,
  type: 'REQUEST_ACCEPTED',
};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
});

function render() {
  const onDelete = jest.fn();
  const onPress = jest.fn();

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <GestureHandlerRootView>
          <NotificationCard
            notification={NOTIFICATION}
            onPress={onPress}
            onDelete={onDelete}
            testID="notification-ntf_1"
          />
        </GestureHandlerRootView>
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  /** The swipe as the card configures it: the element handed `onSwipeableOpen`. */
  const swipe = (): Instance =>
    renderer.root.find(
      node =>
        node.props?.testID === 'notification-ntf_1-swipe' &&
        typeof node.props?.onSwipeableOpen === 'function',
    );

  const layOut = (width: number) => {
    const [row] = renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.testID === 'notification-ntf_1-row',
    );
    act(() => {
      row.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height: 96 } } });
    });
  };

  return { renderer, onDelete, swipe, layOut };
}

describe('NotificationCard — swipe to delete', () => {
  it('cannot be swiped before the row is measured', () => {
    const card = render();

    expect(card.swipe().props.enabled).toBe(false);
    // Never a threshold of zero, which would open — delete — on any touch.
    expect(card.swipe().props.rightThreshold).toBeUndefined();
  });

  it('asks for 60% of the row’s width once measured, and follows the width', () => {
    const card = render();

    card.layOut(380);

    expect(DELETE_SWIPE_SHARE).toBe(0.6);
    expect(card.swipe().props.enabled).toBe(true);
    expect(card.swipe().props.rightThreshold).toBeCloseTo(228);

    // Turned on its side, or a wider screen: the share holds, not a distance.
    card.layOut(800);
    expect(card.swipe().props.rightThreshold).toBeCloseTo(480);
  });

  it('deletes only when the swipe opens, and only that row', () => {
    const card = render();
    card.layOut(380);

    // Dragging, and springing back, call nothing the card listens to.
    expect(card.swipe().props.onSwipeableWillOpen).toBeUndefined();
    expect(card.onDelete).not.toHaveBeenCalled();

    act(() => {
      card.swipe().props.onSwipeableOpen('left');
    });

    expect(card.onDelete).toHaveBeenCalledTimes(1);
    expect(card.onDelete).toHaveBeenCalledWith('ntf_1');
  });

  it('still offers Delete to a screen reader', () => {
    const card = render();

    const [button] = card.renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.accessibilityActions?.length > 0,
    );
    expect(button.props.accessibilityActions).toEqual([
      { name: 'delete', label: NOTIFICATIONS_COPY.inbox.deleteAction },
    ]);

    act(() => {
      button.props.onAccessibilityAction({ nativeEvent: { actionName: 'delete' } });
    });
    expect(card.onDelete).toHaveBeenCalledWith('ntf_1');
  });
});
