/**
 * BackButton
 *
 * The way back off a pushed screen, drawn rather than assumed.
 *
 * Every stack in this application runs with `headerShown: false`, so the
 * platform draws nothing in its place. The hardware button and the edge swipe
 * still work, but neither is visible — a user who does not know the gesture has
 * no exit they can see. This draws the exit that was always there;
 * `navigation.goBack` is the same call the gesture makes.
 *
 * A raised, ringed disc rather than a bare chevron. A chevron alone on a page is
 * a mark; a disc under it is a control. The ring carries it where the shadow
 * cannot — on the dark theme shadows do not read at all, and `surface` on
 * `background` is close enough to disappear without one. Pressing steps the fill
 * up rather than fading the ink, because a control that gets fainter as it is
 * used is the wrong direction.
 *
 * Its default copy lives here rather than in a feature's copy file, matching
 * Loader and ErrorState: a shared control has to be usable without a caller
 * having to name it, and "Back" is not a sentence any feature owns.
 *
 * ⚠️ The only back control in the app. The authentication flow used to keep
 * its own copy, `AuthBackButton` — the same disc, the same words — and it now
 * draws this one, passing its words from the auth copy file (`AuthTopBar`).
 * A screen that wants different words passes them; a second back control is
 * the drift this replaced.
 */

import React, { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { COMPONENT_COPY } from '@/shared/components/componentCopy';
import { Icon } from '@/shared/components/Icon';
import { useTheme } from '@/shared/theme';

export interface BackButtonProps {
  /** Usually `navigation.goBack`. */
  onPress: () => void;
  /** Spoken name. The glyph alone is not one. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

function BackButtonComponent({
  onPress,
  accessibilityLabel = COMPONENT_COPY.backButton.label,
  accessibilityHint = COMPONENT_COPY.backButton.hint,
  testID,
}: BackButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.target,
        theme.shadows.sm,
        {
          // A square at the touch-target floor. The chevron is 24dp, which is a
          // comfortable glyph and an uncomfortably small thing to hit.
          width: theme.hitSlop.minTarget,
          height: theme.hitSlop.minTarget,
          borderRadius: theme.radius.full,
          backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
          borderWidth: theme.borderWidth.thin,
          borderColor: theme.colors.borderStrong,
        },
      ]}
      testID={testID}>
      <Icon name="back" size="lg" color="textPrimary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const BackButton = memo(BackButtonComponent);
