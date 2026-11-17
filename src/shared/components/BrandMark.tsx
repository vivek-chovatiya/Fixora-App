/**
 * BrandMark
 *
 * The Fixora logo, and the only place it is drawn.
 *
 * It renders a local image rather than composing shapes from the icon registry,
 * which is what it used to do. An icon is interface furniture that inherits the
 * colour around it; a logo is a fixed asset that carries its own. Routing the
 * mark through the icon system invited it to be recoloured per screen, and
 * approximated it with whichever glyph came closest — neither of which a brand
 * mark should tolerate.
 *
 * The artwork is cut from the master in `brand/` at three densities, so React
 * Native can pick the one matching the device — which is what keeps it crisp on
 * a 3x screen without shipping a 3x file to a 1x one. The launcher icon is cut
 * from that same master by `brand/generate.py`, so the icon on the home screen
 * and the mark on the splash cannot drift apart.
 *
 * ⚠️ Every surface showing the logo goes through this component. That is the
 * whole point of it: replacing the artwork means replacing the master and
 * re-running the generator, and no screen's layout moves, because callers only
 * ever reserve a square and ask for a size.
 */

import React, { memo } from 'react';
import { Image } from 'react-native';

import { useTheme } from '@/shared/theme';

/**
 * Required rather than optional, and relative rather than aliased: Metro's
 * module resolver is configured for source extensions, so `@/assets/...` does
 * not resolve an image.
 */
const MARK = require('../../assets/brand/fixora-mark.png');

/** Sized in steps rather than pixels, so callers cannot invent a size. */
export type BrandMarkSize = 'sm' | 'md' | 'lg' | 'xl';

export interface BrandMarkProps {
  size?: BrandMarkSize;
  testID?: string;
}

/**
 * Edge length per step, as a multiple of the touch-target floor.
 *
 * `md` is one target, so the mark is never smaller than something a finger
 * could hit, and the larger steps stay in proportion to it.
 *
 * `sm` is the exception and is deliberately under that floor. It exists for the
 * mark centred in the auth top bar, which is a bar the height of one target — a
 * mark at `md` would fill it edge to edge and stop reading as a bar. The floor
 * does not apply there because nothing about the mark is pressable: it is the
 * only step that is decoration and nothing else.
 */
const SCALE: Readonly<Record<BrandMarkSize, number>> = {
  sm: 0.625,
  md: 1,
  lg: 1.75,
  xl: 2.5,
};

function BrandMarkComponent({ size = 'lg', testID }: BrandMarkProps) {
  const theme = useTheme();

  const side = theme.hitSlop.minTarget * SCALE[size];

  return (
    <Image
      source={MARK}
      // The artwork is square and already carries its own rounded tile, so it
      // is drawn whole rather than cropped to fit.
      resizeMode="contain"
      /**
       * Android fades a decoded image in over 300ms by default. On the splash —
       * which lasts about as long as one storage read — that meant the mark was
       * still translucent when the screen was replaced, so the first thing a
       * user saw of the brand was a washed-out version of it.
       *
       * This is the same failure the removed splash animation caused, arriving
       * from the platform rather than from us. A logo has nothing to reveal:
       * it should be at full strength on the frame it first appears.
       */
      fadeDuration={0}
      // Decorative everywhere it is used. On the splash and the introduction the
      // wordmark is written beside it, so announcing this too would say the name
      // twice; in the auth top bar there is no wordmark, but the screen's own
      // heading already says what the screen is, and "Fixora" read out before
      // every heading in the flow would be noise rather than information.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: side, height: side }}
      testID={testID}
    />
  );
}

export const BrandMark = memo(BrandMarkComponent);
