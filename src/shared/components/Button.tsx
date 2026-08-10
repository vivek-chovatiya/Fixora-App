/**
 * Button
 *
 * The only pressable action primitive in the application.
 *
 * One implementation with a `variant`, plus the named exports the naming
 * convention calls for (CLAUDE.md section 15). Named wrappers keep call sites
 * predictable without duplicating behaviour — pressed states, disabled styling,
 * the loading lock and accessibility live in exactly one place.
 *
 * While `isLoading` is true the button is disabled. That is not cosmetic: it is
 * what prevents a double submit, which PROJECT_BIBLE.md section 33.1 requires for
 * vendor accept, where two taps could enter a race the backend must arbitrate.
 */

import React, { memo, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme, type ColorTokens, type IconName } from '@/shared/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  isLoading?: boolean;
  disabled?: boolean;
  /** Stretches to the container width. Default is intrinsic width. */
  fullWidth?: boolean;
  icon?: IconName;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

interface VariantColors {
  background: keyof ColorTokens;
  backgroundPressed: keyof ColorTokens;
  label: keyof ColorTokens;
  border?: keyof ColorTokens;
}

const VARIANTS: Readonly<Record<ButtonVariant, VariantColors>> = {
  primary: {
    background: 'primary',
    backgroundPressed: 'primaryPressed',
    label: 'onPrimary',
  },
  secondary: {
    background: 'surface',
    backgroundPressed: 'surfaceAlt',
    label: 'textPrimary',
    border: 'borderStrong',
  },
  danger: {
    background: 'danger',
    backgroundPressed: 'danger',
    label: 'textInverse',
  },
};

function ButtonComponent({
  label,
  onPress,
  variant = 'primary',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  icon,
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const palette = VARIANTS[variant];

  const isInactive = disabled || isLoading;

  const handlePress = useCallback(() => {
    if (isInactive) {
      return;
    }
    onPress();
  }, [isInactive, onPress]);

  const resolveStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
      styles.base,
      {
        backgroundColor:
          theme.colors[pressed && !isInactive ? palette.backgroundPressed : palette.background],
        borderRadius: theme.radius.md,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        // Accessibility floor for touch targets (PROJECT_BIBLE.md section 46).
        minHeight: theme.hitSlop.minTarget,
        borderWidth: palette.border ? StyleSheet.hairlineWidth * 2 : 0,
        borderColor: palette.border ? theme.colors[palette.border] : undefined,
        opacity: isInactive ? theme.opacity.disabled : 1,
      },
      fullWidth && styles.fullWidth,
      style,
    ],
    [theme, palette, isInactive, fullWidth, style],
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={isInactive}
      style={resolveStyle}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: isLoading }}>
      {isLoading ? (
        <ActivityIndicator size="small" color={theme.colors[palette.label]} />
      ) : (
        <View style={[styles.content, { gap: theme.spacing.sm }]}>
          {icon ? <Icon name={icon} size="sm" color={palette.label} /> : null}
          <Text variant="label" color={palette.label}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
});

export const Button = memo(ButtonComponent);

export const PrimaryButton = memo((props: Omit<ButtonProps, 'variant'>) => (
  <Button {...props} variant="primary" />
));

export const SecondaryButton = memo((props: Omit<ButtonProps, 'variant'>) => (
  <Button {...props} variant="secondary" />
));

export const DangerButton = memo((props: Omit<ButtonProps, 'variant'>) => (
  <Button {...props} variant="danger" />
));
