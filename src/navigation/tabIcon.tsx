/**
 * Tab icon factory
 *
 * Both role navigators render tab icons the same way, so the mapping from
 * focused state to an icon and a colour token lives here rather than being
 * repeated per tab (CLAUDE.md section 8).
 *
 * ⚠️ Focus changes the glyph, not only its colour. A tab bar that recolours an
 * otherwise identical outline says nothing to a user who cannot separate the two
 * colours — which PROJECT_BIBLE.md section 46 forbids, and which is also simply
 * hard to read in sunlight. The filled counterpart carries the state in shape,
 * and the colour change stays on top of it as reinforcement rather than as the
 * whole signal.
 *
 * React Navigation hands `tabBarIcon` a raw colour string, but Icon takes a
 * semantic token so dark mode stays automatic. Resolving from `focused` keeps
 * the token boundary intact instead of passing a hex value through.
 *
 * The same glyph is drawn in two places: in the bar, and inside the floating
 * button that marks the selected tab. Those two surfaces need different ink —
 * the accent reads on the bar and vanishes on a button filled with it — so this
 * file owns both policies rather than letting the bar pass a colour in. What the
 * bar passes is a tab, and it recovers which tab from the renderer itself: a
 * destination's icon carries the name it was built from, so there is still only
 * one place that decides a tab's glyph.
 */

import React from 'react';

import { Icon } from '@/shared/components/Icon';
import type { IconName } from '@/shared/theme';

/**
 * The glyphs a tab bar may use.
 *
 * Narrower than `IconName` on purpose: it is what makes the table below
 * exhaustive, so a fifth tab cannot be added without also giving it a filled
 * counterpart. The alternative — a partial lookup with a fallback — would let a
 * new tab silently ship with colour as its only selected state, which is the
 * exact defect this file exists to prevent.
 */
export type TabIconName = 'home' | 'requests' | 'profile' | 'team';

const SELECTED: Readonly<Record<TabIconName, IconName>> = {
  home: 'homeSelected',
  requests: 'requestsSelected',
  profile: 'profileSelected',
  team: 'teamSelected',
};

/**
 * What `createTabIcon` returns: a renderer React Navigation can call, carrying
 * the tab it was built for so the bar can draw the same glyph somewhere else.
 */
export interface TabIconRenderer {
  (props: { focused: boolean }): React.ReactElement;
  readonly tabIconName: TabIconName;
}

export function createTabIcon(name: TabIconName): TabIconRenderer {
  // Deliberately hookless. React Navigation calls this as a plain function
  // rather than mounting it, so a hook here would run in whichever component
  // happened to be rendering the bar.
  function TabIcon({ focused }: { focused: boolean }) {
    return (
      <Icon
        name={focused ? SELECTED[name] : name}
        size="md"
        color={focused ? 'primary' : 'textTertiary'}
      />
    );
  }

  return Object.assign(TabIcon, { tabIconName: name } as const);
}

/**
 * The selected glyph, drawn for the accent-filled button that floats above the
 * bar.
 *
 * Always the selected shape, because this only ever appears on the tab that is
 * selected — and always `textInverse`, because it sits on the accent rather than
 * beside it. Larger than the bar's icons: it is the one control on the bar that
 * is meant to be looked at.
 */
export function ActiveTabIcon({ tab }: { tab: TabIconName }) {
  return <Icon name={SELECTED[tab]} size="lg" color="textInverse" />;
}

/**
 * Recovers the tab a destination's icon was built from.
 *
 * `undefined` for a destination whose icon did not come from `createTabIcon` —
 * which is not an error, only a destination the bar has to fall back to drawing
 * the ordinary way.
 */
export function tabIconNameOf(icon: unknown): TabIconName | undefined {
  const name = (icon as Partial<TabIconRenderer> | undefined)?.tabIconName;

  return typeof name === 'string' && name in SELECTED ? name : undefined;
}
