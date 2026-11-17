/**
 * StaleNotice is what a screen reader hears when a pull fails, so the rule worth
 * pinning is the spoken text: every part said once, as its own sentence, and
 * never the developer's message.
 *
 * Seen on device (3E-6): the parts used to be joined with ". ", which doubled
 * the full stop a message already ends with — "…may be out of date.. No
 * internet connection" — and a reader paused on the stray dot. Asserted here as
 * the whole sentence rather than only "no `..`", so a lost space or a dropped
 * part fails too.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { StaleNotice } from '@/shared/components';
import { spokenSentences } from '@/shared/components/StaleNotice';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const TITLE = 'Could not refresh';
const MESSAGE = 'These requests may be out of date.';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
});

function render(error: AppError | null, onRetry: () => void = jest.fn()) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <StaleNotice
          title={TITLE}
          message={MESSAGE}
          error={error}
          retryLabel="Try again"
          retryHint="Loads your requests again"
          onRetry={onRetry}
          isRetrying={false}
          testID="stale"
        />
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  const [spoken] = renderer.root.findAll(
    node => typeof node.type === 'string' && node.props?.accessibilityRole === 'alert',
  );

  return { renderer, spoken };
}

describe('StaleNotice — what a screen reader hears', () => {
  it('says each part once, as its own sentence', () => {
    const error = new AppError({ kind: 'network', message: 'ECONNREFUSED 10.0.2.2:8080' });

    const { spoken } = render(error);

    expect(spoken.props.accessibilityLabel).toBe(
      'Could not refresh. These requests may be out of date. ' +
        'No internet connection. Check your network and try again.',
    );
    expect(spoken.props.accessibilityLabel).not.toMatch(/\.\./);
    expect(spoken.props.accessibilityLabel).not.toContain('ECONNREFUSED');
  });

  it('still reads as sentences when there is no reason to give', () => {
    const { spoken } = render(null);

    expect(spoken.props.accessibilityLabel).toBe(
      'Could not refresh. These requests may be out of date.',
    );
  });

  it('is announced when it appears, as one stop', () => {
    const { spoken } = render(null);

    expect(spoken.props.accessible).toBe(true);
    expect(spoken.props.accessibilityLiveRegion).toBe('polite');
  });

  it('keeps the visible wording as it was', () => {
    const error = new AppError({ kind: 'timeout' });

    const { renderer } = render(error);
    const strings = renderer.root
      .findAll(node => typeof node.type === 'string' && typeof node.props?.children === 'string')
      .map(node => node.props.children as string);

    expect(strings).toContain(TITLE);
    expect(strings).toContain(`${MESSAGE} ${error.userMessage}`);
  });

  it('offers its retry, which does what it was given', () => {
    const onRetry = jest.fn();
    const { renderer } = render(null, onRetry);

    const [retry] = renderer.root.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === 'Try again' &&
        typeof node.props?.onPress === 'function',
    );
    act(() => {
      retry.props.onPress();
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('spokenSentences', () => {
  it('closes a part with a full stop only when it does not already end a sentence', () => {
    expect(spokenSentences(['Could not refresh', 'Out of date.', 'Try again?', 'Wait…'])).toBe(
      'Could not refresh. Out of date. Try again? Wait…',
    );
  });

  it('drops parts that are missing or blank, and the space around a part', () => {
    expect(spokenSentences(['  Could not refresh ', undefined, null, '   ', 'Out of date.'])).toBe(
      'Could not refresh. Out of date.',
    );
  });

  it('says nothing at all for nothing', () => {
    expect(spokenSentences([])).toBe('');
  });
});
