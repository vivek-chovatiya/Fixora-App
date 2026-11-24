import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { DefaultTheme, DarkTheme, type Theme as NavTheme } from '@react-navigation/native';

import { fontFor, type AppTheme } from '@/shared/theme';

export function navigationTheme(theme: AppTheme): NavTheme {
  const base = theme.mode === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
    fonts: {
      regular: { fontFamily: fontFor('regular').fontFamily!, fontWeight: '400' },
      medium: { fontFamily: fontFor('medium').fontFamily!, fontWeight: '500' },
      bold: { fontFamily: fontFor('semibold').fontFamily!, fontWeight: '600' },
      heavy: { fontFamily: fontFor('bold').fontFamily!, fontWeight: '700' },
    },
  };
}

const headerTitleStyle = (theme: AppTheme) => ({
  fontSize: theme.typography.fontSize.lg,
  ...fontFor('semibold'),
  color: theme.colors.textPrimary,
});

export function stackOptions(theme: AppTheme): NativeStackNavigationOptions {
  return {
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTintColor: theme.colors.textPrimary,
    headerTitleStyle: headerTitleStyle(theme) as NativeStackNavigationOptions['headerTitleStyle'],
    headerShadowVisible: false,
    headerBackTitle: 'Back',
    contentStyle: { backgroundColor: theme.colors.background },
  };
}

export function tabOptions(theme: AppTheme): BottomTabNavigationOptions {
  return {
    headerStyle: { backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    headerTintColor: theme.colors.textPrimary,
    headerTitleStyle: headerTitleStyle(theme),
    headerTitleAlign: 'left',
    headerShadowVisible: false,
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.textTertiary,
    tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
    // Explicit line height: Inter's taller glyphs were clipped by the tab bar's default label box.
    tabBarLabelStyle: { fontSize: theme.typography.fontSize.xs, lineHeight: theme.typography.lineHeight.xs, ...fontFor('medium') },
  };
}
