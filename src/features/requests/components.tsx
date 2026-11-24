import React, { memo } from 'react';
import { View } from 'react-native';

import { Avatar, Badge, Card, Icon, RatingStars, Row, Text } from '@/shared/components';
import { strings } from '@/shared/i18n/strings';
import { useTheme } from '@/shared/theme';
import type { ServiceRequest, TimelineEntry } from '@/shared/types/models';
import { formatDate, formatDateTime, formatPhone } from '@/shared/utils/format';

import { PRIORITY_TONE, STATUS_TONE, vendorLine } from './presentation';

export const StatusBadge = memo(function StatusBadge({ request }: { request: Pick<ServiceRequest, 'status' | 'statusLabel'> }) {
  return <Badge testID={`status-${request.status}`} label={request.statusLabel} tone={STATUS_TONE[request.status]} />;
});

export const PriorityBadge = memo(function PriorityBadge({ request }: { request: Pick<ServiceRequest, 'priority' | 'priorityLabel'> }) {
  return (
    <Badge
      testID={`priority-${request.priority}`}
      label={request.priorityLabel}
      tone={PRIORITY_TONE[request.priority]}
      icon={request.priority === 'EMERGENCY' ? 'warning' : 'priority'}
      solid={request.priority === 'EMERGENCY'}
    />
  );
});

/** Request card. `perspective` decides whether to show the vendor or the customer. */
export const RequestCard = memo(function RequestCard({
  request,
  perspective,
  onPress,
}: {
  request: ServiceRequest;
  perspective: 'customer' | 'vendor';
  onPress: () => void;
}) {
  const theme = useTheme();
  const vendor = vendorLine(request);
  const accent = request.priority === 'EMERGENCY' ? 'danger' : perspective === 'vendor' && request.isDirectedToMe && request.status === 'PENDING_VENDOR' ? 'primary' : null;

  return (
    <Card onPress={onPress} accent={accent} testID={`request-card-${request.requestNumber}`} accessibilityLabel={`Request ${request.requestNumber}`}>
      <View style={{ gap: theme.spacing.sm }}>
        <Row justify="space-between">
          <Text variant="caption" color="textTertiary">
            {request.requestNumber}
          </Text>
          <StatusBadge request={request} />
        </Row>
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="bodyStrong">{request.subCategory?.name ?? request.category?.name}</Text>
          <Text variant="caption" color="textSecondary">
            {request.category?.name}
          </Text>
        </View>
        {perspective === 'vendor' ? (
          <Text variant="caption" color="textSecondary" numberOfLines={2}>
            {request.description}
          </Text>
        ) : null}
        <Row gap="sm" style={{ flexWrap: 'wrap' }}>
          <PriorityBadge request={request} />
          {perspective === 'vendor' && request.status === 'PENDING_VENDOR' ? (
            request.isDirectedToMe ? (
              <Badge testID="badge-directed" label="Chosen you" tone="primary" icon="verified" />
            ) : (
              <Badge testID="badge-broadcast" label="Open request" tone="neutral" icon="team" />
            )
          ) : null}
        </Row>
        <Row justify="space-between">
          <Row gap="xs" style={{ flex: 1 }}>
            <Icon name={perspective === 'vendor' ? 'profile' : vendor.icon} size="sm" color={vendor.waiting && perspective === 'customer' ? 'warning' : 'textTertiary'} />
            <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
              {perspective === 'vendor' ? request.customer?.name ?? 'Customer' : vendor.text}
            </Text>
          </Row>
          <Text variant="caption" color="textTertiary">
            {formatDate(request.createdAt)}
          </Text>
        </Row>
      </View>
    </Card>
  );
});

/** Read-only request timeline (App PROJECT_BIBLE §22). */
export const Timeline = memo(function Timeline({ entries }: { entries: TimelineEntry[] }) {
  const theme = useTheme();
  return (
    <View testID="timeline">
      {entries.map((entry, index) => {
        const last = index === entries.length - 1;
        return (
          <View key={entry.id} style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ alignItems: 'center', width: 14 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 4, backgroundColor: last ? theme.colors.primary : theme.colors.success }} />
              {!last ? <View style={{ flex: 1, width: 2, backgroundColor: theme.colors.border }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : theme.spacing.lg, gap: theme.spacing.xxs }}>
              <Text variant="bodyStrong">{entry.title}</Text>
              {entry.note ? (
                <Text variant="caption" color="textSecondary">
                  {entry.note}
                </Text>
              ) : null}
              <Text variant="caption" color="textTertiary">
                {formatDateTime(entry.createdAt)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
});

/** Customer view of who is (or will be) doing the work. */
export const VendorPanel = memo(function VendorPanel({ request }: { request: ServiceRequest }) {
  const theme = useTheme();
  if (request.vendor) {
    return (
      <View testID="vendor-assigned" style={{ gap: theme.spacing.md }}>
        <Row gap="md">
          <Avatar name={request.vendor.businessName} uri={request.vendor.profileImage} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="bodyStrong">{request.vendor.businessName}</Text>
            <Row gap="xs">
              <RatingStars value={request.vendor.averageRating ?? 0} size={14} />
              <Text variant="caption" color="textSecondary">
                {request.vendor.averageRating?.toFixed(1)} ({request.vendor.totalReviews})
              </Text>
            </Row>
            {request.vendor.phone ? (
              <Row gap="xs">
                <Icon name="call" size="xs" color="textTertiary" />
                <Text variant="caption" color="textSecondary">
                  {formatPhone(request.vendor.phone)}
                </Text>
              </Row>
            ) : null}
          </View>
        </Row>
        {request.assignedTeamMember ? (
          <Row gap="xs">
            <Icon name="team" size="sm" color="textTertiary" />
            <Text variant="caption" color="textSecondary">
              Technician: {request.assignedTeamMember.name} · {request.assignedTeamMember.designation}
            </Text>
          </Row>
        ) : null}
      </View>
    );
  }

  const line = vendorLine(request);
  const directed = request.dispatchMode === 'DIRECTED';
  return (
    <View testID={line.waiting ? (directed ? 'vendor-waiting-directed' : 'vendor-waiting-open') : 'vendor-none'} style={{ gap: theme.spacing.xs }}>
      <Row gap="sm">
        <Icon name={line.icon} size="md" color={line.waiting ? 'warning' : 'textTertiary'} />
        <Text variant="bodyStrong">{line.text}</Text>
      </Row>
      {line.waiting ? (
        <Text variant="caption" color="textSecondary">
          {directed
            ? 'Your chosen vendor has been notified. If they cannot take it, we will send it to other available vendors.'
            : strings.dispatch.anyVendorHint}
        </Text>
      ) : null}
    </View>
  );
});
