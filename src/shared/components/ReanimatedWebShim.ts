/**
 * ReanimatedWebShim
 *
 * What the web build gets when anything imports `react-native-reanimated`
 * (aliased in vite.config.ts, next to the `react-native` shim).
 *
 * Why it exists: the theme's easing curves (`src/shared/theme/animation.ts`)
 * come from Reanimated's `Easing`, because the phone app runs them on the UI
 * thread as worklets. Reanimated's own module asks `react-native` for
 * `TurboModuleRegistry`, which the web shim does not have, so the web page
 * stopped at start-up once the phone app's theme was merged in (17/11/2026).
 * The web views only read the curves; they never run a Reanimated animation.
 *
 * ⚠️ Easing only. Anything else imported from Reanimated on the web is
 * undefined here on purpose — it fails where it is used rather than pretending
 * to animate. The phone app never sees this file (Metro does not read the Vite
 * config).
 */

import { Easing } from 'react-native';

export { Easing };
