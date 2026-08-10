/**
 * useResponsive
 *
 * Resolves the current breakpoint and grid column count from window width.
 *
 * Layouts should branch on the breakpoint token rather than comparing raw pixel
 * widths, so the thresholds stay owned by the theme.
 */

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { gridColumns } from '@/shared/theme/breakpoints';
import { resolveBreakpoint, type Breakpoint } from '@/shared/theme';

export interface ResponsiveInfo {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  /** Recommended column count for grids at this width. */
  columns: number;
  isTablet: boolean;
  isLandscape: boolean;
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const breakpoint = resolveBreakpoint(width);
    return {
      width,
      height,
      breakpoint,
      columns: gridColumns[breakpoint],
      isTablet: breakpoint === 'md' || breakpoint === 'lg' || breakpoint === 'xl',
      isLandscape: width > height,
    };
  }, [width, height]);
}
