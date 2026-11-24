import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View } from 'react-native';

import type { VendorStackParamList } from '@/app/navigation/types';
import { PriorityBadge, StatusBadge, Timeline } from '@/features/requests/components';
import {
  Avatar,
  Badge,
  Banner,
  Card,
  DangerButton,
  ErrorState,
  ImageGallery,
  InfoRow,
  PrimaryButton,
  Row,
  Screen,
  ScreenLoader,
  SecondaryButton,
  SectionHeader,
  Text,
  useDialog,
  useToast,
} from '@/shared/components';
import { useRefreshOnFocus } from '@/shared/hooks/useRefreshOnFocus';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { strings } from '@/shared/i18n/strings';
import { requestApi, teamApi } from '@/shared/services/api';
import { Analytics } from '@/shared/services/analytics';
import { useTheme } from '@/shared/theme';
import { AppError } from '@/shared/types/error';
import type { RequestAction } from '@/shared/types/models';
import { formatCurrency, formatDateTime, formatPreferredDate, formatPhone } from '@/shared/utils/format';

type Props = NativeStackScreenProps<VendorStackParamList, 'VendorRequestDetail'>;
type Busy = RequestAction | null;

const DECLINE_REASONS = ['Fully booked', 'Outside my area', 'Not my expertise', 'Other'];

