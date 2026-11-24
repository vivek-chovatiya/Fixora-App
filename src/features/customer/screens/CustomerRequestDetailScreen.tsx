import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useLayoutEffect } from 'react';
import { View } from 'react-native';

import type { CustomerStackParamList } from '@/app/navigation/types';
import { PriorityBadge, StatusBadge, Timeline, VendorPanel } from '@/features/requests/components';
import {
  Banner,
  Card,
  DangerButton,
  ErrorState,
  ImageGallery,
  InfoRow,
  PrimaryButton,
  RatingStars,
  Row,
  Screen,
  ScreenLoader,
  SectionHeader,
  Text,
  useDialog,
  useToast,
} from '@/shared/components';
import { useRefreshOnFocus } from '@/shared/hooks/useRefreshOnFocus';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { strings } from '@/shared/i18n/strings';
import { requestApi } from '@/shared/services/api';
import { useTheme } from '@/shared/theme';
import { formatCurrency, formatDateTime, formatPreferredDate } from '@/shared/utils/format';

type Props = NativeStackScreenProps<CustomerStackParamList, 'RequestDetail'>;

export function CustomerRequestDetailScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { id, justCreated } = route.params;
  const toast = useToast();
  const { confirm } = useDialog();
  const query = useServiceQuery(() => requestApi.detail(id), [id]);
  useRefreshOnFocus(query.refresh);
  const cancel = useServiceMutation(requestApi.cancel);

  useLayoutEffect(() => {
    if (query.data) navigation.setOptions({ title: query.data.requestNumber });
  }, [navigation, query.data]);

  if (query.isLoading) return <ScreenLoader />;
  if (query.error || !query.data) return <ErrorState error={query.error!} onRetry={query.retry} />;

  const request = query.data;
  const can = (action: string) => request.allowedActions.includes(action as never);

  const onCancel = async () => {
    const ok = await confirm({
      title: 'Cancel this request?',
      message: request.vendor ? `${request.vendor.businessName} will be notified.` : 'Vendors will no longer see this request.',
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep request',
      destructive: true,
    });
    if (!ok) return;
    const result = await cancel.mutate(request.id, 'Cancelled by customer');
    if (result) {
      toast.show('Request cancelled.', 'info');
      query.refresh();
    } else {
      // Status may have moved on (e.g. work started) — show the latest state.
      query.refresh();
    }
  };

  return (
    <Screen
      testID="customer-request-detail"
      refreshing={query.isRefreshing}
      onRefresh={query.refresh}
      footer={
        can('REVIEW') || can('CANCEL') ? (
          <>
            {can('REVIEW') ? (
              <PrimaryButton
                testID="detail-review"
                label="Rate your experience"
                icon="star"
                onPress={() =>
                  navigation.navigate('Review', { requestId: request.id, vendorName: request.vendor?.businessName ?? 'your vendor', requestNumber: request.requestNumber })
                }
              />
            ) : null}
            {can('CANCEL') ? <DangerButton testID="detail-cancel" label="Cancel request" onPress={onCancel} loading={cancel.isSubmitting} /> : null}
          </>
        ) : null
      }>
      {justCreated ? (
        <Banner testID="request-created-banner" tone="success" icon="success" title="Request submitted" message={`Your reference number is ${request.requestNumber}.`} />
      ) : null}
      {cancel.error ? <Banner tone="warning" icon="info" message={cancel.error.userMessage} /> : null}

      <Card>
        <View style={{ gap: theme.spacing.md }}>
          <Row justify="space-between">
            <Text variant="caption" color="textTertiary" testID="detail-request-number">
              {request.requestNumber}
            </Text>
            <StatusBadge request={request} />
          </Row>
          <Text variant="h2">{request.subCategory?.name}</Text>
          <Row gap="sm">
            <Text variant="caption" color="textSecondary">
              {request.category?.name}
            </Text>
            <PriorityBadge request={request} />
          </Row>
          <Text variant="caption" color="textTertiary">
            Created {formatDateTime(request.createdAt)}
          </Text>
        </View>
      </Card>

      <SectionHeader title="Vendor" />
      <Card>
        <VendorPanel request={request} />
      </Card>

      <SectionHeader title="Details" />
      <Card>
        <View style={{ gap: theme.spacing.lg }}>
          <InfoRow icon="document" label="Description" value={request.description} />
          {request.notes ? <InfoRow icon="edit" label="Notes" value={request.notes} /> : null}
          <InfoRow icon="location" label="Address" value={request.serviceAddress} />
          <InfoRow
            icon="calendar"
            label="Preferred date / time"
            value={[formatPreferredDate(request.preferredDate), request.preferredTime].filter(Boolean).join(' · ') || 'Flexible'}
          />
          {request.images.length ? <InfoRow icon="image" label="Photos" value={<ImageGallery images={request.images} />} /> : null}
          {request.cancelReason ? <InfoRow icon="info" label="Cancellation reason" value={request.cancelReason} /> : null}
        </View>
      </Card>

      {request.finalAmount !== null ? (
        <>
          <SectionHeader title="Payment" />
          <Card>
            <View style={{ gap: theme.spacing.lg }}>
              <InfoRow icon="document" label="Final amount" value={formatCurrency(request.finalAmount)} />
              <InfoRow icon="success" label="Payment" value={`${request.paymentStatusLabel}${request.paymentMethodLabel ? ` · ${request.paymentMethodLabel}` : ''}`} />
              {request.completionNotes ? <InfoRow icon="edit" label="Vendor notes" value={request.completionNotes} /> : null}
              <Text variant="caption" color="textTertiary">
                {strings.payment.offlineNote}
              </Text>
            </View>
          </Card>
        </>
      ) : null}

      {request.review ? (
        <>
          <SectionHeader title="Your review" />
          <Card testID="detail-review-readonly">
            <View style={{ gap: theme.spacing.sm }}>
              <RatingStars value={request.review.rating} size={20} />
              {request.review.comment ? <Text variant="body">{request.review.comment}</Text> : null}
              <ImageGallery images={request.review.images} size={64} />
            </View>
          </Card>
        </>
      ) : null}

      <SectionHeader title="Timeline" />
      <Card>
        <Timeline entries={request.timeline ?? []} />
      </Card>
    </Screen>
  );
}
