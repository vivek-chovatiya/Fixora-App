/**
 * Shadows
 *
 * Cross-platform depth. Combines iOS shadow properties with the Android
 * elevation scale so a component declares depth once and looks correct on both.
 *
 * Shadow color is supplied by the active color scheme, so this module exports a
 * factory rather than a frozen object.
 */

import type { ViewStyle } from 'react-native';

import { elevation } from './elevation';

export type ShadowToken = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'glow';

export type ShadowTokens = Readonly<Record<ShadowToken, ViewStyle>>;

/**
 * The design language calls for soft shadows, so opacity stays low and radius
 * stays generous relative to the offset.
 */
/**
 * @param shadowColor  The scheme's neutral shadow, used by `sm` through `xl`.
 * @param accentColor  The brand accent, used only by `glow`.
 */
export function createShadows(shadowColor: string, accentColor: string): ShadowTokens {
  return Object.freeze({
    none: {
      elevation: elevation.none,
    },
    sm: {
      shadowColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: elevation.xs,
    },
    md: {
      shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: elevation.sm,
    },
    lg: {
      shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: elevation.md,
    },
    xl: {
      shadowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: elevation.lg,
    },
    /**
     * Depth in the brand accent rather than in the neutral.
     *
     * The same geometry as `lg` — this is the existing shadow system wearing a
     * different colour, not a second one. Opacity is higher because a saturated
     * hue at 0.1 disappears; it is still a supporting effect, and deliberately
     * dimmer than the surface it sits under is bright.
     *
     * On Android the tint reaches the shadow only from API 28. Below that the
     * elevation renders in the platform's neutral, which is a quieter version of
     * the same thing rather than a broken one.
     */
    glow: {
      shadowColor: accentColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: elevation.lg,
    },
  });
}
