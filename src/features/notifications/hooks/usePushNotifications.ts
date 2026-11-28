/**
 * usePushNotifications
 *
 * What the app does with push notifications (phase5-contract.md section 6.3,
 * owner-approved 28/11/2026). Called once, by AppRoot, for the life of the app:
 *
 * - **A session begins** — a sign in, or a stored session restored at start-up
 *   — and the device's token is paired with it (`registerPushDevice`). Only a
 *   sign in may ask to show notifications, once per device; the app never asks
 *   as it opens. Unpairing is part of signing out, in `authThunks`, so it
 *   happens however the session ends.
 * - **A push arrives with the app in front.** The system shows nothing then, so
 *   the app does: a toast with the notification's own title and message, and
 *   `notificationsArrived` so the bell's count and an open inbox read again.
 * - **A push is tapped** — the app in the background, or closed and started by
 *   the tap. The signed-in role's own details screen opens for `requestId`
 *   (the customer's `RequestDetails`, the vendor's `VendorRequestDetails`), by
 *   id and nothing else; a push without one opens Notifications.
 *
 *   Screen → this hook → PushService → Firebase (device seam)
 *
 * ⚠️ A tap waits for the app to be able to show it. Started from closed, the
 * stored session is still being read and no navigator exists yet, so the tap
 * is held until the session is known and the role's own stack is mounted, then
 * opened once. The hook hears that moment through the callback it returns,
 * which AppRoot hands to every navigation container it mounts (`onReady`,
 * `onStateChange`).
 *
 * ⚠️ Not through `navigationRef.addListener`. That is how it was until
 * 28/11/2026, and a held tap stopped opening once the language had been
 * changed: the change re-mounts the container under this hook, and the ref
 * remembers a listener for the next container only if it was added while no
 * container was mounted — added while one was, it went with that container.
 * A container's own props are given to each new one, whatever the order of
 * mounting (`__tests__/navigation/navigationRefRemount.test.tsx`). Nobody signed in
 * means nothing opens and the tap is dropped — never a screen on the sign-in
 * flow. A role whose stack does not have the route (a vendor still setting up
 * their profile) opens nothing either, rather than the route later.
 *
 * ⚠️ The route is chosen here by the session's role, never by the message:
 * `data` carries ids and the backend's `type` token, and neither may pick a
 * screen (the rule `notificationLinks.ts` keeps for the inbox).
 *
 * ⚠️ With push off (no Firebase config) the service answers nothing and
 * calls no listener, so none of this ever runs and the app is as before.
 */

import { useCallback, useEffect, useRef } from 'react';
import { CommonActions } from '@react-navigation/native';

import { createLogger } from '@/core/logger/Logger';
import { useAuthSession } from '@/features/auth/hooks/useAuth';
import type { AuthStatus, UserRole } from '@/features/auth/types';
import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import { notificationsArrived } from '@/features/notifications/state/notificationSync';
import { navigationRef } from '@/navigation/navigationRef';
import { useToast } from '@/shared/components';
import { registerPushDevice } from '@/shared/services/pushRegistration';
import { getService } from '@/shared/services/ServiceRegistry';
import type { PushMessage } from '@/shared/services/types/PushService';

const log = createLogger('usePushNotifications');

/** Where a tapped push opens: a route in the signed-in role's own stack, by id only. */
export interface PushDestination {
  name: 'RequestDetails' | 'VendorRequestDetails' | 'Notifications';
  params?: { requestId: string };
}

/**
 * The request's details in this role's own application when the push names a
 * request, otherwise the inbox — which both stacks register as `Notifications`.
 */
export function pushDestination(role: UserRole, message: PushMessage): PushDestination {
  const { requestId } = message.data;
  if (requestId) {
    return {
      name: role === 'vendor' ? 'VendorRequestDetails' : 'RequestDetails',
      params: { requestId },
    };
  }
  return { name: 'Notifications' };
}

