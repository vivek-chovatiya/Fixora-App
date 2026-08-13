/**
 * Theme composition
 *
 * Assembles every design token into the object consumed through `useTheme`.
 *
 * Kept separate from index.ts so that ThemeProvider can import the composition
 * while index.ts re-exports the provider — a barrel that did both would create
 * a circular import.
 *
 * Only `colors` and `shadows` vary between light and dark, which is what allows
 * dark mode to be supported without rewriting a single component.
 */

import { animation } from './animation';
import { breakpoints, gridColumns, maxContentWidth } from './breakpoints';
import { darkColors, lightColors, type ColorTokens } from './colors';
import { elevation } from './elevation';
import { iconSize, icons } from './icons';
import { opacity } from './opacity';
import { radius } from './radius';
import { createShadows, type ShadowTokens } from './shadows';
import { hitSlop, screenPadding, spacing } from './spacing';
import { typography } from './typography';
import { zIndex } from './zIndex';

export type ThemeMode = 'light' | 'dark';

export interface AppTheme {
  mode: ThemeMode;
  colors: ColorTokens;
  shadows: ShadowTokens;
  spacing: typeof spacing;
  screenPadding: typeof screenPadding;
  hitSlop: typeof hitSlop;
  radius: typeof radius;
  typography: typeof typography;
  elevation: typeof elevation;
  opacity: typeof opacity;
  animation: typeof animation;
  zIndex: typeof zIndex;
  breakpoints: typeof breakpoints;
  gridColumns: typeof gridColumns;
  maxContentWidth: typeof maxContentWidth;
  icons: typeof icons;
  iconSize: typeof iconSize;
}

function createTheme(mode: ThemeMode): AppTheme {
  const colors = mode === 'dark' ? darkColors : lightColors;

  return Object.freeze({
    mode,
    colors,
    shadows: createShadows(colors.shadow),
    spacing,
    screenPadding,
    hitSlop,
    radius,
    typography,
    elevation,
    opacity,
    animation,
    zIndex,
    breakpoints,
    gridColumns,
    maxContentWidth,
    icons,
    iconSize,
  });
}

export const lightTheme = createTheme('light');
export const darkTheme = createTheme('dark');

export function getTheme(mode: ThemeMode): AppTheme {
  return mode === 'dark' ? darkTheme : lightTheme;
}
