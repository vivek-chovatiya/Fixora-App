/**
 * navigationRef
 *
 * The navigation container's handle, for the one thing that has to navigate
 * from outside every screen: opening what a tapped push notification is about
 * (phase5-contract.md section 6.3, `usePushNotifications`). AppRoot hands it to
 * the `NavigationContainer`; nothing else should need it.
 *
 * ⚠️ Not a way around the role split (PROJECT_BIBLE.md section 3). The root is
 * switched by the session, so the routes this can reach are whichever role's
 * stack is mounted — a customer's tree has no vendor route to navigate to — and
 * the push hook still chooses the route by the signed-in role. A screen keeps
 * using its own `navigation` prop; reaching for this from a screen would be
 * navigation nobody can see in the tree that does it.
 *
 * ⚠️ Untyped on purpose. `RootParamList` describes the switch (`Auth`,
 * `Customer`, `Vendor`), not the stack that is actually mounted under it, so a
 * caller dispatches `CommonActions.navigate` with a route it has checked exists
 * (`getRootState().routeNames`) rather than trusting a type that does not hold.
 *
 * ⚠️ Do not listen through it (`navigationRef.addListener`). AppRoot re-mounts
 * the container on every change of language, and the ref carries a listener
 * over to the next container only if it was added while no container was
 * mounted; added while one was, it goes with that container. Whether it lasted
 * depended on mount order. Hear `ready` / `state` through the container's own
 * `onReady` / `onStateChange`, which AppRoot passes to every container it
 * mounts (28/11/2026, `__tests__/navigation/navigationRefRemount.test.tsx`).
 */

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
