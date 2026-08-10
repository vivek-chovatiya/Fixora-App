/**
 * PlaceholderScreen — TEMPORARY SCAFFOLDING
 *
 * Stands in for screens that arrive in Stages 2, 3 and 4 so the navigation tree
 * is complete and runnable now.
 *
 * Every use of this must be gone before launch: PROJECT_BIBLE.md section 85
 * requires that no placeholder content ships. Deleting this file and fixing the
 * resulting type errors is the checklist for that.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/shared/components/Text';
import { useTheme } from '@/shared/theme';

export interface PlaceholderScreenProps {
  title: string;
  /** Which roadmap section defines the real screen. */
  reference?: string;
}

export function PlaceholderScreen({ title, reference }: PlaceholderScreenProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background, gap: theme.spacing.sm, padding: theme.spacing.xl },
      ]}>
      <Text variant="h2" align="center">
        {title}
      </Text>
      <Text variant="caption" color="textTertiary" align="center">
        {reference ? `Not built yet — ${reference}` : 'Not built yet'}
      </Text>
    </View>
  );
}

/** Builds a screen component for a navigator without a per-screen file. */
export function createPlaceholder(title: string, reference?: string) {
  return function Placeholder() {
    return <PlaceholderScreen title={title} reference={reference} />;
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
