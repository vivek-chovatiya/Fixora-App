/**
 * Typography
 *
 * Font families, scales and composed text variants.
 *
 * Components should prefer a `variant` ("h2", "body", "caption") over picking
 * a size and weight themselves — that is what keeps type consistent as the
 * application grows.
 *
 * The app bundles Inter (src/assets/fonts, SIL OFL) so weights render the same on
 * every device. Many Android OEM system fonts (e.g. ColorOS) only ship regular and
 * bold, which silently flattened 500/600 headings to regular.
 *
 * Android cannot pick a weight from a family, so each weight maps to its own
 * font file and `fontWeight` is left unset (otherwise Android fakes a bold).
 * Web and iOS use one family plus `fontWeight`; iOS falls back to the system
 * font until the files are added to the Xcode bundle.
 */

import { Platform, type TextStyle } from 'react-native';

export const fontWeight = Object.freeze({
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const);

type Weight = keyof typeof fontWeight;

const ANDROID_FILE: Record<Weight, string> = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
};

const WEB_STACK = 'Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Style fragment that selects a weight correctly on every platform. */
export function fontFor(weight: Weight): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
  if (Platform.OS === 'android') {
    return { fontFamily: ANDROID_FILE[weight] };
  }
  return { fontFamily: Platform.OS === 'web' ? WEB_STACK : 'Inter', fontWeight: fontWeight[weight] };
}

export const fontFamily = Object.freeze({
  regular: fontFor('regular').fontFamily,
  medium: fontFor('medium').fontFamily,
  semibold: fontFor('semibold').fontFamily,
  bold: fontFor('bold').fontFamily,
});

export const fontSize = Object.freeze({
  xs: 11,
  sm: 13,
  md: 15,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  display: 28,
});

export const lineHeight = Object.freeze({
  xs: 16,
  sm: 18,
  md: 22,
  lg: 24,
  xl: 26,
  xxl: 28,
  xxxl: 32,
  display: 36,
});

export const letterSpacing = Object.freeze({
  tight: -0.4,
  snug: -0.2,
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
  'fontSize' | 'lineHeight' | 'fontWeight' | 'fontFamily' | 'letterSpacing' | 'textTransform'
>;

export const typographyVariants: Readonly<Record<TypographyVariant, VariantStyle>> =
  Object.freeze({
    display: {
      fontSize: fontSize.display,
      lineHeight: lineHeight.display,
      letterSpacing: letterSpacing.tight,
      ...fontFor('bold'),
    },
    h1: {
      fontSize: fontSize.xxxl,
      lineHeight: lineHeight.xxxl,
      letterSpacing: letterSpacing.tight,
      ...fontFor('bold'),
    },
    h2: {
      fontSize: fontSize.xxl,
      lineHeight: lineHeight.xxl,
      letterSpacing: letterSpacing.snug,
      ...fontFor('semibold'),
    },
    h3: {
      fontSize: fontSize.lg,
      lineHeight: lineHeight.lg,
      letterSpacing: letterSpacing.snug,
      ...fontFor('semibold'),
    },
    body: {
      fontSize: fontSize.md,
      lineHeight: lineHeight.md,
      ...fontFor('regular'),
    },
    bodyStrong: {
      fontSize: fontSize.md,
      lineHeight: lineHeight.md,
      ...fontFor('semibold'),
    },
    label: {
      fontSize: fontSize.sm,
      lineHeight: lineHeight.sm,
      ...fontFor('medium'),
    },
    caption: {
      fontSize: fontSize.sm,
      lineHeight: lineHeight.sm,
      ...fontFor('regular'),
    },
    overline: {
      fontSize: fontSize.xs,
      lineHeight: lineHeight.xs,
      letterSpacing: letterSpacing.wide,
      textTransform: 'uppercase',
      ...fontFor('semibold'),
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
