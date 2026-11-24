/**
 * EmptyState / ErrorState / ScreenLoader
 *
 * Every API-driven screen shows one of Loading → Success → Empty → Error and is
 * never blank (App PROJECT_BIBLE §47).
 */

import React, { memo } from 'react';
import { View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Icon } from '@/shared/components/Icon';
import { Loader } from '@/shared/components/Loader';
import { Text } from '@/shared/components/Text';
import { strings } from '@/shared/i18n/strings';
import { useTheme, type IconName } from '@/shared/theme';
import type { AppError } from '@/shared/types/error';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

function EmptyStateComponent({ title, message, icon = 'empty', actionLabel, onAction, testID }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View testID={testID} style={{ alignItems: 'center', padding: theme.spacing.xxxl, gap: theme.spacing.md }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: theme.colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icon} size="xl" color="textTertiary" />
      </View>
      <Text variant="bodyStrong" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="caption" color="textSecondary" align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} fullWidth={false} /> : null}
    </View>
  );
}

interface ErrorStateProps {
  error: AppError;
  onRetry?: () => void;
}

function ErrorStateComponent({ error, onRetry }: ErrorStateProps) {
  const theme = useTheme();
  const icon: IconName = error.kind === 'network' ? 'offline' : 'error';
  return (
    <View testID="error-state" style={{ alignItems: 'center', padding: theme.spacing.xxxl, gap: theme.spacing.md }}>
      <Icon name={icon} size="xxl" color="danger" />
      <Text variant="bodyStrong" align="center">
        {error.kind === 'network' ? 'No connection' : strings.common.somethingWrong}
      </Text>
      <Text variant="caption" color="textSecondary" align="center">
        {error.userMessage}
      </Text>
      {onRetry ? (
        <Button label={strings.common.retry} icon="retry" onPress={onRetry} variant="secondary" fullWidth={false} />
      ) : null}
    </View>
  );
}

function ScreenLoaderComponent({ label }: { label?: string }) {
  return <Loader fullScreen size="large" label={label} />;
}

export const EmptyState = memo(EmptyStateComponent);
export const ErrorState = memo(ErrorStateComponent);
export const ScreenLoader = memo(ScreenLoaderComponent);
