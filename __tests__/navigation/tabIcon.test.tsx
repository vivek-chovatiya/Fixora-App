/**
 * The tab bar used to say which tab was selected with colour and nothing else.
 *
 * That is invisible to a monochrome display, to most colour-vision deficiencies
 * and in bright sunlight, and PROJECT_BIBLE.md section 46 forbids it. The fix
 * was to give every tab a filled counterpart and swap the glyph on focus.
 *
 * These tests pin that property rather than the particular glyphs chosen:
 * whatever the icon set says, focused and unfocused must not be the same shape,
 * and the colour must still change as reinforcement. Renaming a glyph in the
 * registry should not fail a test; making the two states identical should.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { createTabIcon, type TabIconName } from '@/navigation/tabIcon';
import { ThemeProvider, icons, lightTheme } from '@/shared/theme';

/** Every tab the two role navigators actually render. */
const TAB_ICONS: readonly TabIconName[] = ['home', 'requests', 'profile', 'team'];

async function renderIcon(name: TabIconName, focused: boolean) {
  const TabIcon = createTabIcon(name);

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <TabIcon focused={focused} />
      </ThemeProvider>,
    );
  });

  // The vector-icon host element, which is what carries the resolved glyph and
  // colour once Icon has mapped the tokens.
  const glyph = renderer.root.findAll(
    node => typeof node.props?.name === 'string' && typeof node.props?.color === 'string',
  );

  const resolved = glyph[glyph.length - 1];

  return { name: resolved?.props.name as string, color: resolved?.props.color as string };
}

describe('createTabIcon', () => {
  it.each(TAB_ICONS)('gives %s a different shape when it is selected', async tab => {
    const unfocused = await renderIcon(tab, false);
    const focused = await renderIcon(tab, true);

    // The whole point: shape carries the state, so colour is never alone.
    expect(focused.name).not.toBe(unfocused.name);
    expect(unfocused.name).toBe(icons[tab]);
  });

  it.each(TAB_ICONS)('still recolours %s, so the two signals reinforce', async tab => {
    const unfocused = await renderIcon(tab, false);
    const focused = await renderIcon(tab, true);

    expect(focused.color).toBe(lightTheme.colors.primary);
    expect(unfocused.color).toBe(lightTheme.colors.textTertiary);
  });

  it('resolves every selected glyph through the icon registry', () => {
    // A missing entry would render the literal token name as a glyph, which
    // shows as a blank square on the device and passes every type check.
    for (const tab of TAB_ICONS) {
      const selected = `${tab}Selected` as keyof typeof icons;

      expect(icons[selected]).toBeDefined();
      expect(icons[selected]).not.toBe(icons[tab]);
    }
  });
});
