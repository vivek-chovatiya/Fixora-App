/**
 * zIndex
 *
 * Stacking order. Centralised so that overlapping surfaces never fight each
 * other with ad-hoc values scattered across modules.
 *
 * Values are spaced by 10 to leave room for future layers without renumbering.
 */

export const zIndex = Object.freeze({
  base: 0,
  raised: 10,
  sticky: 20,
  header: 30,
  drawer: 40,
  overlay: 50,
  modal: 60,
  bottomSheet: 70,
  popover: 80,
  toast: 90,
  /** Reserved for development-only diagnostics. */
  debug: 100,
});

export type ZIndexToken = keyof typeof zIndex;
