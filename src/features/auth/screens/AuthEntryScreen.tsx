/**
 * AuthEntryScreen
 *
 * The first screen an unauthenticated user sees. It asks which of the two
 * applications they are here for, and routes accordingly.
 *
 * ⚠️ The choice made here is navigation and nothing else. It authenticates
 * nobody, creates no session, touches no service, and is not stored — not in
 * Redux, not on the device, not in a param. A tap is a claim, and a claim from
 * an unauthenticated user is worth exactly nothing.
 *
 * The authenticated role comes from `SessionPayload.user.role` after sign in,
 * which is the backend's answer, and RootNavigator switches on that alone. A
 * customer who taps "Vendor" here reaches the vendor sign-in form and fails to
 * sign in, which is the correct outcome — nothing they chose here follows them
 * past authentication.
 *
 * Registration is still absent as an action. The footer names where it is and
 * links to vendor sign in — the same destination the vendor card offers — so
 * there is one path to registration rather than two.
 *
 * This is the only auth screen without the top bar. It has nothing to go back
 * to, so the bar would hold a mark and nothing else; and the page is long
 * enough to scroll, which the mark should do with it rather than staying
 * pinned over a scrolling page.
 */

import React, { useCallback } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RoleCard } from '@/features/auth/components/RoleCard';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import type { AuthStackParamList } from '@/navigation/types';
import { BrandMark, Icon, Screen, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = AUTH_COPY.authEntry;

/**
 * The decorative skyline at the foot of the page.
 *
 * Relative rather than aliased, and required rather than imported: Metro's
 * resolver is configured for source extensions, so `@/features/...` does not
 * resolve an image. Cut to real alpha rather than shipped as the opaque crop it
 * arrived as, so it composites onto the page instead of painting a pale slab
 * across the bottom of the dark theme.
 */
const SKYLINE = require('../assets/city-skyline.png');

/** The strip as drawn — wide and shallow. Height follows from the width. */
const SKYLINE_ASPECT = 430 / 115;

type Props = NativeStackScreenProps<AuthStackParamList, 'AuthEntry'>;

export function AuthEntryScreen({ navigation }: Props) {
  const theme = useTheme();

  // Stable because RoleCard is memoised: new function identities on every
  // render would defeat that for no reason.
  const goToCustomerLogin = useCallback(() => {
    navigation.navigate('CustomerLogin');
  }, [navigation]);

  const goToVendorLogin = useCallback(() => {
    navigation.navigate('VendorLogin');
  }, [navigation]);

  // Page padding lives on the sections rather than on Screen, because the
  // skyline runs edge to edge and a padded page cannot let it.
  const gutter = { paddingHorizontal: theme.screenPadding };

  return (
    <Screen
      scrollable
      padded={false}
      contentContainerStyle={styles.content}
      testID="auth-entry-screen">
      <View style={[styles.body, { maxWidth: theme.maxContentWidth }]}>
        <View
          style={[
            styles.masthead,
            gutter,
            { paddingTop: theme.spacing.xxl, gap: theme.spacing.sm },
          ]}>
          <BrandMark size="md" testID="auth-entry-mark" />

          {/*
            One heading, two inks. The product name is nested rather than
            concatenated so the whole line is announced as a single header
            instead of as two fragments — and so a translation can put "Fixora"
            wherever its grammar needs it.
          */}
          <Text
            variant="hero"
            align="center"
            accessibilityRole="header"
            style={{ marginTop: theme.spacing.sm }}>
            {COPY.title}{' '}
            <Text variant="hero" color="primary">
              {AUTH_COPY.brand.wordmark}
            </Text>
          </Text>

          <Text variant="subtitle" color="textSecondary" align="center">
            {COPY.tagline}
          </Text>

          <Text variant="body" color="textTertiary" align="center">
            {COPY.subtitle}
          </Text>
        </View>

        {/*
          Tight enough to read as one question with two answers rather than as
          two unrelated things.
        */}
        <View
          style={[
            gutter,
            { gap: theme.spacing.md, marginTop: theme.spacing.xxxl },
          ]}>
          <RoleCard
            tone="customer"
            title={COPY.customerTitle}
            description={COPY.customerDescription}
            badge={COPY.customerBadge}
            hint={COPY.customerHint}
            onPress={goToCustomerLogin}
            testID="auth-entry-customer"
          />

          <RoleCard
            tone="vendor"
            title={COPY.vendorTitle}
            description={COPY.vendorDescription}
            badge={COPY.vendorBadge}
            hint={COPY.vendorHint}
            onPress={goToVendorLogin}
            testID="auth-entry-vendor"
          />
        </View>

        {/*
          Reassurance rather than a control. Not a Card: it is quieter than the
          two things above it and must stay quieter, so it sits on the alternate
          surface with no elevation of its own and nothing to press.
        */}
        <View
          style={[
            styles.trust,
            gutter,
            { marginTop: theme.spacing.xl },
          ]}>
          <View
            style={[
              styles.trustPanel,
              {
                backgroundColor: theme.colors.surfaceAlt,
                borderRadius: theme.radius.xl,
                padding: theme.spacing.lg,
                gap: theme.spacing.md,
              },
            ]}>
            <View
              style={[
                styles.trustGlyph,
                {
                  backgroundColor: theme.colors.primarySubtle,
                  borderRadius: theme.radius.lg,
                  width: theme.spacing.giant,
                  height: theme.spacing.giant,
                },
              ]}>
              <Icon name="verified" size="lg" color="primary" />
            </View>

            <View style={styles.trustText}>
              <Text variant="bodyStrong">{COPY.trustTitle}</Text>
              <Text variant="caption" color="textSecondary">
                {AUTH_COPY.common.safetyNote}
              </Text>
            </View>
          </View>
        </View>

        {/*
          Local services, said without words. It takes the slack at the foot of
          the page rather than being given a height of its own, which is what
          stops it becoming a band the eye has to get past.

          Inert and invisible to assistive technology: there is nothing here to
          read out, and nothing to touch.
        */}
        <View
          style={styles.skyline}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Image
            source={SKYLINE}
            style={[styles.skylineImage, { aspectRatio: SKYLINE_ASPECT }]}
            resizeMode="cover"
            testID="auth-entry-skyline"
          />
        </View>

        {/*
          Padded off the artwork above it. The skyline is bottom-aligned in the
          slack, so without this the ground line of the drawing runs straight
          into the sentence and the text reads as part of the picture.
        */}
        <View
          style={[
            styles.footer,
            gutter,
            { paddingTop: theme.spacing.md, paddingBottom: theme.spacing.lg },
          ]}>
          <Text variant="caption" color="textSecondary" align="center">
            {COPY.registerNote}{' '}
            {/*
              Nested in the sentence rather than placed under it, so the link is
              read in the order it is meant: where registration is, then how to
              get there. It goes to vendor sign in — the same place the card
              above goes — so it adds a route to a screen the user can already
              reach, not a second path to registration.
            */}
            <Text
              variant="caption"
              color="primary"
              accessibilityRole="link"
              accessibilityHint={COPY.registerLinkHint}
              onPress={goToVendorLogin}
              testID="auth-entry-register-link">
              {COPY.registerLink}
            </Text>
            .
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    // Grows past the viewport on a small phone rather than compressing, which
    // is what keeps the cards their own size instead of the screen's.
    flexGrow: 1,
  },
  body: {
    flex: 1,
    // Fills a phone, caps on a tablet.
    width: '100%',
    alignSelf: 'center',
  },
  masthead: {
    alignItems: 'center',
  },
  trust: {
    width: '100%',
  },
  trustPanel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustGlyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustText: {
    flex: 1,
  },
  skyline: {
    // Takes whatever is left between the trust panel and the footer, so the
    // page has no void in it on a tall screen and no fight for space on a
    // short one.
    flex: 1,
    justifyContent: 'flex-end',
  },
  skylineImage: {
    width: '100%',
  },
  footer: {
    width: '100%',
  },
});
