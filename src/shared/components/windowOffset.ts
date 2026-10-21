/**
 * windowOffset
 *
 * How far below the top of the window the navigators start, in dp. Zero unless
 * something app-wide sits above them — today, only the offline banner. AppRoot
 * measures that and provides it; `Screen` reads it.
 *
 * It exists for one calculation. React Native's KeyboardAvoidingView works out
 * how much of itself the keyboard covers by adding its own position *within its
 * parent* to its height and comparing that with the keyboard's position *on the
 * window*. That holds only while the parent starts at the top of the window,
 * which every screen did until the banner pushed them down. With the banner up,
 * a form would leave exactly the banner's height of itself under the keyboard —
 * often the field being typed in, or the button below it. Handing the offset to
 * `keyboardVerticalOffset` puts both numbers back on the same footing.
 *
 * ⚠️ The default is zero, and that is what a screen rendered without AppRoot —
 * every screen test — gets. A non-zero default would shift every keyboard in
 * the app by that much.
 */

import { createContext, useContext } from 'react';

export const WindowOffsetContext = createContext<number>(0);

/** The navigators' distance from the top of the window, in dp. */
export function useWindowOffset(): number {
  return useContext(WindowOffsetContext);
}
