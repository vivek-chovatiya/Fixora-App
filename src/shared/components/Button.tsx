/**
 * Button
 *
 * The only button primitive. Use the named exports (PrimaryButton,
 * SecondaryButton, DangerButton, GhostButton) so intent is obvious at call sites.
 * A loading button is always disabled, which is what prevents double submits.
 *
 * `danger` is an outlined destructive action (Reject, Remove) that sits calmly
 * next to a primary button; `destructive` is the solid red used only to confirm
 * an irreversible action inside a dialog.
 */

import React, { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme, type ColorTokens, type IconName } from '@/shared/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'destructive' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

interface VariantTokens {
  bg: keyof ColorTokens | 'transparent';
  pressedBg: keyof ColorTokens | 'transparent';
  fg: keyof ColorTokens;
  border?: keyof ColorTokens;
}

const VARIANT: Record<ButtonVariant, VariantTokens> = {
  primary: { bg: 'primary', pressedBg: 'primaryPressed', fg: 'onPrimary' },
  secondary: { bg: 'surface', pressedBg: 'surfaceAlt', fg: 'textPrimary', border: 'borderStrong' },
  danger: { bg: 'surface', pressedBg: 'dangerSubtle', fg: 'danger', border: 'borderStrong' },
  destructive: { bg: 'danger', pressedBg: 'danger', fg: 'textInverse' },
  ghost: { bg: 'transparent', pressedBg: 'surfaceAlt', fg: 'primary' },
};

function ButtonComponent({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme();
  const tokens = VARIANT[variant];
  const isDisabled = disabled || loading;
  const height = size === 'sm' ? 38 : 48;
  const color = (token: VariantTokens['bg']) => (token === 'transparent' ? 'transparent' : theme.colors[token]);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal: size === 'sm' ? theme.spacing.md : theme.spacing.lg,
          borderRadius: theme.radius.md,
          backgroundColor: color(pressed ? tokens.pressedBg : tokens.bg),
          borderColor: tokens.border ? theme.colors[tokens.border] : 'transparent',
          borderWidth: tokens.border ? 1 : 0,
          opacity: isDisabled ? theme.opacity.disabled : variant === 'destructive' && pressed ? theme.opacity.pressed : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={theme.colors[tokens.fg]} />
      ) : (
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          {icon ? <Icon name={icon} size="sm" color={tokens.fg} /> : null}
          <Text variant={size === 'sm' ? 'label' : 'bodyStrong'} color={tokens.fg} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});

export const Button = memo(ButtonComponent);

type NamedButtonProps = Omit<ButtonProps, 'variant'>;
export const PrimaryButton = (props: NamedButtonProps) => <Button {...props} variant="primary" />;
export const SecondaryButton = (props: NamedButtonProps) => <Button {...props} variant="secondary" />;
export const DangerButton = (props: NamedButtonProps) => <Button {...props} variant="danger" />;
export const GhostButton = (props: NamedButtonProps) => <Button {...props} variant="ghost" />;
