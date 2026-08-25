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
  /**
   * Which side of the label the icon sits on.
   *
   * Leading is the default and is right for an icon that names the action. A
   * trailing icon is a direction rather than a name — an arrow that says this
   * button moves you on — so it reads after the words, not before them.
   */
  iconPosition?: 'leading' | 'trailing';
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
  /**
   * Filled, not outlined.
   *
   * It used to be a white plate with a border, which on a white card was a
   * rectangle drawn around some words — the outline was doing all the work of
   * saying "this is a control", and doing it faintly. A tonal fill says it
   * without a line, and reads as quieter than the primary button rather than as
   * a different kind of thing.
   *
   * Pressed goes to `borderStrong` rather than a step of the surface scale: in
   * dark mode `border` and `surfaceAlt` are the same value, so a press would
   * have shown nothing at all.
   */
  secondary: {
    background: 'surfaceAlt',
    backgroundPressed: 'borderStrong',
    label: 'textPrimary',
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
  iconPosition = 'leading',
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
        // A capsule, matched to the fields above it. 12dp was already a shape
        // rather than a rectangle with the corners knocked off, but a 12dp
        // button under a capsule field is the mismatch that made a form read as
        // parts — and at a 52dp control height the two radii are far enough
        // apart to see side by side.
        borderRadius: theme.radius.full,
        paddingVertical: theme.spacing.sm,
        // Wider than a rectangle needs, for the same reason the field is: a
        // capsule curves away from its own label.
        paddingHorizontal: theme.spacing.xxl,
        // The shared control height, not the accessibility floor. Both clear
        // the floor; this one also matches the field above it.
        minHeight: theme.controlHeight,
        borderWidth: palette.border ? theme.borderWidth.thin : 0,
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
          {icon && iconPosition === 'leading' ? (
            <Icon name={icon} size="md" color={palette.label} />
          ) : null}

          <Text variant="button" color={palette.label} numberOfLines={1}>
            {label}
          </Text>

          {icon && iconPosition === 'trailing' ? (
            <Icon name={icon} size="md" color={palette.label} />
          ) : null}
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