export function VendorRequestDetailScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { confirm, choose } = useDialog();
  const { id } = route.params;
  const query = useServiceQuery(() => requestApi.detail(id), [id]);
  useRefreshOnFocus(query.refresh);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    Analytics.track('request_viewed', { id });
  }, [id]);

  useLayoutEffect(() => {
    if (query.data) navigation.setOptions({ title: query.data.requestNumber });
  }, [navigation, query.data]);

  if (query.isLoading) return <ScreenLoader />;
  if (query.error || !query.data) {
    // A broadcast lead that another vendor took is no longer visible to us (404).
    if (query.error?.kind === 'notFound') {
      return (
        <Screen>
          <Banner testID="request-unavailable" icon="info" title="Request no longer available" message="It may have been assigned to another vendor or cancelled by the customer." />
          <PrimaryButton label="Back to requests" onPress={() => navigation.goBack()} />
        </Screen>
      );
    }
    return <ErrorState error={query.error!} onRetry={query.retry} />;
  }

  const request = query.data;
  const can = (a: RequestAction) => request.allowedActions.includes(a);

  /** Runs an action. Never updates status optimistically — only the server's response counts. */
  const run = async (action: RequestAction, task: () => Promise<unknown>, success: string) => {
    setBusy(action);
    setError(null);
    try {
      await task();
      toast.show(success);
      query.refresh();
      return true;
    } catch (caught) {
      const appError = AppError.from(caught);
      if (appError.isAssignmentConflict) {
        // Losing the first-accept race is a normal outcome, not a failure (§33.1).
        Analytics.track('request_accept_lost', { id });
        toast.show(strings.dispatch.acceptLost, 'info');
        navigation.goBack();
        return false;
      }
      setError(appError);
      query.refresh();
      return false;
    } finally {
      setBusy(null);
    }
  };

  const onAccept = () =>
    run('ACCEPT', async () => {
      await requestApi.accept(request.id);
      Analytics.track('request_accepted', { id, dispatchMode: request.dispatchMode });
    }, 'Request accepted. It is now assigned to you.');

  const onReject = async () => {
    const reason = await choose('Decline this request?', DECLINE_REASONS.map(r => ({ value: r, label: r })), request.isDirectedToMe ? 'The customer chose you. If you decline, we will send it to other vendors.' : undefined);
    if (!reason) return;
    const ok = await run('REJECT', () => requestApi.reject(request.id, reason), 'Request declined.');
    if (ok) {
      Analytics.track('request_rejected', { id });
      navigation.goBack();
    }
  };

  const onStart = async () => {
    if (!(await confirm({ title: 'Start work now?', message: 'The customer will be notified that work has started.', confirmLabel: 'Start work' }))) return;
    await run('START', async () => {
      await requestApi.start(request.id);
      Analytics.track('work_started', { id });
    }, 'Work started.');
  };

  const onAssign = async () => {
    setBusy('ASSIGN_TEAM');
    try {
      const members = (await teamApi.list()).filter(m => m.status === 'ACTIVE');
      setBusy(null);
      if (!members.length) {
        toast.show('Add an active team member first.', 'warning');
        return;
      }
      const memberId = await choose('Assign team member', members.map(m => ({ value: m.id, label: `${m.name} · ${m.designation}` })));
      if (memberId) await run('ASSIGN_TEAM', () => requestApi.assignTeamMember(request.id, memberId), 'Team member assigned.');
    } catch (caught) {
      setBusy(null);
      setError(AppError.from(caught));
    }
  };

  const hasActions = can('ACCEPT') || can('REJECT') || can('START') || can('COMPLETE') || can('ASSIGN_TEAM');

  return (
    <Screen
      testID="vendor-request-detail"
      refreshing={query.isRefreshing}
      onRefresh={query.refresh}
      footer={
        hasActions ? (
          <>
            {can('ACCEPT') ? <PrimaryButton testID="action-accept" label="Accept request" icon="success" onPress={onAccept} loading={busy === 'ACCEPT'} disabled={busy !== null} /> : null}
            {can('REJECT') ? <DangerButton testID="action-reject" label="Decline" onPress={onReject} loading={busy === 'REJECT'} disabled={busy !== null} /> : null}
            {can('START') ? <PrimaryButton testID="action-start" label="Start work" icon="forward" onPress={onStart} loading={busy === 'START'} disabled={busy !== null} /> : null}
            {can('COMPLETE') ? (
              <PrimaryButton
                testID="action-complete"
                label="Complete work"
                icon="success"
                disabled={busy !== null}
                onPress={() => navigation.navigate('CompleteWork', { id: request.id, requestNumber: request.requestNumber, estimatedAmount: request.estimatedAmount })}
              />
            ) : null}
            {can('ASSIGN_TEAM') ? (
              <SecondaryButton testID="action-assign" label={request.assignedTeamMember ? 'Change team member' : 'Assign team member'} icon="team" onPress={onAssign} loading={busy === 'ASSIGN_TEAM'} disabled={busy !== null} />
            ) : null}
          </>
        ) : null
      }>
      {error ? <Banner testID="vendor-action-error" tone={error.kind === 'network' ? 'warning' : 'danger'} icon="error" message={error.userMessage} /> : null}

      {request.status === 'PENDING_VENDOR' && !request.vendor ? (
        request.isDirectedToMe ? (
          <Banner testID="directed-banner" tone="primary" icon="verified" title="The customer chose you" message="This request was sent only to you." />
        ) : (
          <Banner testID="broadcast-banner" icon="team" title="Open request" message="Other vendors can also see this request. The first to accept gets it." />
        )
      ) : null}

      <Card accent={request.priority === 'EMERGENCY' ? 'danger' : null}>
        <View style={{ gap: theme.spacing.md }}>
          <Row justify="space-between">
            <Text variant="caption" color="textTertiary">
              {request.requestNumber}
            </Text>
            <StatusBadge request={request} />
          </Row>
          <Text variant="h2">{request.subCategory?.name}</Text>
          <Row gap="sm" style={{ flexWrap: 'wrap' }}>
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

      <SectionHeader title="Customer" />
      <Card>
        <Row gap="md">
          <Avatar name={request.customer?.name} uri={request.customer?.profileImage} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="bodyStrong">{request.customer?.name}</Text>
            <Text variant="caption" color="textSecondary" testID="customer-phone">
              {request.customer?.phone ? formatPhone(request.customer.phone) : 'Phone shared after you accept'}
            </Text>
          </View>
        </Row>
      </Card>

      <SectionHeader title="Job details" />
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
          <InfoRow icon="price" label="Estimated price" value={request.estimatedAmount ? formatCurrency(request.estimatedAmount) : '—'} />
          {request.images.length ? <InfoRow icon="image" label="Photos" value={<ImageGallery images={request.images} />} /> : null}
          {request.assignedTeamMember ? (
            <InfoRow icon="team" label="Assigned technician" value={`${request.assignedTeamMember.name} · ${request.assignedTeamMember.designation}`} />
          ) : null}
        </View>
      </Card>

      {request.finalAmount !== null ? (
        <>
          <SectionHeader title="Payment record" />
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <InfoRow icon="document" label="Final amount" value={formatCurrency(request.finalAmount)} />
              <Row gap="sm">
                <Badge label={request.paymentStatusLabel} tone={request.paymentStatus === 'PAID' ? 'success' : 'warning'} />
                {request.paymentMethodLabel ? <Badge label={request.paymentMethodLabel} /> : null}
              </Row>
              {request.completionNotes ? <InfoRow icon="edit" label="Completion notes" value={request.completionNotes} /> : null}
            </View>
          </Card>
        </>
      ) : null}

      {request.review ? (
        <>
          <SectionHeader title="Customer review" />
          <Card>
            <Text variant="bodyStrong">{'★'.repeat(request.review.rating)}{'☆'.repeat(5 - request.review.rating)}</Text>
            {request.review.comment ? <Text variant="body">{request.review.comment}</Text> : null}
          </Card>
        </>
      ) : null}

      {request.timeline?.length ? (
        <>
          <SectionHeader title="Timeline" />
          <Card>
            <Timeline entries={request.timeline} />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