/**
 * A route only each role's own stack has at its root: seeing one means that
 * role's application is the one mounted, not the sign-in flow it replaced.
 */
const ROLE_ROOTS: Readonly<Record<UserRole, readonly string[]>> = {
  customer: ['CustomerTabs'],
  vendor: ['VendorTabs', 'VendorProfileSetup'],
};

/** The toast for a push in front: its own words, as the inbox shows them. */
function toastMessage(message: PushMessage): string {
  const text = [message.title, message.body].filter(Boolean).join('\n');
  return text.length > 0 ? text : NOTIFICATIONS_COPY.push.fallback;
}

/**
 * Returns the callback for the navigation container's `onReady` and
 * `onStateChange`: the moments a held tap may have somewhere to open.
 */
export function usePushNotifications(): () => void {
  const { status, role } = useAuthSession();
  const { showToast } = useToast();

  /** The session now, for listeners that outlive the render that added them. */
  const session = useRef<{ status: AuthStatus; role: UserRole | null }>({ status, role });
  session.current = { status, role };

  /* A session begins: pair the device with it. */
  const previousStatus = useRef<AuthStatus | null>(null);
  useEffect(() => {
    const before = previousStatus.current;
    previousStatus.current = status;
    if (status !== 'authenticated' || before === 'authenticated') {
      return;
    }

    // Asking is for a sign in, which leaves `unauthenticated`. A session
    // restored at start-up leaves `bootstrapping`, and the app never asks as it opens.
    registerPushDevice({ mayAskPermission: before === 'unauthenticated' }).catch(() => undefined);
  }, [status]);

  /* A push in front. */
  useEffect(
    () =>
      getService('push').onForegroundMessage(message => {
        if (session.current.status !== 'authenticated') {
          return;
        }
        showToast({ message: toastMessage(message), tone: 'info', icon: 'notifications' });
        notificationsArrived();
      }),
    [showToast],
  );

  /* A push tapped: held until there is a signed-in application to open it in. */
  const pending = useRef<PushMessage | null>(null);

  const deliver = useCallback(() => {
    const message = pending.current;
    if (!message) {
      return;
    }

    const { status: now, role: who } = session.current;
    if (now === 'bootstrapping') {
      // The stored session is still being read; the status change calls again.
      return;
    }
    if (now !== 'authenticated' || !who) {
      pending.current = null;
      log.info('Push tapped with nobody signed in; nothing opened');
      return;
    }
    if (!navigationRef.isReady()) {
      // No navigator yet — the splash, or the vendor's profile check. `onReady` calls again.
      return;
    }

    const routeNames = navigationRef.getRootState()?.routeNames ?? [];
    if (!ROLE_ROOTS[who].some(root => routeNames.includes(root))) {
      // The sign-in flow is still the one mounted; the next `onStateChange` calls again.
      return;
    }

    pending.current = null;
    const destination = pushDestination(who, message);
    if (!routeNames.includes(destination.name)) {
      log.info('Push tapped for a screen this account cannot open yet', {
        route: destination.name,
      });
      return;
    }

    // Name and params apart: React Navigation 7 warns (a debug LogBox, seen on the
    // owner's phone 28/11/2026) when `navigate` is given one object.
    navigationRef.dispatch(CommonActions.navigate(destination.name, destination.params));
  }, []);

  const open = useCallback(
    (message: PushMessage) => {
      // The newest tap wins: it is the one the person is looking at.
      pending.current = message;
      deliver();
    },
    [deliver],
  );

  useEffect(() => {
    deliver();
  }, [deliver, status, role]);

  useEffect(() => {
    const push = getService('push');
    let active = true;

    const stopOpened = push.onMessageOpened(open);
    push
      .getInitialMessage()
      .then(message => {
        if (active && message) {
          open(message);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      stopOpened();
    };
  }, [open]);

  return deliver;
}
