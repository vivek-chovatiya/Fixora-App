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
  hero: 34,
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
  hero: 42,
});

export const letterSpacing = Object.freeze({
  tight: -0.4,
  normal: 0,
  wide: 0.4,
});

export type TypographyVariant =
  | 'hero'
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyStrong'
  | 'button'
  | 'subtitle'
  | 'label'
  | 'caption'
  | 'overline';

type VariantStyle = Pick<
  TextStyle,
  'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing' | 'textTransform'
>;

export const typographyVariants: Readonly<Record<TypographyVariant, VariantStyle>> =
  Object.freeze({
    /**
     * The largest thing on a page, and the only thing at this size.
     *
     * Added when the filled brand band came off the auth screens. That band was
     * carrying the shape of those screens; without it the heading has to, and
     * `display` could not, because `display` is the size the wordmark is set at
     * on the splash. A page heading and a brand wordmark reading as the same
     * thing is what made the redesigned screens look like the old ones with the
     * colour removed.
     */
    hero: {
      fontSize: fontSize.hero,
      lineHeight: lineHeight.hero,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.tight,
    },
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
    /**
     * The words inside a button, and nothing else.
     *
     * Buttons used `label`, which is 12px — sized for the caption above a form
     * field, not for the primary action of a screen. A button is the largest
     * target on most screens and was carrying the smallest type on them.
     *
     * Semibold rather than medium: a filled button has no border to define it,
     * so the weight of the word is part of what gives it presence.
     */
    button: {
      fontSize: fontSize.lg,
      lineHeight: lineHeight.lg,
      fontWeight: fontWeight.semibold,
    },
    /**
     * The supporting line under a heading.
     *
     * The scale had no regular weight at 16px at all, so supporting copy could
     * only be `body` at 14 — which under a 34px heading reads as small print
     * rather than as the sentence explaining it.
     */
    subtitle: {
      fontSize: fontSize.lg,
      lineHeight: lineHeight.lg,
      fontWeight: fontWeight.regular,
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
