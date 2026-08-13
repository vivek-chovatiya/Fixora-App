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
 * Registration is deliberately absent: a new vendor reaches it from VendorLogin,
 * so there is one path to it rather than two.
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

  const goToCustomerLogin = useCallback(() => {
    navigation.navigate('CustomerLogin');
  }, [navigation]);

  const goToVendorLogin = useCallback(() => {
    navigation.navigate('VendorLogin');
  }, [navigation]);

  return (
    <Screen scrollable testID="auth-entry-screen">
      <View style={[styles.body, { gap: theme.spacing.xxxl }]}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="h1" color="primary">
            {COPY.title}
          </Text>
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
 */
function RoleOption({ icon, title, description, hint, onPress, testID }: RoleOptionProps) {
  const theme = useTheme();

  return (
    <Card onPress={onPress} accessibilityLabel={title} accessibilityHint={hint} testID={testID}>
      <View style={[styles.option, { gap: theme.spacing.lg }]}>
        <Icon name={icon} size="xl" color="primary" />

        <View style={[styles.optionText, { gap: theme.spacing.xxs }]}>
          <Text variant="h3">{title}</Text>
          <Text variant="body" color="textSecondary">
            {description}
          </Text>
        </View>

        <Icon name="forward" size="md" color="textTertiary" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
  },
});
