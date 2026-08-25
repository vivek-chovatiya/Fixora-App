/**
 * AuthBackButton
 *
 * The way back off an auth screen.
 *
 * ⚠️ It adds an affordance, not a route. Sign in, vendor sign in and vendor
 * registration were already reachable-from and returnable-to — the Android
 * hardware button and the iOS edge swipe both worked — but neither is visible,
 * and a stack with `headerShown: false` showed nothing in their place. A user
 * who does not know the gesture had no way off those screens that they could
 * see. This draws the exit that was always there; `navigation.goBack` is the
 * same call the gesture makes.
 *
 * It is the control alone, with no bar around it. AuthTopBar owns the row and
 * places this in it, because the bar also has to centre the mark — and a
 * control that laid out its own row could only ever be at one end of one.
 *
 * Not every auth screen gets one. Role selection is the first route and has
 * nothing behind it; the two verification screens already offer their own way
 * back to the number or the details, and a second control beside it would be the
 * unnecessary navigation button PROJECT_BIBLE.md section 13 warns about.
 */

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { Icon } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface AuthBackButtonProps {
  /** Usually `navigation.goBack`. Must be stable. */
  onBack: () => void;
  testID?: string;
}

export function AuthBackButton({ onBack, testID }: AuthBackButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onBack}
      accessibilityRole="button"
      accessibilityLabel={AUTH_COPY.common.back}
      accessibilityHint={AUTH_COPY.common.backHint}
      style={({ pressed }) => [
        styles.target,
        theme.shadows.sm,
        {
          // A square at the touch-target floor. The chevron is 24dp, which is a
          // comfortable glyph and an uncomfortably small thing to hit.
          width: theme.hitSlop.minTarget,
          height: theme.hitSlop.minTarget,
          borderRadius: theme.radius.full,
          /**
           * A raised disc rather than a bare chevron.
           *
           * A chevron alone on a page is a mark; a disc under it is a control.
           * The ring carries it where the shadow cannot — on the dark theme
           * shadows do not read at all, and `surface` on `background` is close
           * enough to disappear without one.
           *
           * Pressing steps the fill rather than fading the ink: a control that
           * gets fainter as it is used is the wrong direction.
           */
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
