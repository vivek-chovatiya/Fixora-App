/**
 * Tab bar geometry
 *
 * The two numbers the bar and its floating button both have to agree on,
 * derived from theme tokens rather than picked.
 *
 * They live here because they are the one thing that would silently break if
 * the two components each worked it out for themselves: the bar reserves the
 * space above itself that the button occupies, and the button is placed into
 * that space. Disagree by a pixel and the button is either clipped on Android or
 * floating over a gap.
 */

import type { AppTheme } from '@/shared/theme';

export interface TabBarGeometry {
  /** Diameter of the active button. */
  diameter: number;
  /** How far the button's top edge sits above the bar's. */
  lift: number;
}

export function tabBarGeometry(theme: AppTheme): TabBarGeometry {
  return {
    /*
      The shared control size, not the touch-target floor.

      `hitSlop.minTarget` is the smallest a control may be before it becomes hard
      to hit — a limit, not a size. This is the most prominent control in either
      application, and sizing it to its own legal minimum is what made the rest
      of the forms feel grudging.
    */
    diameter: theme.controlHeight,

    /*
      Enough of the button clears the bar to read as floating, and enough stays
      inside it to read as attached. At `lg` it looked like a bulge in the bar;
      at `xxl` it had come loose from it.
    */
    lift: theme.spacing.xl,
  };
}
