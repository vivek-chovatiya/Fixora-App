/**
 * The bar replaced a full-bleed panel of brand colour, and most of what these
 * tests pin is what it deliberately no longer does.
 *
 * The panel carried the mark, the wordmark, the heading and the supporting line,
 * which cost roughly a third of a small phone and had to collapse itself while
 * the keyboard was open. The bar keeps continuity — the same mark in the same
 * place across six screens — and hands the words to the page.
 *
 * The centring is the part worth a test. The back control is taken out of the
 * flow so that the mark sits in the middle of the full width; in a row it would
 * be pushed off centre by exactly the width of a touch target, and would move
 * between screens that can go back and screens that cannot.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';

import { AuthTopBar } from '@/features/auth/components/AuthTopBar';
import { AUTH_COPY } from '@/features/auth/constants/authCopy';
import { ThemeProvider, lightTheme } from '@/shared/theme';

/** Flattens every string in the rendered tree so copy can be asserted on. */
function textOf(node: ReactTestRendererJSON | ReactTestRendererJSON[] | null): string {
  if (node === null) {
    return '';
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join(' ');
  }
  return (node.children ?? [])
    .map(child => (typeof child === 'string' ? child : textOf(child as ReactTestRendererJSON)))
    .join(' ');
}

/** Every renderer a test made, unmounted after it (CLAUDE.md section 7). */
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
});

async function render(props: Partial<React.ComponentProps<typeof AuthTopBar>> = {}) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthTopBar testID="bar" {...props} />
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  return {
    renderer,
    text: () => textOf(renderer.toJSON()),
    has: (testID: string) => renderer.root.findAllByProps({ testID }).length > 0,
    /**
     * The host View, not the AuthTopBar element above it. Both carry the testID;
     * only the View carries the resolved style.
     */
    bar: () => {
      const [view] = renderer.root.findAll(
        node => node.props?.testID === 'bar' && node.props.style !== undefined,
      );
      return view;
    },
    style: () => {
      const [view] = renderer.root.findAll(
        node => node.props?.testID === 'bar' && node.props.style !== undefined,
      );
      return Array.isArray(view.props.style)
        ? Object.assign({}, ...view.props.style.flat())
        : view.props.style;
    },
  };
}

describe('AuthTopBar', () => {
  it('carries the mark, and no words at all', async () => {
    const { has, text } = await render();

    expect(has('bar-mark')).toBe(true);

    // The wordmark, the heading and the supporting line all belong to the page
    // now. A bar that reprinted them would be the panel again, in a thinner
    // shape.
    expect(text().trim()).toBe('');
  });

  it('is one touch target tall and nothing more', async () => {
    const { style } = await render();

    // The whole argument for the bar is that it is thin. Anything taller and it
    // starts taking the space the heading below it needs.
    expect(style().height).toBe(lightTheme.hitSlop.minTarget);
  });

  it('paints nothing, so the app status bar still stands', async () => {
    const { style } = await render();

    // The panel had to override StatusBar — dark icons on dark blue are
    // invisible — and every screen using it inherited that override. Sitting on
    // the page background is what gives it back.
    expect(style().backgroundColor).toBeUndefined();
  });

  it('shows a way back only when there is somewhere to go', async () => {
    const withBack = await render({ onBack: jest.fn() });
    expect(withBack.has('bar-back')).toBe(true);

    // Role selection is the first route and has nothing behind it.
    const without = await render();
    expect(without.has('bar-back')).toBe(false);
  });

  it('draws the app’s back control in the flow’s own words, and hands it the press', async () => {
    // Auth kept its own copy of this control until 21/10/2026; it now draws the
    // shared one, and must still say what it said and do what it did.
    const onBack = jest.fn();
    const { renderer } = await render({ onBack });

    // The Pressable: the one node with the role and the handler together.
    const [control] = renderer.root.findAll(
      node =>
        node.props?.testID === 'bar-back' &&
        node.props?.accessibilityRole === 'button' &&
        typeof node.props?.onPress === 'function',
    );
    expect(control.props.accessibilityRole).toBe('button');
    expect(control.props.accessibilityLabel).toBe(AUTH_COPY.common.back);
    expect(control.props.accessibilityHint).toBe(AUTH_COPY.common.backHint);
    expect(onBack).not.toHaveBeenCalled();

    await act(async () => {
      control.props.onPress();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledWith();
  });

  it('keeps the mark centred whether or not it can go back', async () => {
    const withBack = await render({ onBack: jest.fn() });
    const without = await render();

    // Both rows centre their children. The back control is absolutely
    // positioned, so it takes no width in the flow and cannot shove the mark
    // off centre — which is what would make the mark jump as the user moved
    // between screens.
    expect(withBack.style().justifyContent).toBe('center');
    expect(without.style().justifyContent).toBe('center');

    const [positioned] = withBack.renderer.root.findAll(node => {
      if (typeof node.type !== 'string') {
        return false;
      }
      const style = node.props?.style;
      const flat = Array.isArray(style) ? Object.assign({}, ...style.flat()) : style;
      return flat?.position === 'absolute';
    });

    expect(positioned.findAllByProps({ testID: 'bar-back' }).length).toBeGreaterThan(0);
  });
});
