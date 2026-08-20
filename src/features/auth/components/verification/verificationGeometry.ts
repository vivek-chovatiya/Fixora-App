/**
 * Verification geometry
 *
 * The maths behind the verification animation, kept out of the component so it
 * can be reasoned about and tested without rendering anything.
 *
 * Every position is derived from the measured container and the number of
 * characters, never from a device size. Nothing here knows what a 360x640 or a
 * 1080x2400 screen is, which is the property that keeps the ring correct on a
 * small phone and on a tablet without either being special-cased.
 *
 * The origin is the centre of the scene, so a node at (0, 0) sits on the hub.
 */

/** A full turn, in radians. Nodes are placed by angle, not by degrees. */
const TURN = Math.PI * 2;

/**
 * Where the ring begins.
 *
 * Twelve o'clock rather than three: the first character should come to rest at
 * the top when the row finishes curling, which is where the eye already is after
 * reading the row left to right.
 */
const START_ANGLE = -Math.PI / 2;

/**
 * How far the ring turns while verifying, in radians.
 *
 * A turn and a quarter. A single turn ends where it started and so reads as
 * nothing having happened; much beyond this and the user is watching a spinner
 * rather than a credential being checked.
 */
export const ORBIT_SWEEP = TURN * 1.25;

/**
 * Clear air between neighbouring nodes on the ring, as a multiple of node size.
 *
 * Below roughly 1.4 the characters touch and the ring reads as a solid band
 * rather than as the code that curled into it.
 */
const NODE_PITCH = 1.6;

/**
 * Side of one node.
 *
 * Capped at `preferred` so a short code does not render as a row of slabs, and
 * shrunk to fit when there are enough characters that the row would otherwise
 * overflow the container. The `+ 1` leaves the row a node's worth of margin
 * rather than letting it touch both edges.
 */
export function nodeSize(width: number, count: number, preferred: number): number {
  if (count <= 0 || width <= 0) {
    return preferred;
  }

  return Math.min(preferred, width / (count + 1));
}

/**
 * Radius that seats `count` nodes on the ring without crowding them.
 *
 * Derived from the circumference the nodes need rather than chosen: the ring
 * grows when there are more characters, which is what lets one component serve
 * a six-digit code and a longer one without a second layout.
 */
export function orbitRadius(count: number, node: number): number {
  if (count <= 1) {
    return node;
  }

  return (count * node * NODE_PITCH) / TURN;
}

/**
 * Side of the square the scene needs, so the ring is never clipped.
 *
 * The caller reserves this height. It is a function of the content rather than a
 * fixed box, which is why nothing here has to change when the code length does.
 */
export function sceneSide(count: number, node: number): number {
  return orbitRadius(count, node) * 2 + node;
}

/**
 * Horizontal offset of a node while the code is still a row.
 *
 * The row is centred on the hub, so an odd count puts its middle character on
 * the origin and an even one straddles it.
 */
export function rowOffset(index: number, count: number, step: number): number {
  if (count <= 0) {
    return 0;
  }

  return (index - (count - 1) / 2) * step;
}

/** Angle of a node on the ring, before the orbit rotation is added. */
export function orbitAngle(index: number, count: number): number {
  if (count <= 0) {
    return START_ANGLE;
  }

  return START_ANGLE + (index * TURN) / count;
}
