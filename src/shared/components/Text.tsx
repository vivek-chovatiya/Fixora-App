/**
 * Text
 *
 * The only text primitive in the application.
 *
 * Callers choose a semantic `variant` and a color token rather than a font size
 * and a hex value, which is what keeps typography consistent and dark mode
 * automatic.
 */

import React, { memo } from 'react';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { useTheme, type ColorTokens, type TypographyVariant } from '@/shared/theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  /** Semantic color token. Defaults to primary body text. */
  color?: keyof ColorTokens;
  align?: 'auto' | 'left' | 'right' | 'center';
}

function TextComponent({
  variant = 'body',
  color = 'textPrimary',
  align,
  style,
  children,
  ...rest
}: TextProps) {
  const theme = useTheme();

  return (
    <RNText
      style={StyleSheet.flatten([
        theme.typography.variants[variant],
        { color: theme.colors[color], textAlign: align },
        style,
      ])}
      {...rest}>
      {children}
    </RNText>
  );
}

export const Text = memo(TextComponent);
