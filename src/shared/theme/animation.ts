/**
 * Animation
 *
 * Durations and easing curves. The design philosophy is restrained motion, so
 * durations are short and there is deliberately no "flashy" preset.
 */

import { Easing } from 'react-native';

export const duration = Object.freeze({
  instant: 0,
  fast: 120,
  normal: 200,
  slow: 320,
  /** Bottom sheets and full-screen transitions. */
  sheet: 280,
});

export const easing = Object.freeze({
  standard: Easing.bezier(0.2, 0, 0, 1),
  decelerate: Easing.out(Easing.cubic),
  accelerate: Easing.in(Easing.cubic),
  linear: Easing.linear,
});

export const animation = Object.freeze({
  duration,
  easing,
});

export type DurationToken = keyof typeof duration;
