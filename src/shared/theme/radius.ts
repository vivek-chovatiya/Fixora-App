/**
 * Radius
 *
 * Corner radii. The design language favours rounded cards, so `lg` is the
 * default for surfaces and `md` for controls.
 */

export const radius = Object.freeze({
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  /** Pills, avatars and any fully-rounded element. */
  full: 999,
});

export type RadiusToken = keyof typeof radius;
