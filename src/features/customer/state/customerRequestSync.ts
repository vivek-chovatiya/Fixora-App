/**
 * customerRequestSync
 *
 * Tells the screens listing the customer's requests that one of them changed —
 * a signal, and nothing else (the idea of the vendor's `VendorWorkSync`, Phase
 * 3E-4, and of `notificationSync`, 3F-2).
 *
 * Home's recent requests and My Requests each read the service for themselves,
 * and both stay mounted under Request Details: the tabs sit beneath the stack
 * screen it is pushed as. A request cancelled there would still read
 * "Searching" on the card behind it until somebody pulled. So once the service
 * has answered a cancellation — or refused one, or no longer knows the request,
 * which both mean the card behind is wrong too — Request Details says so here,
 * and each list reads its service again.
 *
 * ⚠️ A signal, not a store. It carries no request and no status; the service
 * stays the only answer to what a request is, and each list keeps reading it in
 * its own way (Home's stale notice, My Requests' inline retry). A cache shared
 * between them is what this deliberately avoids building.
 *
 * ⚠️ Not a re-read on every focus. Whether My Requests should refresh itself
 * whenever its tab is shown is an open question for the owner (3D-5); this only
 * answers "a change this app made", as the vendor's signal answered it for the
 * vendor's own answers.
 *
 * A module rather than a context, as `notificationSync` is: a provider would be
 * threaded round the customer navigator to carry a message with nothing in it.
 * Listeners are added by mounted lists and removed when they unmount, and
 * signing out unmounts every one of them, so nothing outlives the session that
 * heard it.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Calls `listener` whenever one of the customer's requests changes. Returns the way to stop. */
export function onCustomerRequestsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Says one of the customer's requests changed. Whoever lists them reads them again. */
export function customerRequestsChanged(): void {
  // A copy, so a listener that stops listening while being told cannot skip the next one.
  [...listeners].forEach(listener => listener());
}
