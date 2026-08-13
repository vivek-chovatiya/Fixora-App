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
 * Registration is deliberately absent as an action: a new vendor reaches it from
 * VendorLogin, so there is one path to it rather than two. The footer note says
 * where it is without becoming a third thing to tap.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import type { AuthStackParamList } from '@/navigation/types';
import { Card, Icon, Screen, Text } from '@/shared/components';
import { useTheme, type IconName } from '@/shared/theme';

const COPY = AUTH_COPY.authEntry;

type Props = NativeStackScreenProps<AuthStackParamList, 'AuthEntry'>;

export function AuthEntryScreen({ navigation }: Props) {
  const theme = useTheme();

  // Stable because Card is memoised: new function identities on every render
  // would defeat that for no reason.
  const goToCustomerLogin = useCallback(() => {
    navigation.navigate('CustomerLogin');
  }, [navigation]);

  const goToVendorLogin = useCallback(() => {
    navigation.navigate('VendorLogin');
  }, [navigation]);

  return (
    <Screen scrollable testID="auth-entry-screen">
      <View
        style={[
          styles.body,
          {
            // Centres and caps the column, so the screen reads the same on a
            // small phone and a tablet rather than stretching across one.
            maxWidth: theme.maxContentWidth,
          },
        ]}>
        {/*
          The choice is centred in the space above the footer, and the footer
          sits at the bottom. Centring everything together left the note
          stranded mid-screen with a large void beneath it.
        */}
        <View style={[styles.main, { gap: theme.spacing.xxxl }]}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="display" color="primary">
              {AUTH_COPY.brand.wordmark}
            </Text>
            <Text variant="h2">{COPY.title}</Text>
            <Text variant="body" color="textSecondary">
              {COPY.subtitle}
            </Text>
          </View>

          <View style={{ gap: theme.spacing.lg }}>
            <RoleOption
              icon="customer"
              title={COPY.customerTitle}
              description={COPY.customerDescription}
              hint={COPY.customerHint}
              onPress={goToCustomerLogin}
              testID="auth-entry-customer"
            />

            <RoleOption
              icon="business"
              title={COPY.vendorTitle}
              description={COPY.vendorDescription}
              hint={COPY.vendorHint}
              onPress={goToVendorLogin}
              testID="auth-entry-vendor"
            />
          </View>
        </View>

        <Text variant="caption" color="textTertiary" align="center">
          {COPY.registerNote}
        </Text>
      </View>
    </Screen>
  );
}

interface RoleOptionProps {
  icon: IconName;
  title: string;
  description: string;
  hint: string;
  onPress: () => void;
  testID: string;
}

/**
 * Local to this screen on purpose. Two options that differ only in their words
 * do not justify a shared component, and there is no second place in the app
 * that picks a role.
 *
 * Card supplies the surface, radius, shadow, pressed state and button role, so
 * none of that is restated here. Bordered as well as raised because a soft
 * shadow all but disappears against a dark background.
 */
function RoleOption({ icon, title, description, hint, onPress, testID }: RoleOptionProps) {
  const theme = useTheme();

  return (
    <Card
      onPress={onPress}
      bordered
      accessibilityLabel={title}
      accessibilityHint={hint}
      testID={testID}>
      <View style={[styles.option, { gap: theme.spacing.lg }]}>
        <View
          style={[
            styles.iconTile,
            {
              backgroundColor: theme.colors.primarySubtle,
              borderRadius: theme.radius.full,
              // Sized from the touch-target floor so the row alone is already a
              // comfortable target before the card's padding is counted.
              width: theme.hitSlop.minTarget,
              height: theme.hitSlop.minTarget,
            },
          ]}>
          <Icon name={icon} size="lg" color="primary" />
        </View>

        <View style={[styles.optionText, { gap: theme.spacing.xxs }]}>
          <Text variant="h3">{title}</Text>
          <Text variant="body" color="textSecondary">
            {description}
          </Text>
        </View>

        {/* Affordance only — the title and description already carry the meaning. */}
        <Icon name="forward" size="md" color="textTertiary" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    // Fills a phone, caps on a tablet.
    width: '100%',
    alignSelf: 'center',
  },
  main: {
    flex: 1,
    justifyContent: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconTile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
});
