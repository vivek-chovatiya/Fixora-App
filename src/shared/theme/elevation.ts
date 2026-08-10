/**
 * Elevation
 *
 * Android's numeric elevation scale, kept separate from shadows.ts because the
 * two platforms express depth differently. Consumers should use the composed
 * values in shadows.ts rather than reaching for these directly.
 */

export const elevation = Object.freeze({
  none: 0,
  xs: 1,
  sm: 2,
  md: 4,
  lg: 8,
  xl: 16,
});

export type ElevationToken = keyof typeof elevation;
