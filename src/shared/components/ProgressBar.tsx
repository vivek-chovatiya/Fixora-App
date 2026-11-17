/**
 * ProgressBar
 *
 * A track and a fill, the fill as long as a fraction of the track. The one
 * drawing of a bar in the app (Phase 3G-4, 21/10/2026): it replaced three
 * hand-drawn copies — the rating breakdown's rows on Reviews, a shop photo's
 * upload edge on its tile, and the picture upload line (`PhotoUploadProgress`).
 *
 * ⚠️ A drawing, not a control, and silent by default. Every place that uses
 * it already says the value another way — a rating row is one spoken stop
 * ("5 stars, 50 percent, 2 reviews"), a shop tile says "Uploading", the
 * picture line is itself the `progressbar` stop — so a bar that announced
 * itself would be said twice. A caller that does want the bar to be the stop
 * passes the accessibility props, which land on the track as given.
 *
 * ⚠️ The value is clamped to 0–1 and anything that is not a number draws an
 * empty bar, so a backend or uploader that rounds past the ends, or reports
 * nothing usable, can never draw a fill longer than its track. The width is a
 * whole percent, as every figure written beside a bar in the app is.
 *
 * Placement is the caller's (`style`): a row gives it `flex: 1`, a tile pins
 * it along an edge, a line stretches it. Colours and thickness are theme
 * tokens the caller names; there is no indeterminate mode, because nothing
 * uses one — a wait with no figure says so in words.
 */

import React from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityRole,
  type AccessibilityValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme, type ColorTokens, type SpacingToken } from '@/shared/theme';

export interface ProgressBarProps {
  /** How far, 0 to 1. Held to its ends; not a number draws nothing. */
  value: number;
  /** The track, a theme colour. Defaults to `borderStrong`. */
  trackColor?: keyof ColorTokens;
  /** The fill, a theme colour. Defaults to `primary`. */
  fillColor?: keyof ColorTokens;
  /** How thick, a spacing token. Defaults to `xs` (4dp). */
  thickness?: SpacingToken;
  /** Round ends. Off for a bar laid along an edge, which the edge squares off. */
  rounded?: boolean;
  /** Where the bar sits: `flex: 1` in a row, pinned to an edge, stretched in a column. */
  style?: StyleProp<ViewStyle>;
  /** Only when the bar itself is the stop; see the docblock. */
  accessible?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityValue?: AccessibilityValue;
  accessibilityElementsHidden?: boolean;
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
  testID?: string;
  /** On the fill, for a caller that reads its width. */
  fillTestID?: string;
}

/** The fraction as a whole percent of the track: clamped, and 0 for anything not a number. */
export function progressPercent(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}

export function ProgressBar({
  value,
  trackColor = 'borderStrong',
  fillColor = 'primary',
  thickness = 'xs',
  rounded = true,
  style,
  testID,
  fillTestID,
  ...accessibility
}: ProgressBarProps) {
  const theme = useTheme();
  const borderRadius = rounded ? theme.radius.full : 0;

  return (
    <View
      {...accessibility}
      style={[
        styles.track,
        {
          height: theme.spacing[thickness],
          borderRadius,
          backgroundColor: theme.colors[trackColor],
        },
        style,
      ]}
      testID={testID}>
      <View
        style={[
          styles.fill,
          {
            width: `${progressPercent(value)}%`,
            borderRadius,
            backgroundColor: theme.colors[fillColor],
          },
        ]}
        testID={fillTestID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    // A fill rounded at both ends must not show past a track rounded the same way.
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
