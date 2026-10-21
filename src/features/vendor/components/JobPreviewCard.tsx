/**
 * JobPreviewCard
 *
 * One request, as a card: section 31's fields — service, status, customer,
 * area, date, priority, reference.
 *
 * It is drawn in two places and is the same in both, so a request cannot look
 * like one thing on the dashboard and another in the list:
 *
 * - on the dashboard (Phase 3E-2) it is a card and not a button. The dashboard
 *   previews; the section's "See all" is the way onward.
 * - in the request list (Phase 3E-3) it is given `onPress` and becomes the
 *   button that opens the request. It then carries a chevron, so the two are
 *   told apart by more than behaviour.
 *
 * ⚠️ Pressing it only ever opens. The handler it is given receives a reference
 * and nothing else, so the card itself has nothing to change a request with.
 *
 * ⚠️ Acting is beside the card's button, never inside it (Phase 3E-4). A
 * waiting request in the list is handed `actions` — Accept and Reject; accepted
 * work, its next step from 3E-5 — and the
 * card then splits in two: the request, which is the button that opens it, and
 * under it the actions, as siblings. Nested inside the open button they would
 * be merged into it for a screen reader (Android cannot focus a button inside a
 * button) and every tap on them would be a contest with the card's own. Apart,
 * a tap on Accept accepts and opens nothing. Without `actions` the card is
 * exactly what it was.
 *
 * ⚠️ The area, never the address — see `VendorJobSummary`. The customer and the
 * area each get a line of their own (3E-3): on one line, a long name pushed the
 * area off the card altogether, and where the job is matters more to a vendor
 * than the last third of a name.
 *
 * It is one stop for a screen reader and says the whole card in one sentence,
 * including what is truncated on screen. An urgent request is told apart by its
 * word and its glyph as well as its colour (section 31).
 */

import React, { memo, useCallback, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableStateCallbackType } from 'react-native';

import { presentJobStatus } from '@/features/vendor/constants/jobPresentation';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { Card, Icon, StatusBadge, Text } from '@/shared/components';
import {
  RELATIVE_TIME_COPY,
  formatRequestDate,
  presentPriority,
} from '@/shared/presentation/requestTokens';
import type { VendorJobSummary } from '@/shared/services/types/VendorDashboardService';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.job;

export interface JobPreviewCardProps {
  job: VendorJobSummary;
  /**
   * Opens the request. Receives its reference; the card never navigates itself.
   * Without it the card is not pressable at all.
   */
  onPress?: (requestId: string) => void;
  /**
   * What can be done to the request, drawn under it and outside the button that
   * opens it. Only with `onPress`; only for a request it is valid for.
   */
  actions?: ReactNode;
  /** On the button that opens the request (the card itself, when there are no actions). */
  testID?: string;
}

