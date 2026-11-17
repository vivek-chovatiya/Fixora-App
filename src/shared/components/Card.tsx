/**
 * Card
 *
 * The surface every list item and grouped block sits on.
 *
 * Renders a Pressable only when `onPress` is supplied, so a non-interactive card
 * is not announced as a button by a screen reader.
 *
 * Elevation is expressed as a shadow token rather than a raw shadow, which is
 * what keeps cards consistent and lets dark mode adjust shadow colour centrally.
 */

import React, { memo, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme, type ColorTokens, type RadiusToken, type ShadowToken } from '@/shared/theme';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  /** Disables the standard inner padding for media-edge layouts. */
  padded?: boolean;
  background?: keyof ColorTokens;
  radiusToken?: RadiusToken;
  shadow?: ShadowToken;
  /** Draws a hairline border. Useful where shadows read poorly, such as dark mode. */
  bordered?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function CardComponent({
  children,
  onPress,
  padded = true,
  background = 'surface',
  radiusToken = 'lg',
  shadow = 'sm',
  bordered = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: CardProps) {
  const theme = useTheme();

  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: theme.colors[background],
      borderRadius: theme.radius[radiusToken],
      padding: padded ? theme.spacing.lg : undefined,
      borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
      borderColor: bordered ? theme.colors.border : undefined,
    },
    theme.shadows[shadow],
    style,
  ];

  if (!onPress) {
    return (
      <View style={base} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }: PressableStateCallbackType) => [
        base,
        pressed && { opacity: theme.opacity.pressed },
        disabled && { opacity: theme.opacity.disabled },
      ]}>
      {children}
    </Pressable>
  );
}

export const Card = memo(CardComponent);
