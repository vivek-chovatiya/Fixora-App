/**
 * RecentRequestCard
 *
 * One recent request, at a glance: what was asked for, who has it, where it has
 * got to, how urgent it is and when it was raised — the five things
 * PROJECT_BIBLE.md section 23 puts on a request card.
 *
 * ⚠️ The whole card opens the request (section 23: "Request Card → Request
 * Details"). It used to be deliberately inert, because a card that looked
 * tappable before the details screen existed would have gone nowhere. It hands
 * back the request's identifier and nothing else; where that leads is the
 * screen's decision, and what the request contains is the details screen's to
 * fetch.
 *
 * Status never rests on colour. The badge carries a word and a glyph as well as
 * a tone, and priority is written out beside its own icon — so the card survives
 * greyscale, colour blindness and a screen reader, none of which the tone alone
 * would (PROJECT_BIBLE.md section 46).
 *
 * It reads as one button to assistive technology rather than as six loose
 * fragments, because a request is one thing. The composed label puts them in the
 * order someone scanning would take them: service, status, vendor, priority,
 * when, and finally the reference, which is what tells two otherwise alike
 * requests apart.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { formatRequestDate, presentPriority } from '@/features/customer/constants/requestPresentation';
import {
  presentRequestState,
  requestStateOf,
  type RequestDispatch,
} from '@/features/customer/constants/requestStatus';
import { Card, Icon, StatusBadge, Text } from '@/shared/components';
import type { CustomerRequest } from '@/shared/services/types/RequestService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.request;

export interface RecentRequestCardProps {
  request: CustomerRequest;
  /** Receives the request's identifier. The card never navigates itself. */
  onPress: (requestId: string) => void;
  testID?: string;
}

function RecentRequestCardComponent({ request, onPress, testID }: RecentRequestCardProps) {
  const theme = useTheme();

  /*
    The same stage the details screen shows. The summary carries the customer's
    preference, so a request waiting to be taken says which wait it is —
    searching when nobody was chosen, awaiting a response when somebody was —
    exactly as section 20 asks, and never something the status does not say.
  */
  const dispatch: RequestDispatch = request.preferredVendor ? 'directed' : 'open';
  const status = presentRequestState(requestStateOf(request.status, dispatch));
  const priority = presentPriority(request.priority);
  const raised = formatRequestDate(request.createdAt);
  const vendor = request.vendorName ?? COPY.vendorPending;
  // Only the backend's quotable reference — never the database id, which is for calls.
  const reference = request.reference?.trim() ? `${COPY.referencePrefix} ${request.reference}` : '';

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

  const open = useCallback(() => {
    onPress(request.id);
  }, [onPress, request.id]);

  return (
    <Card
      bordered
      shadow="sm"
      onPress={open}
      // The card is the button, so the card carries the whole sentence.
      accessibilityLabel={spokenLabel}
      accessibilityHint={COPY.openHint}
      testID={testID}>
      {/*
        Hidden from assistive technology, not from the eye.

        The button above already says everything drawn here. Left exposed, the
        status badge — which groups itself — would be a second focus stop inside
        the card announcing a word the card has just said.
      */}
      <View
        style={{ gap: theme.spacing.sm }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
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

        <View style={[styles.footer, { gap: theme.spacing.sm }]}>
          {reference ? (
            <Text variant="caption" color="textTertiary">
              {reference}
            </Text>
          ) : null}
          {/* Affordance only; the card is the target. */}
          <Icon name="forward" size="sm" color="textTertiary" />
        </View>
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
