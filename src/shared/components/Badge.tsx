/**
 * Badge
 *
 * Tone-driven pill. Domain modules map their values (status, priority) onto a
 * tone; this component never knows what a "status" is.
 */

import React, { memo } from 'react';
import { View } from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme, type ColorTone, type IconName } from '@/shared/theme';

export interface BadgeProps {
  label: string;
  tone?: ColorTone;
  icon?: IconName;
  solid?: boolean;
  testID?: string;
}

const SUBTLE = {
  primary: 'primarySubtle',
  success: 'successSubtle',
  warning: 'warningSubtle',
  danger: 'dangerSubtle',
  info: 'infoSubtle',
  neutral: 'neutralSubtle',
} as const;

function BadgeComponent({ label, tone = 'neutral', icon, solid = false, testID }: BadgeProps) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xxs,
        borderRadius: theme.radius.full,
        backgroundColor: solid ? theme.colors[tone] : theme.colors[SUBTLE[tone]],
      }}>
      {icon ? <Icon name={icon} size="xs" color={solid ? 'textInverse' : tone} /> : null}
      <Text variant="label" color={solid ? 'textInverse' : tone}>
        {label}
      </Text>
    </View>
  );
}

export const Badge = memo(BadgeComponent);
