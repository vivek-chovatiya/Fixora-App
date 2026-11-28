/**
 * notificationSync
 *
 * Tells the bell that notifications were marked as read — a signal, and
 * nothing else (the idea of the vendor's `VendorWorkSync`, Phase 3E-4). Since
 * the inbox can remove them (T133, 28/11/2026) it says so after a removal
 * too, one or all: an unread one removed is one fewer unread. The name stayed,
 * because what the bell does on hearing it — read the count again — did not
 * change.
 *
 * The bell reads the unread count when its screen comes back into focus. That
 * alone is not enough: marking is a call like any other, and a customer who
 * presses "Mark all as read" and goes straight back reaches Home while the
 * call is still out, so the read on focus can land first and count what is no
 * longer unread. Once a mark succeeds, the inbox says so here and the bell —
 * still mounted under the inbox — reads the count again.
 *
 * ⚠️ A signal, not a store. It carries no count and no notification; the
 * service stays the only answer to how many are unread, and the bell reads it.
 * A cached count shared between the two is what this deliberately avoids.
 *
 * ⚠️ A module rather than a context, unlike `VendorWorkSync`. The bell and the
 * inbox are both feature screens of two different applications, and a
 * provider would have to be threaded through both navigators to carry a
 * message with nothing in it. Listeners are added by a mounted bell and
 * removed when it unmounts, and signing out unmounts every one of them, so
 * nothing outlives the session that heard it.
 *
 * A second signal says a notification has *arrived* (phase5-contract.md
 * section 6.3, owner-approved 28/11/2026): a push came in while the app was in
 * front, so the backend has just stored a new one. The bell reads its count
 * again and an open inbox reads its loaded pages again, quietly. Its own set of
 * listeners, because the inbox must hear an arrival but has no reason to hear
 * its own marks.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

const arrivalListeners = new Set<Listener>();

/** Calls `listener` whenever notifications are marked as read. Returns the way to stop. */
export function onNotificationsRead(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Says notifications were marked as read. Whoever shows a count reads it again. */
export function notificationsRead(): void {
  // A copy, so a listener that stops listening while being told cannot skip the next one.
  [...listeners].forEach(listener => listener());
}

/** Calls `listener` whenever a new notification is known to have arrived. Returns the way to stop. */
export function onNotificationsArrived(listener: Listener): () => void {
  arrivalListeners.add(listener);
  return () => {
    arrivalListeners.delete(listener);
  };
}

/** Says a new notification arrived. The count and an open inbox read again. */
export function notificationsArrived(): void {
  [...arrivalListeners].forEach(listener => listener());
}
