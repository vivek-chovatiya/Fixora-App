/**
 * RequestSummary
 *
 * A request read back to the customer: a titled card per group, rows of label
 * and answer, a paragraph for notes, and a line with a glyph for a place.
 *
 * ⚠️ Two screens read a request back, and they must read it the same way. The
 * confirmation summary (PROJECT_BIBLE.md section 19) shows what is about to be
 * sent; request details (section 20) shows what was. These pieces were written
 * for the first and moved here unchanged when the second arrived — a customer
 * who checked "Urgency: High" before sending should find it drawn identically
 * when they open the request later, and two copies of the same row are two rows
 * that drift apart.
 *
 * Presentation only. Nothing here knows about drafts, services or navigation.
 * The one control it can draw — Edit — is handed its handler, and a screen that
 * passes none gets a group with no control at all, which is exactly how the
 * details screen stays read-only.
 */

import React, { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import type { TokenPresentation } from '@/features/customer/constants/requestPresentation';
import { Card, Icon, StatusBadge, Text } from '@/shared/components';
import { useTheme, type IconName } from '@/shared/theme';

const COPY = CUSTOMER_COPY.confirmation;

export interface RequestSummarySectionProps {
  title: string;
  /**
   * Where the group is corrected, when it can be.
   *
   * Optional because not every group is correctable: the service is what the
   * request *is* rather than a detail of it, and nothing at all is correctable
   * once a request has been sent.
   */
  onEdit?: () => void;
  /** The full sentence, since a screen reader can reach the control without the heading. */
  editLabel?: string;
  editHint?: string;
  /** Lands on the edit control, not the card. */
  editTestID?: string;
  /** Lands on the card. */
  testID?: string;
  children: ReactNode;
}

/** One group of a summary, with the control that corrects it when there is one. */
export function RequestSummarySection({
  title,
  onEdit,
  editLabel,
  editHint,
  editTestID,
  testID,
  children,
}: RequestSummarySectionProps) {
  const theme = useTheme();

  return (
    <Card
      bordered
      shadow="sm"
      style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
      testID={testID}>
      <View style={styles.sectionHeader}>
        <Text
          variant="overline"
          color="textTertiary"
          accessibilityRole="header"
          style={styles.grow}>
          {title}
        </Text>

        {onEdit && editLabel ? (
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            // The full sentence, not the word on screen: three buttons all
            // called "Edit" is three identical buttons.
            accessibilityLabel={editLabel}
            accessibilityHint={editHint}
            // The control is a word; the target is a finger. The slop makes up
            // the difference rather than padding the layout out to reach it.
            hitSlop={theme.spacing.md}
            style={({ pressed }) => [
              styles.inline,
              { gap: theme.spacing.xs },
              pressed && { opacity: theme.opacity.pressed },
            ]}
            testID={editTestID}>
            <Icon name="edit" size="xs" color="primary" />
            <Text variant="label" color="primary">
              {COPY.edit}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {children}
    </Card>
  );
}

export interface RequestSummaryRowProps {
  label: string;
  value: string;
  /**
   * Draws the answer as a badge instead of as words, for the answers that are a
   * scale. Tone and glyph together, never tone alone (section 46).
   */
  badge?: TokenPresentation;
  testID?: string;
}

/** One line of a summary: what it is, and what the answer was. */
function RequestSummaryRowComponent({ label, value, badge, testID }: RequestSummaryRowProps) {
  const theme = useTheme();

  return (
    /*
      Grouped into one node. Read as two, a screen reader says "Urgency" and
      then "High" as unrelated fragments, which on a list of eight rows is
      sixteen things to hold in your head instead of eight.
    */
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.row, { gap: theme.spacing.md, paddingVertical: theme.spacing.xs }]}
      testID={testID}>
      <Text variant="caption" color="textSecondary" style={styles.label}>
        {label}
      </Text>

      {badge ? (
        <View style={styles.grow}>
          {/*
            Hidden from the reader, not from the eye.

            `StatusBadge` groups itself so a badge on its own is announced as one
            thing, which inside a row that is already announced as one thing
            means "Urgency: Medium" followed by "Medium" — seen on device as two
            focusable nodes where the row is one fact. The row keeps the words;
            the badge keeps the colour and the glyph, which is what it is for.
          */}
          <View style={styles.badge} importantForAccessibility="no-hide-descendants">
            <StatusBadge label={badge.label} tone={badge.tone} icon={badge.icon} />
          </View>
        </View>
      ) : (
        <Text variant="bodyStrong" style={styles.grow}>
          {value}
        </Text>
      )}
    </View>
  );
}

export const RequestSummaryRow = memo(RequestSummaryRowComponent);

export interface RequestSummaryBlockProps {
  label: string;
  value: string;
  testID?: string;
}

/**
 * A row whose answer is a paragraph rather than a word.
 *
 * Notes are the customer's own description of their own problem and run to
 * several lines; squeezed into the two-thirds column the short rows use, a
 * sentence becomes a narrow ribbon of text. The label goes above it instead.
 */
function RequestSummaryBlockComponent({ label, value, testID }: RequestSummaryBlockProps) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}
      style={{ gap: theme.spacing.xxs, paddingVertical: theme.spacing.xs }}
      testID={testID}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

export const RequestSummaryBlock = memo(RequestSummaryBlockComponent);

export interface RequestSummaryLineProps {
  icon: IconName;
  /** Spoken, not drawn: the group's heading already says what this is. */
  label: string;
  value: string;
  testID?: string;
}

/** An answer that is a place or a person, led by the glyph that says which. */
function RequestSummaryLineComponent({ icon, label, value, testID }: RequestSummaryLineProps) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="text"
      // Said explicitly, so the glyph is never part of what is read out.
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.inline, { gap: theme.spacing.sm }]}
      testID={testID}>
      <Icon name={icon} size="md" color="textSecondary" />
      <Text variant="bodyStrong" style={styles.grow}>
        {value}
      </Text>
    </View>
  );
}

export const RequestSummaryLine = memo(RequestSummaryLineComponent);

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  label: {
    // A fixed column, so the rows read as a list rather than as differently
    // indented sentences.
    width: '32%',
  },
  grow: {
    // Takes the slack, so long answers wrap inside the card instead of pushing
    // the row wider than it.
    flex: 1,
  },
  badge: {
    // The badge sizes itself to its words; without this it would stretch across
    // the whole value column and read as a banner.
    alignSelf: 'flex-start',
  },
});
