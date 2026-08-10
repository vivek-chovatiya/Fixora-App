/**
 * Loader
 *
 * Activity indicator with optional label. `fullScreen` centres it in the
 * available space for initial screen loads; the default inline form is for
 * list footers and buttons.
 */

import React, { memo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/shared/components/Text';
import { useTheme, type ColorTokens } from '@/shared/theme';

export interface LoaderProps {
  size?: 'small' | 'large';
  color?: keyof ColorTokens;
  label?: string;
  fullScreen?: boolean;
}

function LoaderComponent({
  size = 'small',
  color = 'primary',
  label,
  fullScreen = false,
}: LoaderProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { gap: theme.spacing.md, padding: theme.spacing.lg },
        fullScreen && styles.fullScreen,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}>
      <ActivityIndicator size={size} color={theme.colors[color]} />
      {label ? (
        <Text variant="caption" color="textSecondary" align="center">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
  },
});

export const Loader = memo(LoaderComponent);
