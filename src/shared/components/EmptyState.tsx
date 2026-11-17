/**
 * EmptyState
 *
 * Shown when a request succeeded but returned nothing.
 *
 * PROJECT_BIBLE.md section 47 forbids blank screens, and section 48 defines the
 * copy. An empty result is a normal outcome, so this is styled calmly — it must
 * not read as a failure, which is what ErrorState is for.
 *
 * The action is optional but strongly encouraged: an empty list with no next
 * step leaves the user with nothing to do.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/shared/components/Button';
import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme, type IconName } from '@/shared/theme';

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  /** Centres in the remaining space. Disable when embedding inside a list header. */
  fullScreen?: boolean;
  testID?: string;
}

function EmptyStateComponent({
  title,
  message,
  icon = 'empty',
  actionLabel,
  onAction,
  fullScreen = true,
  testID,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        fullScreen && styles.fullScreen,
        { padding: theme.spacing.xl, gap: theme.spacing.md },
      ]}>
      <Icon name={icon} size="xxl" color="textTertiary" />

      <View style={[styles.copy, { gap: theme.spacing.xs }]}>
        <Text variant="h3" align="center">
          {title}
        </Text>
        {message ? (
          <Text variant="body" color="textSecondary" align="center">
            {message}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
  },
  copy: {
    alignItems: 'center',
  },
});

export const EmptyState = memo(EmptyStateComponent);
