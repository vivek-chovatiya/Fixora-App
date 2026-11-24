import React, { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { useTheme } from '@/shared/theme';

export interface RatingStarsProps {
  value: number;
  size?: number;
  /** Supplying onChange makes the stars an input. */
  onChange?: (value: number) => void;
}

function RatingStarsComponent({ value, size = 16, onChange }: RatingStarsProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: onChange ? theme.spacing.sm : theme.spacing.xxs }} accessibilityLabel={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(star => {
        const filled = star <= Math.round(value);
        const icon = <Icon name={filled ? 'star' : 'starOutline'} size={size} color={filled ? 'warning' : 'textTertiary'} />;
        if (!onChange) {
          return <View key={star}>{icon}</View>;
        }
        return (
          <Pressable
            key={star}
            testID={`rating-star-${star}`}
            accessibilityRole="button"
            accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
            onPress={() => onChange(star)}
            hitSlop={6}>
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}

export const RatingStars = memo(RatingStarsComponent);
