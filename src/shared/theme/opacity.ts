/**
 * Opacity
 *
 * Named opacity values. Prevents arbitrary alpha numbers appearing in
 * components, which is the usual source of inconsistent disabled and pressed
 * states across a growing codebase.
 */

export const opacity = Object.freeze({
  transparent: 0,
  faint: 0.04,
  subtle: 0.08,
  muted: 0.4,
  /** Applied to any control in its disabled state. */
  disabled: 0.45,
  /** Applied on press for elements without a dedicated pressed color. */
  pressed: 0.7,
  emphasis: 0.87,
  opaque: 1,
});

export type OpacityToken = keyof typeof opacity;
