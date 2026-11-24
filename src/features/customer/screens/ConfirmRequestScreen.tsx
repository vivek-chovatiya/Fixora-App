import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';

import type { CustomerStackParamList } from '@/app/navigation/types';
import { PriorityBadge } from '@/features/requests/components';
import { Banner, Card, Divider, ImageGallery, InfoRow, PrimaryButton, SecondaryButton, Screen, Text } from '@/shared/components';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { strings } from '@/shared/i18n/strings';
import { requestApi } from '@/shared/services/api';
import { Analytics } from '@/shared/services/analytics';
import { useTheme } from '@/shared/theme';
import { ApiErrorCode } from '@/shared/types/error';

type Props = NativeStackScreenProps<CustomerStackParamList, 'ConfirmRequest'>;

export function ConfirmRequestScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { draft, vendor } = route.params;
  const submit = useServiceMutation(requestApi.create);

  const onSubmit = async () => {
    Analytics.track(vendor ? 'vendor_selected' : 'vendor_selection_skipped', { vendorId: vendor?.id });
    const created = await submit.mutate({
      categoryId: draft.category.id,
      subCategoryId: draft.subCategory.id,
      addressId: draft.address.id,
      vendorId: vendor?.id ?? null,
      description: draft.description,
      notes: draft.notes,
      images: draft.images,
      priority: draft.priority,
      preferredDate: draft.preferredDate,
      preferredTime: draft.preferredTime,
    });
    if (created) {
      Analytics.track('request_created', { dispatchMode: created.dispatchMode });
      navigation.reset({
        index: 1,
        routes: [{ name: 'CustomerTabs' }, { name: 'RequestDetail', params: { id: created.id, justCreated: true } }],
      });
    }
  };

  const vendorIneligible = submit.error?.code === ApiErrorCode.VENDOR_NOT_ELIGIBLE;

  return (
    <Screen
      testID="confirm-request-screen"
      footer={<PrimaryButton testID="confirm-submit" label="Submit request" icon="send" onPress={onSubmit} loading={submit.isSubmitting} />}>
      <Text variant="h2">Review your request</Text>

      {vendorIneligible ? (
        <Banner tone="warning" icon="info" title="Vendor unavailable" message={submit.error?.userMessage}>
          <SecondaryButton
            testID="confirm-switch-open"
            size="sm"
            fullWidth={false}
            label={`Use ${strings.dispatch.anyVendor.toLowerCase()}`}
            onPress={() => navigation.setParams({ vendor: null })}
          />
        </Banner>
      ) : submit.error ? (
        <Banner testID="confirm-error" tone="danger" icon="error" message={submit.error.userMessage} />
      ) : null}

      <Card>
        <View style={{ gap: theme.spacing.lg }}>
          <InfoRow icon="categories" label="Service" value={draft.category.name} />
          <InfoRow icon="fallback" label="Sub service" value={draft.subCategory.name} />
          <InfoRow icon="priority" label="Priority" value={<PriorityBadge request={{ priority: draft.priority, priorityLabel: draft.priorityLabel }} />} />
          <InfoRow icon="document" label="Description" value={draft.description} />
          {draft.notes ? <InfoRow icon="edit" label="Notes" value={draft.notes} /> : null}
          <InfoRow icon="location" label="Address" value={`${draft.address.title} — ${draft.address.fullAddress}`} />
          <InfoRow
            icon="calendar"
            label="Preferred date / time"
            value={[draft.preferredDateLabel, draft.preferredTime].filter(Boolean).join(' · ') || 'Flexible'}
          />
          <Divider />
          {/* The vendor row is always present and states the dispatch mode (§19). */}
          <InfoRow
            testID="confirm-vendor-row"
            icon={vendor ? 'verified' : 'team'}
            label="Vendor"
            value={
              <View style={{ gap: theme.spacing.xxs }}>
                <Text variant="bodyStrong">{vendor ? vendor.businessName : strings.dispatch.anyVendor}</Text>
                {!vendor ? (
                  <Text variant="caption" color="textSecondary">
                    {strings.dispatch.anyVendorHint}
                  </Text>
                ) : null}
              </View>
            }
          />
        </View>
      </Card>

      {draft.images.length ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" color="textSecondary">
            Photos ({draft.images.length})
          </Text>
          <ImageGallery images={draft.images} />
        </View>
      ) : null}

      <Banner icon="info" message={strings.payment.offlineNote} />
    </Screen>
  );
}
