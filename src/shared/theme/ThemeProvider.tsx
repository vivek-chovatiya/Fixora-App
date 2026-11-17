/**
 * ThemeProvider
 *
 * Supplies the active theme to the component tree.
 *
 * The theme follows the device's appearance setting and nothing else. There is
 * no preference to hold, persist, override or toggle — the product decision is
 * that the operating system decides, and this file is where that decision is
 * enforced rather than merely defaulted to.
 *
 * `useColorScheme` is read here and nowhere else in the application, so no
 * screen can reach around this and form its own opinion about light and dark.
 * Components ask for values, never for the mode.
 *
 * The switch is live: `useColorScheme` re-renders on an appearance change, and
 * the Android activity lists `uiMode` in `configChanges`, so changing the system
 * theme repaints the running app instead of recreating it. A half-filled form
 * survives the switch.
 */

import React, { createContext, useContext, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { getTheme, type AppTheme, type ThemeMode } from './theme';

const ThemeContext = createContext<AppTheme | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  // Anything that is not explicitly dark is light, including `null` — which is
  // what the platform reports when it has no preference to give.
  const mode: ThemeMode = useColorScheme() === 'dark' ? 'dark' : 'light';

  // `getTheme` returns one of two frozen module-level objects, so the value's
  // identity is already stable per mode and memoising it here would buy nothing.
  return <ThemeContext.Provider value={getTheme(mode)}>{children}</ThemeContext.Provider>;
}

/** Primary hook. Every component reads its visual values from here. */
export function useTheme(): AppTheme {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }

  return theme;
}
