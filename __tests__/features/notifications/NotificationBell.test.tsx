/**
 * The bell and the count behind it, on their own — the navigator suite covers
 * them on Home and the Dashboard.
 *
 * Pinned here:
 *
 * - the badge draws the count, "9+" above nine, and nothing at zero or with no
 *   count; the button's spoken name says the exact number, or "Notifications"
 * - the badge is hidden inside the button, which already says the number
 * - it is a 44dp target, and pressing it is the caller's to decide
 * - the count is read through the service; a failed read is null — no badge —
 *   and never throws; with no navigator around it, it is read once
 * - when the inbox says notifications were read, the count is read again, and
 *   a bell that has gone stops listening
 * - inside a navigator, it is read again each time its screen comes back into
 *   focus, and arrival is still one read
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NavigationContext } from '@react-navigation/native';

import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import { useUnreadNotificationCount } from '@/features/notifications/hooks/useUnreadNotificationCount';
import { notificationsRead } from '@/features/notifications/state/notificationSync';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { NotificationService } from '@/shared/services/types/NotificationService';
import { AppError } from '@/shared/types/error';
import { ThemeProvider } from '@/shared/theme';

const BELL = NOTIFICATIONS_COPY.bell;

type Instance = ReactTestRenderer.ReactTestInstance;

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(renderer => renderer.unmount());
  });
  resetServices();
});

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {});
  }
}

function textOf(node: Instance): string {
  return node.children.map(child => (typeof child === 'string' ? child : textOf(child))).join(' ');
}

async function mount(element: React.ReactElement) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<ThemeProvider>{element}</ThemeProvider>);
  });
  mounted.push(renderer);
  await flush();

  const button = () =>
    renderer.root.findAll(
      node =>
        node.props?.testID === 'bell' &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    )[0];
  const badgeHosts = () =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === 'bell-badge');

  return {
    renderer,
    button,
    badge: () => (badgeHosts().length > 0 ? textOf(badgeHosts()[0]) : null),
    badgeHost: () => badgeHosts()[0],
  };
}

describe('NotificationBell', () => {
  it('draws the count and says it', async () => {
    const view = await mount(<NotificationBell unreadCount={3} onPress={jest.fn()} testID="bell" />);

    expect(view.badge()).toBe('3');
    expect(view.button().props.accessibilityLabel).toBe('Notifications, 3 unread');
    expect(view.button().props.accessibilityHint).toBe(BELL.hint);
  });

  it('draws "9+" above nine and says the exact number', async () => {
    const view = await mount(<NotificationBell unreadCount={14} onPress={jest.fn()} testID="bell" />);

    expect(view.badge()).toBe('9+');
    expect(view.button().props.accessibilityLabel).toBe('Notifications, 14 unread');
  });

  it('draws nothing at zero', async () => {
    const view = await mount(<NotificationBell unreadCount={0} onPress={jest.fn()} testID="bell" />);

    expect(view.badge()).toBeNull();
    expect(view.button().props.accessibilityLabel).toBe(BELL.label);
  });

  it('draws nothing when the count is unknown', async () => {
    const view = await mount(<NotificationBell unreadCount={null} onPress={jest.fn()} testID="bell" />);

    expect(view.badge()).toBeNull();
    expect(view.button().props.accessibilityLabel).toBe('Notifications');
  });

  it('hides the badge inside the button, which already says the number', async () => {
    const view = await mount(<NotificationBell unreadCount={2} onPress={jest.fn()} testID="bell" />);

    expect(view.badgeHost().props.importantForAccessibility).toBe('no-hide-descendants');
    expect(view.badgeHost().props.accessibilityElementsHidden).toBe(true);
  });

  it('is at least 44dp each way', async () => {
    const view = await mount(<NotificationBell unreadCount={2} onPress={jest.fn()} testID="bell" />);

    const style = StyleSheet.flatten(view.button().props.style({ pressed: false }));
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
  });

  it('leaves what a press does to its caller', async () => {
    const onPress = jest.fn();
    const view = await mount(<NotificationBell unreadCount={2} onPress={onPress} testID="bell" />);

    await act(async () => {
      view.button().props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

/** The hook's answer, drawn as the bell would be. */
function CountedBell() {
  const count = useUnreadNotificationCount();
  return <NotificationBell unreadCount={count} onPress={jest.fn()} testID="bell" />;
}