function JobPreviewCardComponent({ job, onPress, actions, testID }: JobPreviewCardProps) {
  const theme = useTheme();

  const status = presentJobStatus(job);
  const priority = presentPriority(job.priority);
  const reference = `${COPY.referencePrefix} ${job.id}`;

  /*
    Finished work is dated by when it finished, a declined request by when the
    vendor declined it — the order the Rejected list is in (2026-10-21) —
    everything else by when it was raised. The dashboard never shows a
    declined request, so it is unchanged.
  */
  const when = job.completedAt
    ? dated(COPY.completedLabel, job.completedAt)
    : job.rejectedAt
      ? dated(COPY.rejectedLabel, job.rejectedAt)
      : dated(COPY.raisedLabel, job.createdAt);

  const spokenLabel = useMemo(
    () =>
      [
        job.serviceName,
        `${COPY.statusLabel}: ${status.label}`,
        `${COPY.customerLabel}: ${
          job.locality ? `${job.customerName}, ${job.locality}` : job.customerName
        }`,
        `${COPY.priorityLabel}: ${priority.label}`,
        when,
        reference,
      ].join('. '),
    [job.customerName, job.locality, job.serviceName, priority.label, reference, status.label, when],
  );

  const open = useCallback(() => {
    onPress?.(job.id);
  }, [job.id, onPress]);

  /*
    Hidden from assistive technology, not from the eye: the label on the card —
    or on the group, when it is not a button — already says all of it, and the
    status badge, which groups itself, would otherwise be a second stop
    repeating one word.
  */
  const body = (
    <View
      style={{ gap: theme.spacing.sm }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={[styles.headline, { gap: theme.spacing.sm }]}>
        {/*
          Given the row's remaining width, not sized by its own words. A title
          measured by its content and then shrunk was line-broken against a
          width a fraction narrower than the one it was measured at — at 360dp
          "Switchboard repair" drew as "Switchboard", its second word on a line
          the one-line height then clipped, with no ellipsis to say so (found on
          device, 3E-3; the same Android behaviour `ServiceCategoryField`
          documents). A definite width has nothing to disagree with.
        */}
        <Text variant="bodyStrong" numberOfLines={2} style={styles.title}>
          {job.serviceName}
        </Text>

        <StatusBadge label={status.label} tone={status.tone} icon={status.icon} />
      </View>

      <View style={{ gap: theme.spacing.xxs }}>
        <View style={[styles.row, { gap: theme.spacing.xs }]}>
          <Icon name="customer" size="sm" color="textTertiary" />
          <Text variant="body" color="textSecondary" numberOfLines={1} style={styles.shrinks}>
            {job.customerName}
          </Text>
        </View>

        {job.locality ? (
          <View style={[styles.row, { gap: theme.spacing.xs }]}>
            <Icon name="location" size="sm" color="textTertiary" />
            <Text variant="body" color="textSecondary" numberOfLines={1} style={styles.shrinks}>
              {job.locality}
            </Text>
          </View>
        ) : null}
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
        <View style={[styles.row, styles.shrinks, { gap: theme.spacing.xs }]}>
          <Icon name="calendar" size="xs" color="textTertiary" />
          <Text variant="caption" color="textTertiary" numberOfLines={1} style={styles.shrinks}>
            {when}
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
        <Text variant="caption" color="textTertiary" numberOfLines={1} style={styles.shrinks}>
          {reference}
        </Text>
        {/* Affordance only, and only where the card really is the target. */}
        {onPress ? <Icon name="forward" size="sm" color="textTertiary" /> : null}
      </View>
    </View>
  );

  if (onPress && actions) {
    // The card's own padding, moved inside its two halves, so the whole upper
    // half — edge to edge — is the open button.
    return (
      <Card bordered shadow="sm" padded={false}>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={spokenLabel}
          accessibilityHint={COPY.openHint}
          style={({ pressed }: PressableStateCallbackType) => [
            { padding: theme.spacing.lg, paddingBottom: theme.spacing.md },
            pressed && { opacity: theme.opacity.pressed },
          ]}
          testID={testID}>
          {body}
        </Pressable>

        <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          {actions}
        </View>
      </Card>
    );
  }

  if (onPress) {
    return (
      <Card
        bordered
        shadow="sm"
        onPress={open}
        // The card is the button, so the card carries the whole sentence.
        accessibilityLabel={spokenLabel}
        accessibilityHint={COPY.openHint}
        testID={testID}>
        {body}
      </Card>
    );
  }

  return (
    <Card bordered shadow="sm" testID={testID}>
      <View accessible accessibilityRole="text" accessibilityLabel={spokenLabel}>
        {body}
      </View>
    </Card>
  );
}

/**
 * "Completed 2 hr ago", "Raised just now", "Rejected 5 min ago".
 *
 * The shared formatter words a date to stand on its own, so "Just now" starts
 * with a capital — right in a field by itself, wrong after a label. Found on
 * device in 3E-5, the first time a job could be finished seconds before it was
 * listed; the fixtures had only ever said "1 day ago".
 */
function dated(label: string, iso: string): string {
  const date = formatRequestDate(iso);
  return date === RELATIVE_TIME_COPY.justNow ? `${label} ${COPY.justNow}` : `${label} ${date}`.trim();
}

const styles = StyleSheet.create({
  headline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
  },
  shrinks: {
    // Truncates rather than pushing what sits beside it off the card. Only on
    // single-line text: see the title above for why it is not used there.
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

export const JobPreviewCard = memo(JobPreviewCardComponent);
