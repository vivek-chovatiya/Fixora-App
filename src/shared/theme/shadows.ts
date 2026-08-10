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

export type ShadowToken = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export type ShadowTokens = Readonly<Record<ShadowToken, ViewStyle>>;

/**
 * The design language calls for soft shadows, so opacity stays low and radius
 * stays generous relative to the offset.
 */
export function createShadows(shadowColor: string): ShadowTokens {
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
  });
}
