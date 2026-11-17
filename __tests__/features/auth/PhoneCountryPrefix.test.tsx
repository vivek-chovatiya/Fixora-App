/**
 * The dialling code beside the phone field is the smallest piece of this screen
 * and the one most likely to be misread as a feature.
 *
 * It shows which country the app serves. It does not choose one — that is
 * multi-country, which PROJECT_BIBLE.md lists as a future phase and says not to
 * implement prematurely. And it does not join the number: `normalisePhone`
 * sends the digits the user typed and nothing else, so the code reaching the
 * backend is exactly what it was before this appeared.
 *
 * These tests pin both of those, because both are the kind of thing that gets
 * "helpfully" wired up later by someone who assumes it was meant to be.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';

import { AppConfig } from '@/core/config/AppConfig';
import { PhoneCountryPrefix } from '@/features/auth/components/PhoneCountryPrefix';
import { ThemeProvider } from '@/shared/theme';
import { normalisePhone } from '@/shared/validation/phone';

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

async function render() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <PhoneCountryPrefix testID="dial-code" />
      </ThemeProvider>,
    );
  });

  return { renderer, text: () => textOf(renderer.toJSON()) };
}

describe('PhoneCountryPrefix', () => {
  it('shows the configured dialling code', async () => {
    const { text } = await render();

    // From config, not written into the component: when multi-country arrives
    // this becomes a default rather than a constant, and only one file moves.
    expect(text()).toContain(AppConfig.phone.dialCode);
  });

  it('is not a control, and does not pretend to be one', async () => {
    const { renderer } = await render();

    // No press handler anywhere in the subtree. A chevron and a tap target here
    // would promise a country picker that does not exist.
    const pressable = renderer.root.findAll(
      node => typeof node.props?.onPress === 'function',
    );

    expect(pressable).toHaveLength(0);
  });

  it('hides the flag from assistive technology', async () => {
    const { renderer } = await render();

    const [flag] = renderer.root.findAll(
      node => node.props?.accessibilityElementsHidden === true,
    );

    // The code beside it is the information. "Flag" is not.
    expect(flag).toBeDefined();
  });
});

describe('PhoneCountryPrefix — it does not change what is sent', () => {
  it('is not part of the value the backend receives', async () => {
    // The component renders the code; the number is normalised from the field
    // alone. Nothing joins the two, so a ten-digit entry still leaves the app
    // as ten digits.
    expect(normalisePhone('9876543210')).toBe('9876543210');

    // And if the code ever were prepended, this is what would change.
    expect(normalisePhone('9876543210')).not.toContain(
      AppConfig.phone.dialCode.replace('+', ''),
    );
  });
});
