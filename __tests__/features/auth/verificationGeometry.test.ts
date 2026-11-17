/**
 * The verification animation's positions are arithmetic, so they are checked as
 * arithmetic. Rendering an orbit and asserting on transforms would test
 * Reanimated; this tests the part that is ours to get wrong.
 *
 * The property that matters most here is that nothing is tied to a device size.
 * Several of these cases pass the same content at very different widths and
 * assert the layout adapts rather than clips.
 */

import {
  ORBIT_SWEEP,
  nodeSize,
  orbitAngle,
  orbitRadius,
  rowOffset,
  sceneSide,
} from '@/features/auth/components/verification/verificationGeometry';

const OTP_LENGTH = 6;
const TOUCH_TARGET = 44;

describe('rowOffset', () => {
  it('centres the row on the origin', () => {
    const offsets = Array.from({ length: OTP_LENGTH }, (_, index) =>
      rowOffset(index, OTP_LENGTH, 50),
    );

    // The row is balanced about the hub, so the offsets sum to zero however
    // many cells there are.
    const total = offsets.reduce((sum, offset) => sum + offset, 0);
    expect(total).toBeCloseTo(0);
  });

  it('straddles the origin for an even count and sits on it for an odd one', () => {
    expect(rowOffset(1, 3, 50)).toBe(0);
    expect(rowOffset(0, 2, 50)).toBe(-25);
    expect(rowOffset(1, 2, 50)).toBe(25);
  });

  it('spaces cells one step apart', () => {
    expect(rowOffset(1, OTP_LENGTH, 50) - rowOffset(0, OTP_LENGTH, 50)).toBe(50);
  });

  it('survives being asked before there is anything to lay out', () => {
    expect(rowOffset(0, 0, 50)).toBe(0);
  });
});

describe('orbitAngle', () => {
  it('starts at the top of the ring', () => {
    expect(orbitAngle(0, OTP_LENGTH)).toBeCloseTo(-Math.PI / 2);
  });

  it('spreads the code evenly around the ring', () => {
    const step = orbitAngle(1, OTP_LENGTH) - orbitAngle(0, OTP_LENGTH);

    expect(step).toBeCloseTo((Math.PI * 2) / OTP_LENGTH);

    // Every neighbouring pair is the same distance apart, so no character
    // bunches up against the next.
    for (let index = 1; index < OTP_LENGTH; index += 1) {
      expect(orbitAngle(index, OTP_LENGTH) - orbitAngle(index - 1, OTP_LENGTH)).toBeCloseTo(step);
    }
  });

  it('does not wrap past a full turn', () => {
    const last = orbitAngle(OTP_LENGTH - 1, OTP_LENGTH);

    expect(last - orbitAngle(0, OTP_LENGTH)).toBeLessThan(Math.PI * 2);
  });
});

describe('nodeSize', () => {
  it('never grows past the preferred size, however wide the screen', () => {
    expect(nodeSize(1080, OTP_LENGTH, TOUCH_TARGET)).toBe(TOUCH_TARGET);
    expect(nodeSize(2400, OTP_LENGTH, TOUCH_TARGET)).toBe(TOUCH_TARGET);
  });

  it('shrinks so a long code still fits the width it was given', () => {
    const narrow = 320;
    const long = 12;
    const node = nodeSize(narrow, long, TOUCH_TARGET);

    expect(node).toBeLessThan(TOUCH_TARGET);
    // The row fits with room to spare rather than touching both edges.
    expect(node * long).toBeLessThan(narrow);
  });

  it('falls back to the preferred size before the container has been measured', () => {
    expect(nodeSize(0, OTP_LENGTH, TOUCH_TARGET)).toBe(TOUCH_TARGET);
  });
});

describe('orbitRadius', () => {
  it('grows with the number of characters, so the ring never crowds', () => {
    const six = orbitRadius(6, TOUCH_TARGET);
    const twelve = orbitRadius(12, TOUCH_TARGET);

    expect(twelve).toBeGreaterThan(six);
  });

  it('seats every node on the ring without neighbours touching', () => {
    const radius = orbitRadius(OTP_LENGTH, TOUCH_TARGET);

    // Straight-line distance between two adjacent nodes on the circle.
    const step = (Math.PI * 2) / OTP_LENGTH;
    const gap = 2 * radius * Math.sin(step / 2);

    expect(gap).toBeGreaterThan(TOUCH_TARGET);
  });
});

describe('sceneSide', () => {
  it('reserves enough room that the ring is not clipped', () => {
    const side = sceneSide(OTP_LENGTH, TOUCH_TARGET);
    const radius = orbitRadius(OTP_LENGTH, TOUCH_TARGET);

    // A node at the edge of the ring reaches radius + half a node from centre.
    expect(side / 2).toBeGreaterThanOrEqual(radius + TOUCH_TARGET / 2);
  });

  it('is derived from the content, not from a screen size', () => {
    // Same code, same node: the scene is the same size whatever device it is
    // on. Nothing here has a 360x640 or a 1080x2400 special case.
    expect(sceneSide(OTP_LENGTH, TOUCH_TARGET)).toBe(sceneSide(OTP_LENGTH, TOUCH_TARGET));
    expect(sceneSide(OTP_LENGTH, 20)).toBeLessThan(sceneSide(OTP_LENGTH, TOUCH_TARGET));
  });
});

describe('ORBIT_SWEEP', () => {
  it('turns more than a full circle, so the motion is visibly a journey', () => {
    expect(ORBIT_SWEEP).toBeGreaterThan(Math.PI * 2);
  });

  it('stops short of becoming a spinner', () => {
    expect(ORBIT_SWEEP).toBeLessThanOrEqual(Math.PI * 4);
  });
});
