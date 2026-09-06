/**
 * RecentRequestCard
 *
 * One recent request, at a glance: what was asked for, who has it, where it has
 * got to, how urgent it is and when it was raised — the five things
 * PROJECT_BIBLE.md section 23 puts on a request card.
 *
 * ⚠️ Not pressable, and that is not an oversight. Request details is a screen
 * that has not been built, so a card that looked tappable would either go
 * nowhere or go somewhere unfinished. It becomes a link the day that screen
 * exists, and until then it says what it knows and stops there.
 *
 * Status never rests on colour. The badge carries a word and a glyph as well as
 * a tone, and priority is written out beside its own icon — so the card survives
 * greyscale, colour blindness and a screen reader, none of which the tone alone
 * would (PROJECT_BIBLE.md section 46).
 *
 * It reads as one thing to assistive technology rather than as six loose
 * fragments, because a request is one thing. The composed label puts them in the
 * order someone scanning would take them: service, status, vendor, priority,
 * when, and finally the reference they would quote if they called.
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import {
  formatRequestDate,
  presentPriority,
  presentStatus,
} from '@/features/customer/constants/requestPresentation';
import { Card, Icon, StatusBadge, Text } from '@/shared/components';
import type { CustomerRequest } from '@/shared/services/types/RequestService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.request;

export interface RecentRequestCardProps {
  request: CustomerRequest;
  testID?: string;
}

function RecentRequestCardComponent({ request, testID }: RecentRequestCardProps) {
  const theme = useTheme();

  const status = presentStatus(request.status);
  const priority = presentPriority(request.priority);
  const raised = formatRequestDate(request.createdAt);
  const vendor = request.vendorName ?? COPY.vendorPending;
  const reference = `${COPY.referencePrefix} ${request.id}`;

  const spokenLabel = useMemo(
    () =>
      [
        request.serviceName,
        `${COPY.statusLabel}: ${status.label}`,
        vendor,
        `${COPY.priorityLabel}: ${priority.label}`,
        raised,
        reference,
      ]
        .filter(Boolean)
        .join('. '),
    [request.serviceName, status.label, vendor, priority.label, raised, reference],
  );

  return (
    <Card bordered shadow="sm" testID={testID}>
      {/*
        The grouping node sits inside the card rather than on it, because Card is
        a surface and takes no accessibility grouping props. One node either way:
        announced as a request, not as a pile of words that happen to sit near
        each other.
      */}
      <View
        style={{ gap: theme.spacing.sm }}
        accessible
        accessibilityRole="text"
        accessibilityLabel={spokenLabel}>
        <View style={[styles.headline, { gap: theme.spacing.sm }]}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.shrinks}>
            {request.serviceName}
          </Text>

          <StatusBadge label={status.label} tone={status.tone} icon={status.icon} />
        </View>

        <View style={[styles.row, { gap: theme.spacing.xs }]}>
          <Icon name="business" size="sm" color="textTertiary" />
          <Text
            variant="body"
            // Quieter when there is nobody yet, so an absence reads as an
            // absence rather than as a vendor with an odd name.
            color={request.vendorName ? 'textSecondary' : 'textTertiary'}
            numberOfLines={1}
            style={styles.shrinks}>
            {vendor}
          </Text>
        </View>

        <View
          style={[
            styles.footer,
            {
              gap: theme.spacing.sm,
              paddingTop: theme.spacing.sm,
              borderTopWidth: theme.borderWidth.hairline,
              borderTopColor: theme.colors.border,
            },
          ]}>
          <View style={[styles.row, { gap: theme.spacing.xs }]}>
            <Icon name="calendar" size="xs" color="textTertiary" />
            <Text variant="caption" color="textTertiary">
              {raised}
            </Text>
          </View>

          <View style={[styles.row, { gap: theme.spacing.xs }]}>
            <Icon name={priority.icon} size="xs" color={priority.tone} />
            <Text variant="caption" color={priority.tone}>
              {priority.label}
            </Text>
          </View>
        </View>

        <Text variant="caption" color="textTertiary">
          {reference}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shrinks: {
    // Truncates rather than pushing what sits beside it off the card.
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

export const RecentRequestCard = memo(RecentRequestCardComponent);
