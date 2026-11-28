/**
 * CopyButton copies one value and says so for a moment (T135, 28/11/2026). What
 * is pinned here is the rule, not the drawing:
 *
 * - exactly the value it was given reaches the clipboard, through the
 *   `core/clipboard` seam and nothing else — the stub records the argument;
 * - a screen reader hears what is copied ("Copy reference REQ-…"), as a button;
 * - "Copied" appears once the copy lands, announced, with the glyph changing
 *   shape too, and is gone again after `duration.copiedHold` — not before, and
 *   a second press restarts the wait rather than being cut short by the first;
 * - a failure says so in a toast and never claims "Copied";
 * - nothing fires into a button that has gone.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';

import { getClipboard, setClipboard, type Clipboard } from '@/core/clipboard/Clipboard';
import { CopyButton, ToastProvider } from '@/shared/components';
import { ThemeProvider, duration } from '@/shared/theme';

const VALUE = 'REQ-0031002405';
const LABEL = `Copy reference ${VALUE}`;
const HINT = 'Copies the reference to the clipboard';
const COPIED = 'Copied';
const FAILED = 'We could not copy it. You can write it down instead.';

const original: Clipboard = getClipboard();
const copy = jest.fn<Promise<void>, [string]>(async () => undefined);

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  jest.useFakeTimers();
  copy.mockReset();
  copy.mockImplementation(async () => undefined);
  setClipboard({ copy });
});

afterEach(() => {
  // Unmounted so the hold timer and a toast's dwell never outlive the test.
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  jest.useRealTimers();
});

afterAll(() => {
  setClipboard(original);
});

function textOf(node: ReactTestRendererJSON | ReactTestRendererJSON[] | null): string {
  if (!node) {
    return '';
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join(' ');
  }
  return (node.children ?? [])
    .map(child => (typeof child === 'string' ? child : textOf(child)))
    .join(' ');
}

function render() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <ToastProvider>
          <CopyButton
            value={VALUE}
            accessibilityLabel={LABEL}
            accessibilityHint={HINT}
            copiedLabel={COPIED}
            failedMessage={FAILED}
            testID="reference-copy"
          />
        </ToastProvider>
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  /** The pressable itself, not the host view under it (both carry the role). */
  const button = () =>
    renderer.root.find(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.testID === 'reference-copy' &&
        typeof node.props?.onPress === 'function',
    );

  const copiedNodes = () =>
    renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.testID === 'reference-copy-copied',
    );

  /** The glyph the button draws, by its theme name. */
  const glyph = (): string | undefined =>
    button().findAll(node => typeof node.props?.name === 'string')[0]?.props.name;

  const press = async () => {
    await act(async () => {
      button().props.onPress();
    });
  };

  const advance = (ms: number) => {
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  };

  return {
    renderer,
    button,
    copiedNodes,
    glyph,
    press,
    advance,
    text: () => textOf(renderer.toJSON()),
  };
}

describe('CopyButton — what it copies', () => {
  it('puts exactly the value it was given on the clipboard, once per press', async () => {
    const { press } = render();

    await press();

    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledWith(VALUE);
  });

  it('copies nothing until it is pressed', () => {
    render();

    expect(copy).not.toHaveBeenCalled();
  });
});

describe('CopyButton — what a screen reader hears', () => {
  it('is a button named for what it copies, with a hint', () => {
    const { button } = render();

    expect(button().props.accessibilityRole).toBe('button');
    expect(button().props.accessibilityLabel).toBe(LABEL);
    expect(button().props.accessibilityHint).toBe(HINT);
  });

  it('keeps its name while it says "Copied", so the control does not seem to change', async () => {
    const { button, press } = render();

    await press();

    expect(button().props.accessibilityLabel).toBe(LABEL);
  });
});

describe('CopyButton — the confirmation', () => {
  it('says nothing at rest', () => {
    const { copiedNodes, glyph, text } = render();

    expect(copiedNodes()).toHaveLength(0);
    expect(text()).not.toContain(COPIED);
    expect(glyph()).toBe('copy');
  });

  it('shows and announces "Copied" once the copy lands, and changes its glyph — not colour alone', async () => {
    const { copiedNodes, glyph, text, press } = render();

    await press();

    expect(text()).toContain(COPIED);
    expect(copiedNodes()[0].props.accessibilityLiveRegion).toBe('polite');
    expect(glyph()).toBe('selected');
  });

  it('goes back to rest after the hold, and not a moment before', async () => {
    const { copiedNodes, glyph, press, advance } = render();

    await press();
    advance(duration.copiedHold - 1);
    expect(copiedNodes()).toHaveLength(1);

    advance(1);
    expect(copiedNodes()).toHaveLength(0);
    expect(glyph()).toBe('copy');
  });

  it('restarts the hold on a second press rather than being cut short by the first', async () => {
    const { copiedNodes, press, advance } = render();

    await press();
    advance(duration.copiedHold - 500);
    await press();
    // Past the first press's hold: the second one is still holding.
    advance(600);
    expect(copiedNodes()).toHaveLength(1);

    advance(duration.copiedHold);
    expect(copiedNodes()).toHaveLength(0);
    expect(copy).toHaveBeenCalledTimes(2);
  });

  it('is about two seconds, as asked', () => {
    expect(duration.copiedHold).toBe(2000);
  });
});

describe('CopyButton — when copying fails', () => {
  beforeEach(() => {
    copy.mockImplementation(async () => {
      throw new Error('clipboard unavailable');
    });
  });

  it('says so in a toast, and never claims it was copied', async () => {
    const { copiedNodes, glyph, text, press } = render();

    await press();

    expect(text()).toContain(FAILED);
    expect(copiedNodes()).toHaveLength(0);
    expect(glyph()).toBe('copy');
  });

  it('can be pressed again, and a later copy that lands is confirmed as usual', async () => {
    const { copiedNodes, press } = render();

    await press();
    copy.mockImplementation(async () => undefined);
    await press();

    expect(copy).toHaveBeenCalledTimes(2);
    expect(copiedNodes()).toHaveLength(1);
  });
});

describe('CopyButton — after it has gone', () => {
  it('sets nothing when a copy answers after the button was unmounted', async () => {
    let finish!: () => void;
    copy.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const timers = jest.spyOn(globalThis, 'setTimeout');
    const { renderer, press } = render();

    await press();
    act(() => {
      renderer.unmount();
    });
    mounted.splice(mounted.indexOf(renderer), 1);
    await act(async () => {
      finish();
    });

    // No hold timer was started for a button that is not there. Told apart by
    // its delay: Reanimated's frames run on fake timers too.
    expect(timers.mock.calls.filter(call => call[1] === duration.copiedHold)).toHaveLength(0);
    expect(errors).not.toHaveBeenCalled();
    timers.mockRestore();
    errors.mockRestore();
  });
});
