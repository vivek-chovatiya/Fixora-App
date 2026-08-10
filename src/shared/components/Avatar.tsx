/**
 * Avatar
 *
 * Profile and vendor imagery, with a graceful chain of fallbacks:
 * image → initials → icon.
 *
 * Real data has missing and broken image URLs, so `onError` falls back at
 * runtime rather than only handling a null URI. Without that, a 404 renders as
 * an empty box.
 *
 * Sizes are composed from spacing tokens rather than literals, so the scale
 * moves with the rest of the design system.
 */

import React, { memo, useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { spacing, useTheme, type IconName } from '@/shared/theme';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Readonly<Record<AvatarSize, number>> = {
  sm: spacing.xxxl,
  md: spacing.giant,
  lg: spacing.giant + spacing.lg,
  xl: spacing.giant * 2,
};

/** Typography scales with the circle so initials stay optically centred. */
const INITIALS_VARIANT = {
  sm: 'caption',
  md: 'label',
  lg: 'h3',
  xl: 'h2',
} as const;

export interface AvatarProps {
  uri?: string | null;
  /** Source of the initials fallback. */
  name?: string | null;
  size?: AvatarSize;
  /** Final fallback when there is no image and no name. */
  fallbackIcon?: IconName;
  testID?: string;
}

/** First letter of the first and last word: "Asha Rani Patel" becomes "AP". */
export function getInitials(name?: string | null): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) {
    return '';
  }
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

function AvatarComponent({
  uri,
  name,
  size = 'md',
  fallbackIcon = 'profile',
  testID,
}: AvatarProps) {
  const theme = useTheme();
  const [hasImageFailed, setHasImageFailed] = useState(false);

  // A new uri deserves a fresh attempt; without this the component stays in the
  // failed state after the user uploads a replacement.
  useEffect(() => {
    setHasImageFailed(false);
  }, [uri]);

  const handleError = useCallback(() => {
    setHasImageFailed(true);
  }, []);

  const dimension = SIZES[size];
  const initials = getInitials(name);
  const showImage = Boolean(uri) && !hasImageFailed;

  const frame = {
    width: dimension,
    height: dimension,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primarySubtle,
  };

  const accessibilityLabel = name ? `${name} profile picture` : 'Profile picture';

  if (showImage && uri) {
    return (
      <Image
        source={{ uri }}
        onError={handleError}
        style={frame}
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return (
    <View
      style={[styles.fallback, frame]}
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}>
      {initials ? (
        <Text variant={INITIALS_VARIANT[size]} color="primary">
          {initials}
        </Text>
      ) : (
        <Icon name={fallbackIcon} size={size === 'sm' ? 'sm' : 'lg'} color="primary" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export const Avatar = memo(AvatarComponent);
