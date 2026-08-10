/**
 * VendorApprovalScreen
 *
 * The only screen an unapproved vendor can reach (PROJECT_BIBLE.md section 29).
 *
 * This is a gate, not a route: RootNavigator renders it *instead of* the vendor
 * application, so a pending or rejected vendor has no navigable path to request
 * handling at all.
 *
 * Sign out is deliberately present. A rejected vendor who could not sign out
 * would be stuck on this screen with no way to reach any other account.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuthSession, useSignOut } from '@/features/auth/hooks/useAuth';
import { getFullName } from '@/features/auth/types';
import { SecondaryButton } from '@/shared/components/Button';
import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme, type ColorTokens, type IconName } from '@/shared/theme';

interface ApprovalCopy {
  icon: IconName;
  tone: keyof ColorTokens;
  title: string;
  body: string;
}

const COPY: Readonly<Record<'pending' | 'rejected', ApprovalCopy>> = {
  pending: {
    icon: 'pending',
    tone: 'warning',
    title: 'Account under verification',
    body: 'Your account is under verification. You will be able to receive service requests once it is approved.',
  },
  rejected: {
    icon: 'error',
    tone: 'danger',
    title: 'Application not approved',
    body: 'Your vendor application was not approved. Please contact support if you believe this is a mistake.',
  },
};

export function VendorApprovalScreen() {
  const theme = useTheme();
  const { user, vendorApproval: approval } = useAuthSession();
  const { mutate: signOut, isSubmitting } = useSignOut();

  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);

  // `approved` never reaches this screen; treat anything unexpected as pending
  // rather than rendering nothing.
  const copy = approval === 'rejected' ? COPY.rejected : COPY.pending;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          padding: theme.spacing.xl,
          gap: theme.spacing.lg,
        },
      ]}>
      <Icon name={copy.icon} size="xl" color={copy.tone} />

      <View style={[styles.copy, { gap: theme.spacing.sm }]}>
        <Text variant="h2" align="center">
          {copy.title}
        </Text>
        <Text variant="body" color="textSecondary" align="center">
          {copy.body}
        </Text>
      </View>

      {user ? (
        <Text variant="caption" color="textTertiary" align="center">
          Signed in as {getFullName(user)}
        </Text>
      ) : null}

      <SecondaryButton
        label="Sign out"
        icon="logout"
        onPress={handleSignOut}
        isLoading={isSubmitting}
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    alignItems: 'center',
  },
});
