import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';

import type { CustomerStackParamList } from '@/app/navigation/types';
import { Badge, Card, EmptyState, ErrorState, GhostButton, PrimaryButton, Row, Screen, ScreenLoader, Text, useDialog, useToast } from '@/shared/components';
import { useRefreshOnFocus } from '@/shared/hooks/useRefreshOnFocus';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { strings } from '@/shared/i18n/strings';
import { addressApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import { AppError } from '@/shared/types/error';
import type { Address } from '@/shared/types/models';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Addresses'>;

export function AddressesScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { confirm } = useDialog();
  const query = useServiceQuery(() => addressApi.list(), []);
  useRefreshOnFocus(query.refresh);

  const run = async (task: () => Promise<unknown>, success: string) => {
    try {
      await task();
      toast.show(success);
      query.refresh();
    } catch (caught) {
      toast.show(AppError.from(caught).userMessage, 'danger');
    }
  };

  const onDelete = async (address: Address) => {
    const ok = await confirm({ title: `Delete "${address.title}"?`, message: address.fullAddress, confirmLabel: 'Delete', destructive: true });
    if (ok) await run(() => addressApi.remove(address.id), 'Address deleted.');
  };

  if (query.isLoading) return <ScreenLoader />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.retry} />;

  const addresses = query.data ?? [];
  return (
    <Screen
      testID="addresses-screen"
      refreshing={query.isRefreshing}
      onRefresh={query.refresh}
      footer={<PrimaryButton testID="addresses-add" label="Add address" icon="add" onPress={() => navigation.navigate('AddressForm')} />}>
      {addresses.length === 0 ? <EmptyState icon="location" title="No saved addresses" message={strings.empty.addresses} /> : null}
      {addresses.map(address => (
        <Card key={address.id} testID={`address-${address.title}`}>
          <View style={{ gap: theme.spacing.sm }}>
            <Row justify="space-between">
              <Text variant="bodyStrong">{address.title}</Text>
              {address.isDefault ? <Badge label="Default" tone="primary" /> : null}
            </Row>
            <Text variant="caption" color="textSecondary">
              {address.fullAddress}
            </Text>
            <Row gap="xs" style={{ flexWrap: 'wrap' }}>
              {!address.isDefault ? (
                <GhostButton size="sm" fullWidth={false} label="Set default" onPress={() => run(() => addressApi.setDefault(address.id), 'Default address updated.')} />
              ) : null}
              <GhostButton size="sm" fullWidth={false} label="Edit" onPress={() => navigation.navigate('AddressForm', { address })} />
              <GhostButton testID={`address-delete-${address.title}`} size="sm" fullWidth={false} label="Delete" onPress={() => onDelete(address)} />
            </Row>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
