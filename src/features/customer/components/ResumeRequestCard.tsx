/**
 * ResumeRequestCard
 *
 * The request the customer started and did not send.
 *
 * ⚠️ It offers; it never nags. An interrupted request is not a mistake, so this
 * is written as an invitation and drawn as one — a bordered surface in the
 * brand's quiet tone, above the sections that were already there, rather than a
 * warning banner in a colour reserved for things that have gone wrong.
 *
 * It names the service so somebody can tell at a glance which request is
 * waiting, and says how long ago it was left using the same relative wording the
 * request cards use. Both are display data resolved elsewhere and handed in;
 * this draws what it is given and knows nothing about drafts or storage.
 *
 * The whole card is the action. A card with a button on it would be two targets
 * for one intention, and the button would be the smaller of them.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { Card, Icon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.home;

export interface ResumeRequestCardProps {
  /** The service the request is for, once the catalogue has said. */
  serviceName?: string;
  /** How long ago it was left, already formatted. Omitted when not known. */
  startedLabel?: string;
  onPress: () => void;
  testID?: string;
}

function ResumeRequestCardComponent({
  serviceName,
  startedLabel,
  onPress,
  testID,
}: ResumeRequestCardProps) {
  const theme = useTheme();

  const service = serviceName ?? COPY.resumeFallbackService;
  const detail = startedLabel ? `${service} · ${startedLabel}` : service;

  return (
    <Card
      onPress={onPress}
      bordered
      padded={false}
      shadow="sm"
      background="primarySubtle"
      style={[styles.card, { padding: theme.spacing.lg, gap: theme.spacing.md }]}
      accessibilityLabel={`${COPY.resumeTitle}. ${detail}`}
      accessibilityHint={COPY.resumeHint}
      testID={testID}>
      <View
        style={[
          styles.glyph,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.full,
            width: theme.spacing.huge,
            height: theme.spacing.huge,
          },
        ]}>
        <Icon name="edit" size="md" color="primary" />
      </View>

      <View style={[styles.body, { gap: theme.spacing.xxs }]}>
        <Text variant="bodyStrong" color="onPrimarySubtle">
          {COPY.resumeTitle}
        </Text>
        <Text variant="caption" color="onPrimarySubtle">
          {detail}
        </Text>
      </View>

      {/*
        Affordance only. The card is the button, and a chevron announced beside
        it would be a second thing to hear about the same one thing.
      */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name="forward" size="md" color="onPrimarySubtle" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    // Takes the slack, so a long service name wraps inside the card instead of
    // pushing the chevron off the end of it.
    flex: 1,
  },
});

export const ResumeRequestCard = memo(ResumeRequestCardComponent);