describe('useUnreadNotificationCount', () => {
  function register(getUnreadCount: () => Promise<number>) {
    const stub = jest.fn(getUnreadCount);
    registerService('notification', {
      getUnreadCount: stub,
      // The bell counts; it never lists or marks.
      list: jest.fn(() => {
        throw new Error('list must not be called by the bell');
      }),
      markAsRead: jest.fn(() => {
        throw new Error('markAsRead must not be called by the bell');
      }),
      markAllAsRead: jest.fn(() => {
        throw new Error('markAllAsRead must not be called by the bell');
      }),
    } as unknown as NotificationService);
    return stub;
  }

  it('reads the count through the service, once with no navigator around it', async () => {
    const count = register(async () => 4);
    const view = await mount(<CountedBell />);

    expect(count).toHaveBeenCalledTimes(1);
    expect(view.badge()).toBe('4');
  });

  it('is no badge when the read fails, and does not throw', async () => {
    register(async () => {
      throw new AppError({ kind: 'network', message: 'offline' });
    });
    const view = await mount(<CountedBell />);

    expect(view.badge()).toBeNull();
    expect(view.button().props.accessibilityLabel).toBe('Notifications');
  });

  it('is no badge when the service is not there at all', async () => {
    resetServices();
    const view = await mount(<CountedBell />);

    expect(view.badge()).toBeNull();
  });

  it('drops the badge when a later read fails', async () => {
    let fail = false;
    register(async () => {
      if (fail) {
        throw new AppError({ kind: 'server', message: 'down' });
      }
      return 2;
    });
    const view = await mount(<CountedBell />);
    expect(view.badge()).toBe('2');

    fail = true;
    await act(async () => {
      notificationsRead();
    });
    await flush();

    expect(view.badge()).toBeNull();
  });

  it('reads again when the inbox says notifications were read', async () => {
    let unread = 3;
    const count = register(async () => unread);
    const view = await mount(<CountedBell />);
    expect(view.badge()).toBe('3');

    unread = 1;
    await act(async () => {
      notificationsRead();
    });
    await flush();

    expect(count).toHaveBeenCalledTimes(2);
    expect(view.badge()).toBe('1');
  });

  it('stops listening once the bell has gone', async () => {
    const count = register(async () => 3);
    const view = await mount(<CountedBell />);

    await act(async () => {
      view.renderer.unmount();
    });
    mounted.splice(mounted.indexOf(view.renderer), 1);
    notificationsRead();
    await flush();

    expect(count).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest answer when an older read lands after it', async () => {
    const answers: Array<(value: number) => void> = [];
    register(
      () =>
        new Promise<number>(resolve => {
          answers.push(resolve);
        }),
    );
    const view = await mount(<CountedBell />);

    await act(async () => {
      notificationsRead();
    });
    // The newer read answers first, then the older one.
    await act(async () => {
      answers[1](1);
    });
    await act(async () => {
      answers[0](7);
    });
    await flush();

    expect(view.badge()).toBe('1');
  });

  it('reads again each time its screen comes back into focus, and not on arrival', async () => {
    let unread = 3;
    const count = register(async () => unread);
    const listeners: Record<string, Array<() => void>> = { focus: [], blur: [] };
    let focused = true;
    const navigation = {
      isFocused: () => focused,
      addListener: (event: string, listener: () => void) => {
        listeners[event].push(listener);
        return () => {
          listeners[event] = listeners[event].filter(entry => entry !== listener);
        };
      },
    };
    const fire = async (event: 'focus' | 'blur') => {
      focused = event === 'focus';
      await act(async () => {
        listeners[event].forEach(listener => listener());
      });
      await flush();
    };
    const view = await mount(
      <NavigationContext.Provider value={navigation as never}>
        <CountedBell />
      </NavigationContext.Provider>,
    );

    // The focus a navigator can send as the screen mounts is not a return.
    await fire('focus');
    expect(count).toHaveBeenCalledTimes(1);

    unread = 1;
    await fire('blur');
    await fire('focus');

    expect(count).toHaveBeenCalledTimes(2);
    expect(view.badge()).toBe('1');
  });
});
