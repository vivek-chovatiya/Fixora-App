/**
 * Tab icon factory
 *
 * Both role navigators render tab icons the same way, so the mapping from
 * focused state to a colour token lives here rather than being repeated per tab
 * (CLAUDE.md section 8).
 *
 * React Navigation hands `tabBarIcon` a raw colour string, but Icon takes a
 * semantic token so dark mode stays automatic. Resolving from `focused` keeps
 * the token boundary intact instead of passing a hex value through.
 */

import React from 'react';

import { Icon } from '@/shared/components/Icon';
import type { IconName } from '@/shared/theme';

export function createTabIcon(name: IconName) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return <Icon name={name} size="md" color={focused ? 'primary' : 'textTertiary'} />;
  };
}
