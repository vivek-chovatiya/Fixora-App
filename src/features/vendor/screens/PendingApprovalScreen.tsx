import React, { useState } from 'react';
import { View } from 'react-native';

import { AppConfig } from '@/core/config/AppConfig';
import { useAuth } from '@/features/auth/AuthProvider';
import { useConfirmedSignOut } from '@/features/auth/useConfirmedSignOut';
import { Banner, GhostButton, Icon, PrimaryButton, Screen, Text, useToast } from '@/shared/components';
import { strings } from '@/shared/i18n/strings';
import { useTheme } from '@/shared/theme';
import { AppError } from '@/shared/types/error';
import type { VendorProfile } from '@/shared/types/models';

/** Shown instead of the vendor app until an admin approves the account (§29). */
export function PendingApprovalScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { user, refreshUser } = useAuth();
  const signOut = useConfirmedSignOut();
  const vendor = user as VendorProfile | null;
  const [checking, setChecking] = useState(false);
  const rejected = vendor?.approvalStatus === 'REJECTED';

  const onCheck = async () => {
    setChecking(true);
    try {
      await refreshUser();
      toast.show('Status refreshed.', 'info');
    } catch (caught) {
      toast.show(AppError.from(caught).userMessage, 'danger');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      testID="pending-approval-screen"
      contentStyle={{ flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 440, alignSelf: 'center' }}>
      <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: rejected ? theme.colors.dangerSubtle : theme.colors.warningSubtle,
          }}>
          <Icon name={rejected ? 'error' : 'pending'} size="xl" color={rejected ? 'danger' : 'warning'} />
        </View>
        <Text variant="h2" align="center" testID="approval-status-title">
          {rejected ? strings.vendorApproval.rejected : strings.vendorApproval.pending}
        </Text>
        <Text variant="body" color="textSecondary" align="center">
          {rejected
            ? 'You will not receive service requests. Please contact support if you believe this is a mistake.'
            : `Thanks for registering ${vendor?.businessName ?? 'your business'}. Our team is reviewing your details. You'll start receiving requests once approved.`}
        </Text>
      </View>
      {rejected && vendor?.approvalNote ? <Banner tone="danger" icon="info" title="Reason" message={vendor.approvalNote} /> : null}
      <Banner icon="call" tone="neutral" title="Need help?" message={`${AppConfig.support.phone} · ${AppConfig.support.email}`} />
      {!rejected ? <PrimaryButton testID="approval-refresh" label="Check status" icon="retry" onPress={onCheck} loading={checking} /> : null}
      <GhostButton testID="approval-logout" label="Log out" onPress={signOut} />
    </Screen>
  );
}
