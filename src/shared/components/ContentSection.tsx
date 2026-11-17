/**
 * ContentSection
 *
 * A titled block on a scrolling page: a heading, an optional terse action on
 * the trailing edge ("See all"), and whatever the section holds.
 *
 * Written for customer Home as `HomeSection` and shared in Phase 3E-2, when the
 * vendor dashboard needed exactly the same block. It is unchanged; the customer
 * module still exports it under its old name.
 *
 * The action is small to read and full-size to press, and takes a spoken label
 * of its own because "See all", heard alone, says nothing about what it shows.
 */

import React, { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface ContentSectionProps {
  title: string;
  children: ReactNode;
  /** Label for the trailing action. Omitted where the section has nowhere to go. */
  actionLabel?: string;
  onAction?: () => void;
  /** Spoken name for the action, since the visible label is deliberately terse. */
  actionAccessibilityLabel?: string;
  actionAccessibilityHint?: string;
  testID?: string;
}

function ContentSectionComponent({
  title,
  children,
  actionLabel,
  onAction,
  actionAccessibilityLabel,
  actionAccessibilityHint,
  testID,
}: ContentSectionProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }} testID={testID}>
      <View style={[styles.header, { gap: theme.spacing.md }]}>
        <Text variant="h3" accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
            accessibilityHint={actionAccessibilityHint}
            // The words are small; the target is not. Padding rather than
            // hitSlop so the pressed area and the drawn area agree.
            hitSlop={theme.spacing.sm}
            style={[styles.action, { gap: theme.spacing.xxs }]}
            testID={testID ? `${testID}-action` : undefined}>
            <Text variant="label" color="primary">
              {actionLabel}
            </Text>
            <Icon name="forward" size="sm" color="primary" />
          </Pressable>
        ) : null}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    // Truncates rather than squeezing the action off the row.
    flexShrink: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export const ContentSection = memo(ContentSectionComponent);
