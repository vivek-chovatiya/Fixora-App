/**
 * HomeSection
 *
 * A titled block of the home screen, with an optional action on the right.
 *
 * It exists so the sections cannot drift: the same heading size, the same gap
 * beneath it, the same place for "See all". Three sections each styling their
 * own heading is three chances for one of them to be four points different from
 * the others.
 *
 * The heading is a real header for assistive technology, which is what lets a
 * screen reader user jump between sections instead of walking the whole page.
 * The action beside it names its section explicitly — "See all" alone, heard out
 * of context, says nothing about what it will show.
 */

import React, { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface HomeSectionProps {
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

function HomeSectionComponent({
  title,
  children,
  actionLabel,
  onAction,
  actionAccessibilityLabel,
  actionAccessibilityHint,
  testID,
}: HomeSectionProps) {
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

export const HomeSection = memo(HomeSectionComponent);
