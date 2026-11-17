/**
 * PhotoUploadProgress
 *
 * How far a picture's upload has got, said under the picture it is for — from
 * `useImageUpload`'s `isBusy` and `progress`. Two features draw it: the
 * vendor's `PhotoField` (the business picture and a team member's photo) and
 * the customer's own picture on Profile.
 *
 * ⚠️ Taken out of `PhotoField` (Phase 3D-12, 21/10/2026) when the customer's
 * picture was given the same progress (Phase 3G-4 built it there). The two
 * cards stay apart — `PhotoField`'s docblock says why — but this part is the
 * same thing in both, and two copies of it would be two answers to the next
 * change. The words are the caller's, from each feature's frozen copy.
 *
 * ⚠️ The progress is said once, and then left to be looked at. While the
 * upload has not reported how far it has got (`progress` null — picking and
 * compressing come first), the line is the caller's waiting words in a polite
 * live region; they do not change while they stand, so they are announced
 * once. From the first report the line is replaced by a bar and "Uploading…
 * 42%", one `progressbar` stop whose value is the figure — and which is **not**
 * a live region, so the figure changing never speaks. A live region round the
 * figure would read out every step of every upload.
 *
 * Nothing at all while nothing is running. The bar is the shared
 * `ProgressBar`, silent inside this one stop.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ProgressBar, progressPercent } from '@/shared/components/ProgressBar';
import { Text } from '@/shared/components/Text';
import { useTheme } from '@/shared/theme';

export interface PhotoUploadProgressProps {
  /** A picture action is running (`useImageUpload`'s `isBusy`). */
  isBusy: boolean;
  /** The upload's own report, 0 to 1, or null until it has said anything. */
  progress: number | null;
  /** Shown, and spoken once, until the first report; then the bar's spoken name. */
  waitingLabel: string;
  /** Beside the bar, once there is a figure. */
  progressLabel: (percent: number) => string;
  /** Its parts are this with `-busy`, `-progress` and `-progress-fill` after it. */
  testID: string;
}

export function PhotoUploadProgress({
  isBusy,
  progress,
  waitingLabel,
  progressLabel,
  testID,
}: PhotoUploadProgressProps) {
  const theme = useTheme();

  if (!isBusy) {
    return null;
  }

  // The bar's own whole percent, so words and fill agree; null until the upload has said.
  const percent = progress === null ? null : progressPercent(progress);

  if (percent === null) {
    return (
      <Text
        variant="caption"
        color="textSecondary"
        accessibilityLiveRegion="polite"
        testID={`${testID}-busy`}>
        {waitingLabel}
      </Text>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={waitingLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={[styles.stretch, { gap: theme.spacing.xs }]}
      testID={`${testID}-progress`}>
      <Text
        variant="caption"
        color="textSecondary"
        align="center"
        style={[styles.stretch, styles.figure]}>
        {progressLabel(percent)}
      </Text>
      <ProgressBar
        value={progress ?? 0}
        style={styles.stretch}
        fillTestID={`${testID}-progress-fill`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stretch: {
    alignSelf: 'stretch',
  },
  figure: {
    // Every digit the same width, so the line does not shuffle as the figure
    // climbs. A font feature, not a size or colour: the theme and `Text` have
    // no numeric variant, and `RatingSummaryCard` sets it the same way.
    fontVariant: ['tabular-nums'],
  },
});
