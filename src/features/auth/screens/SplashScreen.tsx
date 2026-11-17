/**
 * SplashScreen
 *
 * Shown while the app works out where the user belongs — reading the stored
 * session, then whether the introduction has been seen (PROJECT_BIBLE.md
 * section 7.1).
 *
 * It decides nothing itself. RootNavigator holds it up during the session read
 * and the onboarding gate holds it up during its own, so what the user sees is
 * one continuous splash rather than two flickers with a screen between them.
 *
 * ⚠️ No animation, and that is a correction rather than an omission. This screen
 * did fade and settle its mark, which section 7.1 permits nobody to add without
 * reason and which the brief allowed. On a device it was plainly wrong: the
 * whole screen lasts about as long as one storage read, so a 320ms fade starting
 * from nothing meant the brand was invisible for most of it — a splash showing a
 * spinner over an empty page, which is the opposite of what it is for. Section
 * 7.1 says splash should be simple; the device agreed.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { BrandMark } from '@/shared/components/BrandMark';
import { Loader } from '@/shared/components/Loader';
import { Text } from '@/shared/components/Text';
import { useTheme } from '@/shared/theme';

export function SplashScreen() {
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      testID="splash-screen">
      {/*
        The mark and the words are one group; the loader sits apart from them.
        Grouping all three evenly would leave the brand floating in the middle of
        the screen with nothing to belong to.
      */}
      <View style={[styles.brand, { gap: theme.spacing.lg }]}>
        <BrandMark size="xl" testID="splash-brand-mark" />

        <View style={[styles.words, { gap: theme.spacing.xxs }]}>
          <Text variant="display" color="primary" align="center">
            {AUTH_COPY.brand.wordmark}
          </Text>
          <Text variant="body" color="textSecondary" align="center">
            {AUTH_COPY.brand.tagline}
          </Text>
        </View>
      </View>

      {/*
        Held at a fixed distance below the brand rather than at the foot of the
        screen, so it reads as this screen working rather than as a control.
        Not labelled: the app has shown nothing yet, and "Loading" beneath a
        logo tells the user what they can already see.
      */}
      <View style={[styles.status, { paddingTop: theme.spacing.giant }]}>
        <Loader />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
  },
  words: {
    alignItems: 'center',
  },
  status: {
    alignItems: 'center',
  },
});
