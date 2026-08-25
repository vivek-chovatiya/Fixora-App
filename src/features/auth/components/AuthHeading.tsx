/**
 * AuthHeading
 *
 * The heading an auth screen opens its content with, and the line under it.
 *
 * It lives in the page body rather than in the header slot, which is the whole
 * point of it. The brand panel it replaced pinned the heading above the scroll
 * area, so on the registration form "Register your business" stayed on screen
 * through all eleven fields — a heading is worth its height while it is being
 * read and worth nothing once the reader has started answering it.
 *
 * Set at `hero`, the top of the type scale and the only thing in the
 * application at that size. Without the band of colour behind it there is
 * nothing else giving these screens a top, so the heading has to be large enough
 * to be that on its own.
 */

import React, { memo } from 'react';
import { View } from 'react-native';

import { Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface AuthHeadingProps {
  title: string;
  /** Supporting line. Absent where the form below names its own destination. */
  subtitle?: string;
  testID?: string;
}

function AuthHeadingComponent({ title, subtitle, testID }: AuthHeadingProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }} testID={testID}>
      <Text variant="hero" accessibilityRole="header">
        {title}
      </Text>

      {subtitle ? (
        <Text variant="subtitle" color="textSecondary">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export const AuthHeading = memo(AuthHeadingComponent);
