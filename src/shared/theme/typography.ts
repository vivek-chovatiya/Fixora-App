/**
 * Typography
 *
 * Font families, scales and composed text variants.
 *
 * Components should prefer a `variant` ("h2", "body", "caption") over picking
 * a size and weight themselves — that is what keeps type consistent as the
 * application grows.
 */

import { Platform, type TextStyle } from 'react-native';

export const fontFamily = Object.freeze({
  regular: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  medium: Platform.select({ ios: 'System', android: 'Roboto-Medium', default: 'System' }),
});

export const fontSize = Object.freeze({
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  display: 30,
});

export const fontWeight = Object.freeze({
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const);

export const lineHeight = Object.freeze({
  xs: 16,
  sm: 18,
  md: 20,
  lg: 24,
  xl: 26,
  xxl: 28,
  xxxl: 32,
  display: 38,
});

export const letterSpacing = Object.freeze({
  tight: -0.4,
  normal: 0,
  wide: 0.4,
});

export type TypographyVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'overline';

type VariantStyle = Pick<
  TextStyle,
  'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing' | 'textTransform'
>;

export const typographyVariants: Readonly<Record<TypographyVariant, VariantStyle>> =
  Object.freeze({
    display: {
      fontSize: fontSize.display,
      lineHeight: lineHeight.display,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.tight,
    },
    h1: {
      fontSize: fontSize.xxxl,
      lineHeight: lineHeight.xxxl,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.tight,
    },
    h2: {
      fontSize: fontSize.xxl,
      lineHeight: lineHeight.xxl,
      fontWeight: fontWeight.semibold,
    },
    h3: {
      fontSize: fontSize.xl,
      lineHeight: lineHeight.xl,
      fontWeight: fontWeight.semibold,
    },
    body: {
      fontSize: fontSize.md,
      lineHeight: lineHeight.md,
      fontWeight: fontWeight.regular,
    },
    bodyStrong: {
      fontSize: fontSize.md,
      lineHeight: lineHeight.md,
      fontWeight: fontWeight.medium,
    },
    label: {
      fontSize: fontSize.sm,
      lineHeight: lineHeight.sm,
      fontWeight: fontWeight.medium,
    },
    caption: {
      fontSize: fontSize.sm,
      lineHeight: lineHeight.sm,
      fontWeight: fontWeight.regular,
    },
    overline: {
      fontSize: fontSize.xs,
      lineHeight: lineHeight.xs,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.wide,
      textTransform: 'uppercase',
    },
  });

export const typography = Object.freeze({
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  variants: typographyVariants,
});
