/**
 * The heading is what gives an auth screen a top now that the band of brand
 * colour has gone.
 *
 * That is the whole reason it is set at `hero` rather than `display`: `display`
 * is the size the wordmark is set at on the splash, so a page heading at that
 * size read as a second wordmark, and the screens looked like the old ones with
 * the colour taken off. These tests pin the size, the announcement, and the fact
 * that the supporting line is genuinely optional — two of the six screens name
 * their destination in the form below instead.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { AuthHeading } from '@/features/auth/components/AuthHeading';
import { ThemeProvider, lightTheme } from '@/shared/theme';

const TITLE = 'Verify your number';
const SUBTITLE = 'Enter your phone number.';

async function render(props: Partial<React.ComponentProps<typeof AuthHeading>> = {}) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthHeading title={TITLE} testID="heading" {...props} />
      </ThemeProvider>,
    );
  });

  /**
   * The rendered host text nodes, in document order.
   *
   * Keyed on the resolved style rather than on the host name: Text flattens its
   * variant into a plain object, so anything carrying a `fontSize` is type and
   * nothing else is.
   */
  const texts = () =>
    renderer.root.findAll(
      node => typeof node.type === 'string' && node.props?.style?.fontSize !== undefined,
    );

  return { renderer, texts };
}

describe('AuthHeading', () => {
  it('sets the title at the top of the scale', async () => {
    const { texts } = await render();

    const style = texts()[0].props.style;

    // `hero`, not `display`. The two are four points apart and one of them is
    // already spoken for by the brand wordmark.
    expect(style.fontSize).toBe(lightTheme.typography.fontSize.hero);
    expect(style.fontWeight).toBe(lightTheme.typography.fontWeight.bold);
  });

  it('announces the title as a heading', async () => {
    const { renderer } = await render();

    const [header] = renderer.root.findAll(
      node => node.props?.accessibilityRole === 'header',
    );

    expect(header.props.children).toBe(TITLE);
  });

  it('sets the supporting line above body size', async () => {
    const { texts } = await render({ subtitle: SUBTITLE });

    const style = texts()[1].props.style;

    // `body` is 14 and reads as small print under a 34px heading, which is why
    // `subtitle` was added rather than reused from it.
    expect(style.fontSize).toBe(lightTheme.typography.fontSize.lg);
    expect(style.color).toBe(lightTheme.colors.textSecondary);
  });

  it('renders without a supporting line', async () => {
    // Both verification screens leave it off: the masked destination is a value
    // the form owns and a successful resend replaces, so it cannot live in a
    // heading rendered above it.
    const { texts } = await render();

    expect(texts()).toHaveLength(1);
  });
});
