/**
 * Icon / DynamicIcon
 *
 * The only place the icon library is imported.
 *
 * `Icon` takes a theme token, so components never contain glyph strings.
 * `DynamicIcon` takes a backend-supplied glyph — used for categories, where the
 * app must render an icon it has never heard of without a code change — and
 * falls back safely when the value is missing.
 */

import React, { memo } from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  useTheme,
  type ColorTokens,
  type IconName,
  type IconSizeToken,
  resolveRemoteIcon,
} from '@/shared/theme';

interface BaseIconProps {
  size?: IconSizeToken | number;
  color?: keyof ColorTokens;
}

export interface IconProps extends BaseIconProps {
  name: IconName;
}

export interface DynamicIconProps extends BaseIconProps {
  /** Glyph name from the backend. Missing or blank values render the fallback. */
  glyph?: string | null;
}

function useIconStyle({ size = 'md', color = 'textPrimary' }: BaseIconProps) {
  const theme = useTheme();
  return {
    size: typeof size === 'number' ? size : theme.iconSize[size],
    color: theme.colors[color],
  };
}

function IconComponent({ name, size, color }: IconProps) {
  const theme = useTheme();
  const resolved = useIconStyle({ size, color });

  return (
    <MaterialCommunityIcons
      name={theme.icons[name]}
      size={resolved.size}
      color={resolved.color}
    />
  );
}

function DynamicIconComponent({ glyph, size, color }: DynamicIconProps) {
  const resolved = useIconStyle({ size, color });

  return (
    <MaterialCommunityIcons
      name={resolveRemoteIcon(glyph)}
      size={resolved.size}
      color={resolved.color}
    />
  );
}

export const Icon = memo(IconComponent);
export const DynamicIcon = memo(DynamicIconComponent);
