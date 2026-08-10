/**
 * Theme barrel
 *
 * The single import path for design tokens and theming:
 *
 *   import { useTheme, type ColorTone } from '@/shared/theme';
 *
 * Individual token modules may be imported directly when only one is needed.
 */

export { getTheme, lightTheme, darkTheme, type AppTheme, type ThemeMode } from './theme';

export {
  ThemeProvider,
  useTheme,
  useThemePreference,
  type ThemePreference,
} from './ThemeProvider';

export { type ColorTokens, type ColorTone, lightColors, darkColors } from './colors';
export { spacing, screenPadding, hitSlop, type SpacingToken } from './spacing';
export { radius, type RadiusToken } from './radius';
export { elevation, type ElevationToken } from './elevation';
export { createShadows, type ShadowToken, type ShadowTokens } from './shadows';
export { opacity, type OpacityToken } from './opacity';
export { animation, duration, easing, type DurationToken } from './animation';
export { zIndex, type ZIndexToken } from './zIndex';
export {
  breakpoints,
  gridColumns,
  resolveBreakpoint,
  type Breakpoint,
} from './breakpoints';
export {
  icons,
  iconSize,
  ICON_SET,
  resolveRemoteIcon,
  type IconName,
  type IconSizeToken,
} from './icons';
export {
  typography,
  typographyVariants,
  fontSize,
  fontWeight,
  lineHeight,
  type TypographyVariant,
} from './typography';
