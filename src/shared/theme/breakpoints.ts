/**
 * Breakpoints
 *
 * Width thresholds for responsive layout. Phones are the primary target;
 * `md` and above exist so tablet support does not require a rewrite.
 */

export const breakpoints = Object.freeze({
  /** Small phones (SE class). */
  xs: 0,
  /** Standard phones. */
  sm: 360,
  /** Large phones and small tablets in portrait. */
  md: 600,
  /** Tablets. */
  lg: 840,
  /** Large tablets and landscape tablets. */
  xl: 1080,
});

export type Breakpoint = keyof typeof breakpoints;

const ORDERED: Breakpoint[] = ['xl', 'lg', 'md', 'sm', 'xs'];

/**
 * Resolves a width to its breakpoint. Kept as a pure function so it can be used
 * by the responsive hook, by tests, and by layout helpers alike.
 */
export function resolveBreakpoint(width: number): Breakpoint {
  return ORDERED.find(key => width >= breakpoints[key]) ?? 'xs';
}

/**
 * Widest a single column of content should grow.
 *
 * Centred screens — sign in, verification, empty states — become hard to read
 * when a form or a paragraph stretches the full width of a tablet. Capping the
 * column keeps line length comfortable without any screen owning a magic number.
 */
export const maxContentWidth = 480;

/** Number of grid columns per breakpoint, used by category and vendor grids. */
export const gridColumns: Readonly<Record<Breakpoint, number>> = Object.freeze({
  xs: 2,
  sm: 2,
  md: 3,
  lg: 4,
  xl: 5,
});
