/**
 * Border width
 *
 * Two weights and a hairline, so a control can say "resting" and "active" with
 * the line itself rather than with colour alone.
 *
 * It used to be written inline as `StyleSheet.hairlineWidth * 2` wherever a
 * border was needed, which meant the resting weight was defined in two
 * components and the active weight did not exist at all. A focused field could
 * only change colour, and against a pale resting border that is a small thing
 * to notice out of the corner of an eye while typing.
 *
 * `hairline` is the thinnest line the display can draw, so it is a divider
 * rather than an outline — a control drawn at hairline disappears on a high
 * density screen.
 */

import { StyleSheet } from 'react-native';

export const borderWidth = Object.freeze({
  /** Dividers and separators, never a control's own outline. */
  hairline: StyleSheet.hairlineWidth,
  /** A control at rest. */
  thin: 1,
  /** A control that is focused, invalid, or otherwise asking to be looked at. */
  thick: 1.5,
});

export type BorderWidthToken = keyof typeof borderWidth;
