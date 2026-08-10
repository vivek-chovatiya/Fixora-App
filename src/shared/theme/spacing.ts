/**
 * Spacing
 *
 * A single 4pt scale. Every margin, padding and gap in the application must
 * come from here so that rhythm stays consistent across modules.
 */

export const spacing = Object.freeze({
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 48,
});

export type SpacingToken = keyof typeof spacing;

/** Standard horizontal padding for screen-level containers. */
export const screenPadding = spacing.lg;

/** Minimum touch target, per platform accessibility guidance. */
export const hitSlop = Object.freeze({
  minTarget: 44,
});
