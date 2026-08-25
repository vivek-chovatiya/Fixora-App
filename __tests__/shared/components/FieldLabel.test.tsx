/**
 * FieldLabel exists to stop two controls disagreeing about what "required"
 * looks like, so the tests are about the marker rather than the text.
 *
 * The registration form is where the disagreement showed: ten fields carried an
 * accented asterisk and the eleventh, a row of chips, carried a plain one in the
 * label's own colour. Scanning a column for what still has to be filled in only
 * works if every marker looks the same, so that is what is pinned here.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { FieldLabel } from '@/shared/components/FieldLabel';
import { ThemeProvider } from '@/shared/theme';

async function render(node: React.ReactElement) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await act(async () => {
    renderer = ReactTestRenderer.create(<ThemeProvider>{node}</ThemeProvider>);
  });

  return renderer;
}

/** The accented marker, if the label drew one. */
function marker(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root.findAll(
    node => node.props?.children === ' *' && node.props?.color === 'primary',
  );
}

describe('FieldLabel', () => {
  it('draws no marker unless the control is required', async () => {
    const renderer = await render(<FieldLabel>Email</FieldLabel>);

    expect(marker(renderer)).toHaveLength(0);
  });

  it('inks the marker rather than punctuating with it', async () => {
    const renderer = await render(<FieldLabel required>Business name</FieldLabel>);

    // In the label's own colour the asterisk is just a character at the end of
    // a word. In the accent it is the only thing on the row that is not prose.
    expect(marker(renderer)).toHaveLength(1);
  });

  it('keeps the marker inside the label, so both are announced together', async () => {
    const renderer = await render(<FieldLabel required>Phone number</FieldLabel>);

    const [label] = renderer.root.findAll(
      node => node.props?.variant === 'label' && Array.isArray(node.props?.children),
    );

    // Nested, not a sibling: a screen reader reads "Phone number star" as one
    // label rather than reaching a stray asterisk with nothing attached to it.
    expect(label.props.children).toContain('Phone number');
  });

  it('greys with the control it names', async () => {
    const enabled = await render(<FieldLabel>Business name</FieldLabel>);
    const disabled = await render(<FieldLabel disabled>Business name</FieldLabel>);

    const colourOf = (renderer: ReactTestRenderer.ReactTestRenderer) =>
      renderer.root.findAll(node => node.props?.variant === 'label')[0].props.color;

    expect(colourOf(enabled)).toBe('textPrimary');
    expect(colourOf(disabled)).toBe('textDisabled');
  });
});
