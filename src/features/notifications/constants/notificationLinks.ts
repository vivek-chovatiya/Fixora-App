/**
 * Notification links
 *
 * What a notification's `deepLink` asks the app to open, if anything
 * (PROJECT_BIBLE.md section 57).
 *
 * The link is the backend's: an opaque string the app reads and never builds.
 * This understands exactly one shape — `fixora://requests/<reference>` — and
 * answers null for everything else: absent, blank, another scheme, another
 * place in the app, no reference, or anything after it. Null is not an error.
 * The notification is still marked as read; nothing opens, and nothing is said.
 *
 * ⚠️ It never looks at `type`. `AppNotification.type` is a backend token the
 * app must not branch on, so whether a notification opens something is the
 * link's to say and nobody else's.
 *
 * ⚠️ It says *what* to open, never *where*. Which route shows a request is each
 * role's own — the customer's `RequestDetails`, the vendor's
 * `VendorRequestDetails` — and is the screen's to choose. A link that named a
 * route would let a backend string pick a screen, and section 3 keeps each
 * role's navigation its own.
 *
 * ⚠️ A shape it does not know is ignored, never guessed at. A link with more
 * after the reference (`…/REQ-1/review`) is not "the request, roughly": it may
 * mean a place this app does not have yet, and opening the details instead
 * would be the app inventing what the backend meant. A query or a fragment is
 * different — it changes nothing about which request — so it is set aside.
 */

/** A request, by the reference the backend gave. Opened by whichever role is signed in. */
export interface NotificationRequestTarget {
  kind: 'request';
  requestId: string;
}

/** Everything a link can open today. One kind; a second is a new branch here, not a guess. */
export type NotificationTarget = NotificationRequestTarget;

/**
 * `fixora://`, then the path, then an optional query or fragment. Scheme and
 * place compare without case, as URLs do; the reference keeps its own.
 */
const LINK = /^fixora:\/\/([^?#]*)(?:[?#].*)?$/i;

const REQUESTS = 'requests';

/** The request a link opens, or null when it opens nothing this app understands. */
export function parseNotificationLink(link: string | null | undefined): NotificationTarget | null {
  if (typeof link !== 'string') {
    return null;
  }

  const match = LINK.exec(link.trim());
  if (!match) {
    return null;
  }

  // Exactly "requests" and one reference: `fixora:///requests/…`, a missing
  // reference and a trailing segment all fall out here.
  const segments = match[1].split('/');
  if (segments.length !== 2 || segments[0].toLowerCase() !== REQUESTS) {
    return null;
  }

  let requestId: string;
  try {
    requestId = decodeURIComponent(segments[1]);
  } catch {
    // A broken escape is a broken link, not a reference to look up.
    return null;
  }

  return requestId.trim().length > 0 ? { kind: 'request', requestId } : null;
}
