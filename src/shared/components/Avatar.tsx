import React, { memo } from 'react';
import { Image, View } from 'react-native';

import { Text } from '@/shared/components/Text';
import { useTheme } from '@/shared/theme';
import { initials, resolveFileUrl } from '@/shared/utils/format';

export interface AvatarProps {
  name?: string | null;
  uri?: string | null;
  size?: number;
}

function AvatarComponent({ name, uri, size = 44 }: AvatarProps) {
  const theme = useTheme();
  const resolved = resolveFileUrl(uri);
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (resolved) {
    return <Image source={{ uri: resolved }} style={[shape, { backgroundColor: theme.colors.surfaceAlt }]} accessibilityIgnoresInvertColors />;
  }

  return (
    <View style={[shape, { backgroundColor: theme.colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }]}>
      <Text variant={size >= 56 ? 'h3' : 'bodyStrong'} color="primary">
        {initials(name)}
      </Text>
    </View>
  );
}

export const Avatar = memo(AvatarComponent);
