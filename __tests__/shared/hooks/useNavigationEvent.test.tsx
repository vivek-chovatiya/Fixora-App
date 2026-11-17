/**
 * useNavigationEvent: one place for "do this when the screen comes back, or is
 * left", in place of three hand-written copies.
 *
 * Pinned here, because each was a reason the copies existed:
 *
 * - with no navigator at all it renders, listens to nothing and never calls —
 *   screen suites render screens alone, and `useFocusEffect` throws there
 * - with one, the callback runs on each event, and `onlyOnReturn` lets a focus
 *   through only after the screen was out of focus: arrival stays one read
 * - a screen that mounted out of focus counts its first focus as a return
 * - the listeners go with the component, and the newest callback is the one
 *   called without the listener being put back
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NavigationContext } from '@react-navigation/native';

import {
  useNavigationEvent,
  type NavigationEventOptions,
} from '@/shared/hooks/useNavigationEvent';

type Event = 'focus' | 'blur';

/**
 * Just enough of a screen's navigation object: whether it is focused, and
 * listeners the test fires as a stack would when a screen is pushed over this
 * one (blur) and popped again (focus).
 */
function fakeNavigation({ focused: initially = true }: { focused?: boolean } = {}) {
  const listeners: Record<Event, Array<() => void>> = { focus: [], blur: [] };
  let focused = initially;

  const addListener = jest.fn((event: Event, listener: () => void) => {
    listeners[event] = [...listeners[event], listener];
    return () => {
      listeners[event] = listeners[event].filter(entry => entry !== listener);
    };
  });

  return {
    context: { isFocused: () => focused, addListener },
    addListener,
    listening: () => listeners.focus.length + listeners.blur.length,
    blur: () => {
      focused = false;
      listeners.blur.forEach(listener => listener());
    },
    focus: () => {
      focused = true;
      listeners.focus.forEach(listener => listener());
    },
  };
}

function Probe({
  event,
  listener,
  options,
}: {
  event: Event;
  listener: () => void;
  options?: NavigationEventOptions;
}) {
  useNavigationEvent(event, listener, options);
  return null;
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  // Unmounted even when an assertion failed part-way (CLAUDE.md section 7).
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
});

function mount(probe: React.ReactElement, navigation?: ReturnType<typeof fakeNavigation>) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const tree = navigation ? (
    <NavigationContext.Provider value={navigation.context as never}>{probe}</NavigationContext.Provider>
  ) : (
    probe
  );
  act(() => {
    renderer = ReactTestRenderer.create(tree);
  });
  mounted.push(renderer);
  return renderer;
}

describe('useNavigationEvent — with no navigator', () => {
  it.each<Event>(['focus', 'blur'])('renders, and never calls back for %s', event => {
    const listener = jest.fn();

    expect(() =>
      mount(<Probe event={event} listener={listener} options={{ onlyOnReturn: true }} />),
    ).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('useNavigationEvent — with a navigator', () => {
  it('calls back on every blur', () => {
    const navigation = fakeNavigation();
    const listener = jest.fn();
    mount(<Probe event="blur" listener={listener} />, navigation);

    act(() => navigation.blur());
    act(() => navigation.focus());
    act(() => navigation.blur());

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('calls back on every focus, arrival included, when not told otherwise', () => {
    const navigation = fakeNavigation();
    const listener = jest.fn();
    mount(<Probe event="focus" listener={listener} />, navigation);

    act(() => navigation.focus());
    act(() => navigation.blur());
    act(() => navigation.focus());

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('with onlyOnReturn, ignores the focus that marks arrival and counts each return', () => {
    const navigation = fakeNavigation();
    const listener = jest.fn();
    mount(<Probe event="focus" listener={listener} options={{ onlyOnReturn: true }} />, navigation);

    // The focus a navigator can send as an already-focused screen mounts.
    act(() => navigation.focus());
    expect(listener).not.toHaveBeenCalled();

    act(() => navigation.blur());
    act(() => navigation.focus());
    expect(listener).toHaveBeenCalledTimes(1);

    // A second focus with no blur between is not a second return.
    act(() => navigation.focus());
    expect(listener).toHaveBeenCalledTimes(1);

    act(() => navigation.blur());
    act(() => navigation.focus());
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('with onlyOnReturn, counts the first focus of a screen that mounted out of focus', () => {
    const navigation = fakeNavigation({ focused: false });
    const listener = jest.fn();
    mount(<Probe event="focus" listener={listener} options={{ onlyOnReturn: true }} />, navigation);

    act(() => navigation.focus());

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores onlyOnReturn for blur, which has no arrival to skip', () => {
    const navigation = fakeNavigation();
    const listener = jest.fn();
    mount(<Probe event="blur" listener={listener} options={{ onlyOnReturn: true }} />, navigation);

    act(() => navigation.blur());

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it.each<[Event, NavigationEventOptions]>([
    ['blur', {}],
    ['focus', {}],
    ['focus', { onlyOnReturn: true }],
  ])('stops listening for %s %p once the component has gone', (event, options) => {
    const navigation = fakeNavigation();
    const listener = jest.fn();
    const renderer = mount(<Probe event={event} listener={listener} options={options} />, navigation);
    expect(navigation.listening()).toBeGreaterThan(0);

    act(() => {
      renderer.unmount();
    });
    mounted.splice(mounted.indexOf(renderer), 1);

    expect(navigation.listening()).toBe(0);
    act(() => navigation.blur());
    act(() => navigation.focus());
    expect(listener).not.toHaveBeenCalled();
  });

  it('calls the newest callback, without putting the listener back', () => {
    const navigation = fakeNavigation();
    const first = jest.fn();
    const second = jest.fn();
    const renderer = mount(<Probe event="blur" listener={first} />, navigation);
    const added = navigation.addListener.mock.calls.length;

    act(() => {
      renderer.update(
        <NavigationContext.Provider value={navigation.context as never}>
          <Probe event="blur" listener={second} />
        </NavigationContext.Provider>,
      );
    });
    act(() => navigation.blur());

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(navigation.addListener.mock.calls.length).toBe(added);
  });
});
