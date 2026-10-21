/**
 * OfflineBanner: there only while offline, spoken once as one block, and
 * nothing to press.
 *
 * The connection is driven through `MockNetworkStatusService`, so these tests
 * hold the banner to the rule rather than to the connectivity library's mock.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { OFFLINE_BANNER_COPY, OfflineBanner } from '@/shared/components';
import { ERROR_PRESENTATION } from '@/shared/components/errorPresentation';
import { MockNetworkStatusService } from '@/shared/services/mock/MockNetworkStatusService';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import { SUBTLE_INK, ThemeProvider, type SubtleTint } from '@/shared/theme';

const SPOKEN = "You're offline. Some things may not load until you reconnect.";

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  while (mounted.length > 0) {
    const renderer = mounted.pop()!;
    await act(async () => {
      renderer.unmount();
    });
  }
  resetServices();
});

async function render(network: MockNetworkStatusService) {
  registerService('networkStatus', network);

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <OfflineBanner />
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  return renderer;
}

/** Host nodes only: the composite wrappers carry some of the same props. */
function hostNodes(renderer: ReactTestRenderer.ReactTestRenderer, predicate: (props: any) => boolean) {
  return renderer.root.findAll(node => typeof node.type === 'string' && predicate(node.props));
}

function banner(renderer: ReactTestRenderer.ReactTestRenderer) {
  return hostNodes(renderer, props => props.testID === 'offline-banner');
}

describe('OfflineBanner', () => {
  it('draws nothing while the device is online', async () => {
    const renderer = await render(new MockNetworkStatusService());

    expect(renderer.toJSON()).toBeNull();
  });

  it('appears when the connection drops and goes when it returns', async () => {
    const network = new MockNetworkStatusService();
    const renderer = await render(network);

    await act(async () => {
      network.setOffline(true);
    });
    expect(banner(renderer)).toHaveLength(1);

    await act(async () => {
      network.setOffline(false);
    });
    expect(banner(renderer)).toHaveLength(0);
    expect(renderer.toJSON()).toBeNull();
  });

  it('says the frozen copy, and nothing else', async () => {
    const renderer = await render(new MockNetworkStatusService({ isOffline: true }));

    expect(`${OFFLINE_BANNER_COPY.title} ${OFFLINE_BANNER_COPY.message}`).toBe(SPOKEN);
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain(OFFLINE_BANNER_COPY.title);
    expect(text).toContain(OFFLINE_BANNER_COPY.message);
  });

  it('is announced politely, as one alert, in whole sentences', async () => {
    const renderer = await render(new MockNetworkStatusService({ isOffline: true }));

    const alerts = hostNodes(renderer, props => props.accessibilityRole === 'alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].props.accessible).toBe(true);
    expect(alerts[0].props.accessibilityLiveRegion).toBe('polite');
    expect(alerts[0].props.accessibilityLabel).toBe(SPOKEN);
  });

  it('wears the network failure’s glyph and tint, so it reads like every “No connection”', async () => {
    const renderer = await render(new MockNetworkStatusService({ isOffline: true }));

    // `Icon` is memoised, so it is found by the token props it is given.
    const icons = renderer.root.findAll(
      node => typeof node.type !== 'string' && typeof node.props.name === 'string' && 'color' in node.props,
    );
    expect(icons.length).toBeGreaterThan(0);
    expect(icons[0].props.name).toBe(ERROR_PRESENTATION.network.icon);
    // The tone's tint, in that tint's own ink (3G-4) — not the tone's colour,
    // which is 2.9:1 on its tint in light.
    const tint = `${ERROR_PRESENTATION.network.tone}Subtle` as SubtleTint;
    expect(icons[0].props.color).toBe(SUBTLE_INK[tint]);
    expect(icons[0].props.color).not.toBe(ERROR_PRESENTATION.network.tone);
  });

  it('offers nothing to press', async () => {
    const renderer = await render(new MockNetworkStatusService({ isOffline: true }));

    expect(hostNodes(renderer, props => props.accessibilityRole === 'button')).toHaveLength(0);
    expect(hostNodes(renderer, props => typeof props.onPress === 'function')).toHaveLength(0);
  });
});
