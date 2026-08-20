/**
 * Animation
 *
 * Durations and easing curves. The design philosophy is restrained motion, so
 * durations are short and there is deliberately no "flashy" preset.
 */

/**
 * Easing comes from Reanimated rather than from React Native.
 *
 * The two expose the same curves, but Reanimated's are worklets, and
 * `withTiming` rejects an easing function that is not one — at runtime, on the
 * device, with a blank screen rather than a build error. Since Reanimated is the
 * animation stack for this application, taking the curves from it means a token
 * from this file can be handed to either API and work.
 */
import { Easing } from 'react-native-reanimated';

export const duration = Object.freeze({
  instant: 0,
  fast: 120,
  normal: 200,
  slow: 320,
  /** Bottom sheets and full-screen transitions. */
  sheet: 280,
  /**
   * The verification orbit, and the only duration here measured in seconds
   * rather than fractions of one.
   *
   * It is the exception to the rule above, not a softening of it. Every other
   * value describes a transition the user waits through, where short is kind.
   * This one covers a wait they cannot skip — a credential being checked — and
   * its job is to make that wait legible rather than to get out of the way. Too
   * short and the ring flicks round before the eye has followed it, which reads
   * as a glitch rather than as work being done.
   *
   * It stays a single token so the pacing cannot drift apart between the three
   * flows that verify something.
   */
  verify: 1400,
  /**
   * How long a verified state stays on screen before the flow moves on.
   *
   * The settle animation (`slow`) plus a beat to read it (`fast`). Written out
   * rather than composed because two very different places have to agree on it:
   * the form that shows the verified state, and the auth layer that holds a
   * session publish back so the screen showing it survives long enough to be
   * seen. Composed in one and hard-coded in the other, they would drift.
   */
  verifiedHold: 440,
  /**
   * How long a toast rests on screen before it withdraws itself.
   *
   * A dwell rather than a transition, which is why it dwarfs everything above
   * it. It is here anyway because section 11 admits no loose timing value, and
   * because a toast that outlives its neighbour by a second reads as a bug.
   *
   * Long enough to read a sentence twice, since a failure message is usually
   * read once in surprise and once in earnest.
   */
  toast: 4000,
});

export const easing = Object.freeze({
  standard: Easing.bezier(0.2, 0, 0, 1),
  decelerate: Easing.out(Easing.cubic),
  accelerate: Easing.in(Easing.cubic),
  linear: Easing.linear,
  /**
   * Builds speed, holds it, then settles — the shape of something spinning up
   * and coming to rest. `standard` decelerates from the first frame, which makes
   * a long rotation look like it is already ending.
   */
  orbit: Easing.bezier(0.45, 0, 0.2, 1),
});

export const animation = Object.freeze({
  duration,
  easing,
});

export type DurationToken = keyof typeof duration;
