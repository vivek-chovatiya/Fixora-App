import React, { memo, type PropsWithChildren } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme';

export interface CardProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Accent border, e.g. for emergency, directed or selected items. */
  accent?: 'danger' | 'primary' | 'warning' | null;
  /** `compact` tightens padding for dense lists. */
  padding?: 'compact' | 'regular';
  testID?: string;
  accessibilityLabel?: string;
}

/** Flat, bordered surface. No drop shadow: borders read cleaner and render identically on every platform. */
function CardComponent({ children, onPress, style, accent, padding = 'regular', testID, accessibilityLabel }: PropsWithChildren<CardProps>) {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: padding === 'compact' ? theme.spacing.md : theme.spacing.lg,
    borderWidth: accent ? 1.5 : 1,
    borderColor: accent ? theme.colors[accent] : theme.colors.border,
  };

  if (!onPress) {
    return (
      <View style={[base, style]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed ? { backgroundColor: theme.colors.surfaceAlt } : null, style]}>
      {children}
    </Pressable>
  );
}

export const Card = memo(CardComponent);
