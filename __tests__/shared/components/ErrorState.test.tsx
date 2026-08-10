/**
 * ErrorState carries two rules that matter and cannot be caught by types:
 * it must never leak a developer-facing message to the user, and it must only
 * offer retry when retrying could actually help.
 */

import React from 'react';
import ReactTestRenderer, { type ReactTestRendererJSON } from 'react-test-renderer';

import { ErrorState } from '@/shared/components/ErrorState';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

type Rendered = ReactTestRendererJSON | ReactTestRendererJSON[] | null;

function render(ui: React.ReactElement): Rendered {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<ThemeProvider>{ui}</ThemeProvider>);
  });
  return renderer ? renderer.toJSON() : null;
}

/** Flattens every string in the rendered tree so copy can be asserted on. */
function textOf(node: Rendered): string {
  if (node === null) {
    return '';
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join(' ');
  }
  const children = node.children ?? [];
  return children
    .map(child => (typeof child === 'string' ? child : textOf(child as ReactTestRendererJSON)))
    .join(' ');
}

describe('ErrorState', () => {
  it('renders nothing when there is no error', () => {
    expect(render(<ErrorState error={null} />)).toBeNull();
  });

  it('shows the user-facing message, never the developer message', () => {
    const error = new AppError({
      kind: 'server',
      message: 'Request failed with status code 500 at /v1/requests',
    });

    const text = textOf(render(<ErrorState error={error} />));

    expect(text).toContain(error.userMessage);
    expect(text).not.toContain('status code 500');
  });

  it('offers retry for a retryable failure', () => {
    const error = new AppError({ kind: 'network' });

    const text = textOf(render(<ErrorState error={error} onRetry={jest.fn()} />));

    expect(error.isRetryable).toBe(true);
    expect(text).toContain('Try again');
  });

  it('hides retry for a failure retrying cannot fix', () => {
    const error = new AppError({ kind: 'forbidden' });

    const text = textOf(render(<ErrorState error={error} onRetry={jest.fn()} />));

    expect(error.isRetryable).toBe(false);
    expect(text).not.toContain('Try again');
  });

  it('hides retry when no handler is supplied, even if retryable', () => {
    const error = new AppError({ kind: 'timeout' });

    const text = textOf(render(<ErrorState error={error} />));

    expect(text).not.toContain('Try again');
  });

  it('allows the title to be overridden while keeping the error copy', () => {
    const error = new AppError({ kind: 'notFound' });

    const text = textOf(render(<ErrorState error={error} title="No vendors nearby" />));

    expect(text).toContain('No vendors nearby');
    expect(text).toContain(error.userMessage);
  });
});
