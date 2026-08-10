/**
 * ThemeProvider
 *
 * Supplies the active theme to the component tree and owns the light/dark
 * preference.
 *
 * Theme preference is held here rather than in the Redux store: it is presentation
 * state consumed through context by every component, which is exactly what
 * context is for. Promoting it to global state would add indirection without
 * adding capability.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';

import { getTheme, type AppTheme, type ThemeMode } from './theme';

/** `system` follows the device setting; the others pin the theme. */
export type ThemePreference = 'system' | ThemeMode;

interface ThemeContextValue {
  theme: AppTheme;
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({
  children,
  initialPreference = 'system',
}: PropsWithChildren<{ initialPreference?: ThemePreference }>) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>(initialPreference);

  const mode: ThemeMode =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const handleSetPreference = useCallback((next: ThemePreference) => {
    setPreference(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: getTheme(mode),
      mode,
      preference,
      setPreference: handleSetPreference,
    }),
    [mode, preference, handleSetPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }
  return context;
}

/** Primary hook. Every component reads its visual values from here. */
export function useTheme(): AppTheme {
  return useThemeContext().theme;
}

/** For the settings screen, where the user chooses their preference. */
export function useThemePreference() {
  const { mode, preference, setPreference } = useThemeContext();
  return { mode, preference, setPreference };
}
