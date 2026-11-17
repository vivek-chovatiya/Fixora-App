/**
 * Navigation theming
 *
 * Maps design tokens onto React Navigation's theme so that navigator-owned
 * surfaces — screen backgrounds, headers, tab bars, the push transition
 * underlay — use the same palette as the components inside them.
 *
 * Without this, React Navigation paints its own defaults and dark mode shows a
 * white flash between screens.
 */

import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import type { AppTheme } from '@/shared/theme';

export function createNavigationTheme(theme: AppTheme): Theme {
  const base = theme.mode === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...base,
    dark: theme.mode === 'dark',
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
  };
}
