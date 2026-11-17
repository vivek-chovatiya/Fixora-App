/**
 * AppRoot's offline banner wiring (PROJECT_BIBLE.md sections 49 and 57).
 *
 * Three rules a later edit to AppRoot could break without any screen test
 * noticing:
 * - The banner is mounted once, above the navigators and outside their own
 *   SafeAreaProvider. Inside it, or with no provider of their own, every screen
 *   pads a second status-bar gap below the banner.
 * - The banner's measured height reaches `Screen` as the window offset, which
 *   its KeyboardAvoidingView needs; zero while online.
 * - The banner coming and going never remounts the navigators. A remount resets
 *   navigation, so losing the signal would throw the user back to the first
 *   screen and empty whatever form they were filling in.
 *
 * The navigator is a stub that counts its mounts and shows the offset it sees.
 * The real one is RootNavigator.test's business.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { KeyboardAvoidingView } from 'react-native';

import { AppRoot } from '@/app/AppRoot';
import { store } from '@/app/store';
import { Screen, Text, WindowOffsetContext } from '@/shared/components';
import { MockNetworkStatusService } from '@/shared/services/mock/MockNetworkStatusService';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import { ThemeProvider } from '@/shared/theme';

let mockNavigatorMounts = 0;

jest.mock('@/navigation/RootNavigator', () => {
  const ReactActual = jest.requireActual('react');
  const { Text: NativeText } = jest.requireActual('react-native');

  function RootNavigator() {
    const offset = require('@/shared/components').useWindowOffset();

    ReactActual.useEffect(() => {
      mockNavigatorMounts += 1;
    }, []);

    return <NativeText testID="navigator">{`offset:${offset}`}</NativeText>;
  }

  return { RootNavigator };
});

/** Known insets, so the providers render their children under test. */
const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  mockNavigatorMounts = 0;
  // The session restore logs what it found; that is not what is under test.
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(async () => {
  while (mounted.length > 0) {
    const renderer = mounted.pop()!;
    await act(async () => {
      renderer.unmount();
    });
  }
  resetServices();
  jest.restoreAllMocks();
});

async function renderApp(network: MockNetworkStatusService) {
  registerService('networkStatus', network);

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <SafeAreaProvider initialMetrics={METRICS}>
          <ThemeProvider>
            <AppRoot />
          </ThemeProvider>
        </SafeAreaProvider>
      </Provider>,
    );
  });
  mounted.push(renderer);

  return renderer;
}

function hostByTestID(root: ReactTestRenderer.ReactTestInstance, testID: string) {
  return root.findAll(node => typeof node.type === 'string' && node.props.testID === testID);
}

function navigatorText(renderer: ReactTestRenderer.ReactTestRenderer): string {
  const [navigator] = hostByTestID(renderer.root, 'navigator');
  return String(navigator.props.children);
}

/** The view AppRoot measures: the nearest host ancestor of the banner with onLayout. */
function bannerWrapper(renderer: ReactTestRenderer.ReactTestRenderer) {
  let node = hostByTestID(renderer.root, 'offline-banner')[0].parent;
  while (node && !(typeof node.type === 'string' && typeof node.props.onLayout === 'function')) {
    node = node.parent;
  }
  return node!;
}

describe('AppRoot — the offline banner', () => {
  it('shows no banner and no offset while online', async () => {
    const renderer = await renderApp(new MockNetworkStatusService());

    expect(hostByTestID(renderer.root, 'offline-banner')).toHaveLength(0);
    expect(navigatorText(renderer)).toBe('offset:0');
  });

  it('mounts one banner, outside the navigators’ own safe-area provider', async () => {
    const renderer = await renderApp(new MockNetworkStatusService({ isOffline: true }));

    expect(hostByTestID(renderer.root, 'offline-banner')).toHaveLength(1);

    // The test's provider, and AppRoot's own around the navigators.
    const providers = renderer.root.findAllByType(SafeAreaProvider);
    expect(providers).toHaveLength(2);
    const navigatorsProvider = providers[1];
    expect(hostByTestID(navigatorsProvider, 'navigator')).toHaveLength(1);
    expect(hostByTestID(navigatorsProvider, 'offline-banner')).toHaveLength(0);
  });

  it('hands the banner’s measured height down as the window offset', async () => {
    const renderer = await renderApp(new MockNetworkStatusService({ isOffline: true }));

    await act(async () => {
      bannerWrapper(renderer).props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 72 } },
      });
    });

    expect(navigatorText(renderer)).toBe('offset:72');
  });

  it('never remounts the navigators as the connection comes and goes', async () => {
    const network = new MockNetworkStatusService();
    await renderApp(network);
    expect(mockNavigatorMounts).toBe(1);

    await act(async () => {
      network.setOffline(true);
    });
    await act(async () => {
      network.setOffline(false);
    });

    expect(mockNavigatorMounts).toBe(1);
  });
});

describe('Screen — keyboard avoidance under the banner', () => {
  async function renderScreen(offset?: number) {
    const content = (
      <Screen keyboardAvoiding>
        <Text>Form</Text>
      </Screen>
    );

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          {offset === undefined ? (
            content
          ) : (
            <WindowOffsetContext.Provider value={offset}>{content}</WindowOffsetContext.Provider>
          )}
        </ThemeProvider>,
      );
    });
    mounted.push(renderer);

    return renderer.root.findByType(KeyboardAvoidingView);
  }

  it('offsets by nothing when nothing sits above the navigators', async () => {
    const avoiding = await renderScreen();

    expect(avoiding.props.keyboardVerticalOffset).toBe(0);
  });

  it('offsets by exactly the window offset AppRoot provides', async () => {
    const avoiding = await renderScreen(72);

    expect(avoiding.props.keyboardVerticalOffset).toBe(72);
  });
});
