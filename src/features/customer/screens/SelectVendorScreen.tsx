import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { CustomerStackParamList } from '@/app/navigation/types';
import { Avatar, Banner, Card, Icon, Loader, PrimaryButton, RatingStars, Row, Screen, Text } from '@/shared/components';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { strings } from '@/shared/i18n/strings';
import { vendorApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import type { PublicVendor } from '@/shared/types/models';

type Props = NativeStackScreenProps<CustomerStackParamList, 'SelectVendor'>;

/**
 * Optional vendor selection (App PROJECT_BIBLE §18A).
 * The list is rendered exactly as returned — never sorted, filtered or ranked here.
 * Empty and error states still allow continuing with open dispatch.
 */
export function SelectVendorScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { draft } = route.params;
  const vendors = useServiceQuery(
    () => vendorApi.recommended(draft.category.id, draft.subCategory.id, draft.address.id),
    [draft.category.id],
  );
  const [selected, setSelected] = useState<PublicVendor | null>(null);

  const onContinue = () => navigation.navigate('ConfirmRequest', { draft, vendor: selected });

  return (
    <Screen
      testID="select-vendor-screen"
      refreshing={vendors.isRefreshing}
      onRefresh={vendors.refresh}
      footer={
        <PrimaryButton
          testID="select-vendor-continue"
          label={selected ? `Continue with ${selected.businessName}` : `Continue with ${strings.dispatch.anyVendor.toLowerCase()}`}
          onPress={onContinue}
        />
      }>
      <Text variant="body" color="textSecondary">
        Choose a vendor, or let us send your request to all available vendors.
      </Text>

      {/* "Any available vendor" is a first-class choice, not a hidden fallback. */}
      <Card testID="vendor-option-any" accent={selected === null ? 'primary' : null} onPress={() => setSelected(null)} accessibilityLabel={strings.dispatch.anyVendor}>
        <Row gap="md">
          <Icon name={selected === null ? 'success' : 'team'} size="lg" color={selected === null ? 'primary' : 'textTertiary'} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="bodyStrong">{strings.dispatch.anyVendor}</Text>
            <Text variant="caption" color="textSecondary">
              {strings.dispatch.anyVendorHint}
            </Text>
          </View>
        </Row>
      </Card>

      <Text variant="h3">Recommended vendors</Text>
      {vendors.isLoading ? <Loader label="Finding vendors…" /> : null}
      {vendors.error ? (
        <Banner testID="vendors-error" tone="warning" icon="offline" title="Couldn't load vendors" message="You can still continue — we'll find an available vendor for you.">
          <PrimaryButton label="Retry" icon="retry" size="sm" fullWidth={false} onPress={vendors.retry} />
        </Banner>
      ) : null}
      {vendors.data && vendors.data.length === 0 ? <Banner testID="vendors-empty" icon="info" message={strings.empty.vendors} /> : null}

      {(vendors.data ?? []).map(vendor => {
        const isSelected = selected?.id === vendor.id;
        return (
          <Card key={vendor.id} testID={`vendor-option-${vendor.businessName}`} accent={isSelected ? 'primary' : null} onPress={() => setSelected(vendor)} accessibilityLabel={vendor.businessName}>
            <Row gap="md" style={{ alignItems: 'flex-start' }}>
              <Avatar name={vendor.businessName} uri={vendor.profileImage} />
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <Row justify="space-between">
                  <Text variant="bodyStrong" style={{ flex: 1 }}>
                    {vendor.businessName}
                  </Text>
                  {isSelected ? <Icon name="success" size="md" color="primary" /> : null}
                </Row>
                <Row gap="xs">
                  <RatingStars value={vendor.averageRating} size={14} />
                  <Text variant="caption" color="textSecondary">
                    {vendor.totalReviews
                      ? `${vendor.averageRating.toFixed(1)} (${vendor.totalReviews} review${vendor.totalReviews === 1 ? '' : 's'})`
                      : 'New on Fixora'}
                  </Text>
                </Row>
                {vendor.areaLabel ? (
                  <Row gap="xs">
                    <Icon name="location" size="xs" color="textTertiary" />
                    <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
                      {vendor.areaLabel}
                    </Text>
                  </Row>
                ) : null}
                {vendor.workingHours ? (
                  <Row gap="xs">
                    <Icon name="pending" size="xs" color="textTertiary" />
                    <Text variant="caption" color="textSecondary">
                      {vendor.workingHours}
                    </Text>
                  </Row>
                ) : null}
              </View>
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
