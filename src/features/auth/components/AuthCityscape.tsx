/**
 * AuthCityscape
 *
 * The decorative foot of an auth screen: a pale skyline, and the one line of
 * reassurance that sits over it.
 *
 * ⚠️ The sentence is rendered, not drawn. The artwork arrived with it baked
 * into the pixels, which would have made it untranslatable, fixed at one size
 * however large the user sets their type, and invisible to a screen reader. It
 * was painted out of the image and put back as text.
 *
 * The image itself says nothing and can be reached by nobody: it is hidden from
 * assistive technology and passes touches through, so it cannot swallow a tap
 * meant for the form above it.
 *
 * It carries its own colours in the artwork rather than from tokens, which is
 * what artwork is. What makes it survive the dark theme is alpha: the file was
 * cut against its baked background so it composites onto the page instead of
 * painting a pale slab across the bottom of it.
 */

import React, { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { Icon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

/**
 * Relative rather than aliased, and required rather than imported: Metro's
 * resolver is configured for source extensions, so `@/features/...` does not
 * resolve an image.
 */
const CITY = require('../assets/city-signin.png');

/** The strip as drawn — wide and shallow. Height follows from the width. */
const CITY_ASPECT = 430 / 162;

export interface AuthCityscapeProps {
  testID?: string;
}

function AuthCityscapeComponent({ testID }: AuthCityscapeProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrap} testID={testID}>
      <Image
        source={CITY}
        style={[styles.image, { aspectRatio: CITY_ASPECT }]}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID={testID ? `${testID}-art` : undefined}
      />

      {/*
        Over the drawing rather than under it, which is where the artwork leaves
        room for it — the band behind this line is the palest part of the image.
      */}
      <View
        style={[
          styles.note,
          {
            bottom: theme.spacing.xl,
            paddingHorizontal: theme.screenPadding,
            gap: theme.spacing.sm,
          },
        ]}>
        <View
          style={[
            styles.glyph,
            {
              backgroundColor: theme.colors.primarySubtle,
              borderRadius: theme.radius.full,
              width: theme.spacing.xxxl,
              height: theme.spacing.xxxl,
            },
          ]}>
          <Icon name="verified" size="sm" color="primary" />
        </View>

        <Text variant="caption" color="textSecondary">
          {AUTH_COPY.common.safetyNote}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  image: {
    width: '100%',
  },
  note: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const AuthCityscape = memo(AuthCityscapeComponent);
