/**
 * AuthTopBar
 *
 * The bar every auth screen opens with: the mark in the middle, the way back on
 * the left, and nothing else.
 *
 * ⚠️ This replaced a full-bleed panel of brand colour that carried the mark, the
 * wordmark, the heading and the supporting line. The panel gave the flow a
 * shape, but it gave it the same shape on every screen and took roughly a third
 * of a small phone to do it — so the heading and the field it introduced were
 * both pushed down, and on a 360x640 device with the keyboard open there was
 * about a hundred points of usable screen left. It also had to collapse itself
 * while typing, which is a lot of machinery for a header.
 *
 * The bar keeps the one thing the panel was actually for — continuity, so the
 * six auth screens read as one flow — and hands everything else to the page.
 * The heading moved into the body as AuthHeading, which means it scrolls away
 * with the content instead of being pinned above it: on the registration form,
 * which is the longest in the application, the panel's heading sat there
 * occupying the top of the screen for all eleven fields.
 *
 * It paints nothing. Sitting on the page background is what lets the app-level
 * StatusBar stand — the panel had to override it, because dark status icons on
 * dark blue are invisible, and every screen using it inherited that override.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthBackButton } from '@/features/auth/components/AuthBackButton';
import { BrandMark } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface AuthTopBarProps {
  /** Usually `navigation.goBack`. Omitted where there is nothing behind. */
  onBack?: () => void;
  testID?: string;
}

function AuthTopBarComponent({ onBack, testID }: AuthTopBarProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          // The touch-target floor and no more. The bar's whole argument is that
          // it is thin, and the back control already needs exactly this much.
          height: theme.hitSlop.minTarget,
          paddingHorizontal: theme.spacing.sm,
        },
      ]}
      testID={testID}>
      {/*
        Centred in the full width of the bar, which is why the back control is
        taken out of the flow below rather than sitting beside it. In a row, a
        44dp control on one side and nothing on the other would push the mark
        22dp off centre — and it would move between screens that have a back
        control and screens that do not.
      */}
      <BrandMark size="sm" testID={testID ? `${testID}-mark` : undefined} />

      {onBack ? (
        <View style={[styles.leading, { left: theme.spacing.sm }]}>
          <AuthBackButton onBack={onBack} testID={testID ? `${testID}-back` : undefined} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leading: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});

export const AuthTopBar = memo(AuthTopBarComponent);
