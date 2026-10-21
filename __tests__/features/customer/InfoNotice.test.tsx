/**
 * `InfoNotice` on its own (Phase 3D-12): the one card Create Request and
 * Preferred Vendor both draw. Their suites pin the words each says; this pins
 * the card's own rules:
 *
 * - one spoken element carrying every sentence, so the second is never heard
 *   without the first and the glyph is never read out
 * - a live region only when asked (`announce`), for a notice that arrives
 *   after the screen has been read — never by default
 * - the sentence is strong only when it heads a detail under it
 * - the info tone on its subtle tint, from tokens
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { InfoNotice } from '@/features/customer/components/InfoNotice';
import { ThemeProvider, useTheme } from '@/shared/theme';

const TEXT = 'You have an unfinished request for Plumber.';
const DETAIL = 'This request is kept only when you press Continue.';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
});

let infoSubtle: string | undefined;

function ReadTint() {
  infoSubtle = useTheme().colors.infoSubtle;
  return null;
}

async function mount(element: React.ReactElement) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <ReadTint />
        {element}
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  const host = (id: string) =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === id)[0];
  const texts = () =>
    renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props?.children === 'string' &&
        [TEXT, DETAIL].includes(node.props.children),
    );

  return { renderer, host, texts };
}

describe('InfoNotice', () => {
  it('says every sentence as one stop', async () => {
    const view = await mount(<InfoNotice text={TEXT} detail={DETAIL} testID="notice" />);

    const spoken = view.host('notice-text');
    expect(spoken.props.accessible).toBe(true);
    expect(spoken.props.accessibilityRole).toBe('text');
    expect(spoken.props.accessibilityLabel).toBe(`${TEXT} ${DETAIL}`);
  });

  it('says a lone sentence as itself', async () => {
    const view = await mount(<InfoNotice text={TEXT} testID="notice" />);

    expect(view.host('notice-text').props.accessibilityLabel).toBe(TEXT);
    expect(view.texts()).toHaveLength(1);
  });

  it('is a live region only when asked to announce itself', async () => {
    const quiet = await mount(<InfoNotice text={TEXT} detail={DETAIL} testID="quiet" />);
    expect(quiet.host('quiet-text').props.accessibilityLiveRegion).toBeUndefined();

    const told = await mount(<InfoNotice text={TEXT} announce testID="told" />);
    expect(told.host('told-text').props.accessibilityLiveRegion).toBe('polite');
  });

  it('is strong only when it heads a detail', async () => {
    const headed = await mount(<InfoNotice text={TEXT} detail={DETAIL} testID="headed" />);
    const lone = await mount(<InfoNotice text={TEXT} testID="lone" />);

    const weight = (view: Awaited<ReturnType<typeof mount>>) =>
      StyleSheet.flatten(view.texts().find(node => node.props.children === TEXT)?.props.style)
        ?.fontWeight;

    expect(weight(headed)).not.toBe(weight(lone));
  });

  it('sits on the info tint, from the theme', async () => {
    const view = await mount(<InfoNotice text={TEXT} testID="notice" />);

    const card = StyleSheet.flatten(view.host('notice').props.style);
    expect(card.backgroundColor).toBe(infoSubtle);
  });
});
