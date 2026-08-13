/**
 * ErrorState
 *
 * The single way a failure is shown to a user.
 *
 * It renders `error.userMessage`, never `error.message`. AppError keeps the two
 * apart precisely so a raw axios or server string can never reach the screen,
 * which PROJECT_BIBLE.md section 49 forbids.
 *
 * Retry is offered only when the failure is retryable and a handler is supplied.
 * Offering retry on a 403 invites the user to fail repeatedly.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/shared/components/Button';
import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme, type ColorTokens, type IconName } from '@/shared/theme';
import { AppError, type AppErrorKind } from '@/shared/types/error';

interface ErrorPresentation {
  icon: IconName;
  tone: keyof ColorTokens;
  title: string;
}

/**
 * Connection failures get their own treatment because they are the user's to
 * fix, unlike a server fault where retrying is all they can do.
 */
const PRESENTATION: Readonly<Record<AppErrorKind, ErrorPresentation>> = {
  network: { icon: 'offline', tone: 'warning', title: 'No connection' },
  timeout: { icon: 'offline', tone: 'warning', title: 'Taking too long' },
  unauthorized: { icon: 'warning', tone: 'warning', title: 'Session expired' },
  forbidden: { icon: 'warning', tone: 'danger', title: 'Not allowed' },
  notFound: { icon: 'empty', tone: 'neutral', title: 'Not found' },
  validation: { icon: 'warning', tone: 'warning', title: 'Check your details' },
  conflict: { icon: 'warning', tone: 'warning', title: 'Already changed' },
  permission: { icon: 'warning', tone: 'warning', title: 'Permission needed' },
  server: { icon: 'error', tone: 'danger', title: 'Something went wrong' },
  cancelled: { icon: 'info', tone: 'neutral', title: 'Cancelled' },
  unknown: { icon: 'error', tone: 'danger', title: 'Something went wrong' },
};

export interface ErrorStateProps {
  error: AppError | null | undefined;
  onRetry?: () => void;
  /** Overrides the title derived from the failure kind. */
  title?: string;
  retryLabel?: string;
  fullScreen?: boolean;
  testID?: string;
}

function ErrorStateComponent({
  error,
  onRetry,
  title,
  retryLabel = 'Try again',
  fullScreen = true,
  testID,
}: ErrorStateProps) {
  const theme = useTheme();

  if (!error) {
    return null;
  }

  const presentation = PRESENTATION[error.kind];

  return (
    <View
      testID={testID}
      // A failure that appears mid-form is silent to a screen reader otherwise:
      // nothing moves focus to it, so it reads as unrelated content the user has
      // to go looking for. Not `accessible`, which would collapse the block into
      // one node and take the retry button out of the focus order.
      accessibilityLiveRegion="polite"
      style={[
        styles.container,
        fullScreen && styles.fullScreen,
        { padding: theme.spacing.xl, gap: theme.spacing.md },
      ]}>
      <Icon name={presentation.icon} size="xxl" color={presentation.tone} />

      <View style={[styles.copy, { gap: theme.spacing.xs }]}>
        <Text variant="h3" align="center">
          {title ?? presentation.title}
        </Text>
        <Text variant="body" color="textSecondary" align="center">
          {error.userMessage}
        </Text>
      </View>

      {error.isRetryable && onRetry ? (
        <PrimaryButton label={retryLabel} icon="retry" onPress={onRetry} />
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

export const ErrorState = memo(ErrorStateComponent);
