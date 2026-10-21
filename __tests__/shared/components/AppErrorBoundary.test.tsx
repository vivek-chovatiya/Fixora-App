/**
 * AppErrorBoundary is the app's answer to a screen that fails to render
 * (PROJECT_BIBLE.md section 57). The rules it is held to:
 *
 * - nothing changes while nothing fails — it renders its children as they are;
 * - a failure is recorded exactly once, as a non-fatal render failure, and the
 *   very error is what is recorded;
 * - the fallback never shows the error's message (section 49), says what to do,
 *   announces its title as a heading and names its one button;
 * - Try again renders the children again, and a failure that comes back is
 *   recorded again;
 * - with no crash reporter registered it still shows the fallback, rather than
 *   failing a second time.
 */

import React from 'react';
import { Text as RNText } from 'react-native';
import ReactTestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRendererJSON,
} from 'react-test-renderer';

import {
  APP_ERROR_FALLBACK_COPY,
  AppErrorBoundary,
} from '@/shared/components/AppErrorBoundary';
import { ERROR_PRESENTATION } from '@/shared/components/errorPresentation';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import { ThemeProvider } from '@/shared/theme';

const RAW_MESSAGE = "Cannot read property 'street' of undefined in RequestCard";
const TITLE = ERROR_PRESENTATION.unknown.title;

let shouldThrow = true;

function Fragile() {
  if (shouldThrow) {
    throw new Error(RAW_MESSAGE);
  }
  return <RNText>Your requests</RNText>;
}

let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

function mount() {
  act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AppErrorBoundary>
          <Fragile />
        </AppErrorBoundary>
      </ThemeProvider>,
    );
  });
  if (!renderer) {
    throw new Error('Renderer was not created');
  }
  return renderer;
}

type Rendered = ReactTestRendererJSON | ReactTestRendererJSON[] | null;

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

/** The pressable controls, once each — the composite and its host both carry the role. */
function buttonsIn(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    node => node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function',
  );
}

function hostHeadersIn(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    node => typeof node.type === 'string' && node.props?.accessibilityRole === 'header',
  );
}

function stubCrashReporter() {
  return { recordError: jest.fn(), setUser: jest.fn() };
}

beforeEach(() => {
  shouldThrow = true;
  // React reports an error a boundary caught; that report is not this test's
  // subject, and it would bury the output.
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = undefined;
  resetServices();
  jest.restoreAllMocks();
});

describe('AppErrorBoundary', () => {
  it('renders its children untouched while nothing fails', () => {
    shouldThrow = false;
    const crashReporter = stubCrashReporter();
    registerService('crashReporter', crashReporter);

    const tree = mount();

    expect(textOf(tree.toJSON())).toContain('Your requests');
    expect(tree.root.findAll(node => node.props?.testID === 'app-error-fallback')).toHaveLength(0);
    expect(crashReporter.recordError).not.toHaveBeenCalled();
  });

  it('records a render failure once, as not fatal, with the very error', () => {
    const crashReporter = stubCrashReporter();
    registerService('crashReporter', crashReporter);

    mount();

    expect(crashReporter.recordError).toHaveBeenCalledTimes(1);
    const [recorded, context] = crashReporter.recordError.mock.calls[0];
    expect(recorded).toBeInstanceOf(Error);
    expect((recorded as Error).message).toBe(RAW_MESSAGE);
    expect(context).toEqual({ fatal: false, source: 'render' });
  });

  it('shows the fallback, and never the error message', () => {
    registerService('crashReporter', stubCrashReporter());

    const tree = mount();
    const text = textOf(tree.toJSON());

    expect(text).toContain(TITLE);
    expect(text).toContain(APP_ERROR_FALLBACK_COPY.message);
    expect(text).toContain(APP_ERROR_FALLBACK_COPY.retry);
    expect(text).not.toContain('Your requests');
    expect(JSON.stringify(tree.toJSON())).not.toContain(RAW_MESSAGE);
    expect(JSON.stringify(tree.toJSON())).not.toContain('street');
  });

  it('announces its title as a heading and names its one button', () => {
    registerService('crashReporter', stubCrashReporter());

    const tree = mount();

    const headers = hostHeadersIn(tree.root);
    expect(headers).toHaveLength(1);
    expect(headers[0].props.children).toBe(TITLE);

    const buttons = buttonsIn(tree.root);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.accessibilityLabel).toBe(APP_ERROR_FALLBACK_COPY.retry);
  });

  it('renders the children again on Try again', () => {
    const crashReporter = stubCrashReporter();
    registerService('crashReporter', crashReporter);
    const tree = mount();

    shouldThrow = false;
    act(() => {
      buttonsIn(tree.root)[0].props.onPress();
    });

    expect(textOf(tree.toJSON())).toContain('Your requests');
    expect(tree.root.findAll(node => node.props?.testID === 'app-error-fallback')).toHaveLength(0);
    expect(crashReporter.recordError).toHaveBeenCalledTimes(1);
  });

  it('comes back, and records again, when the failure does', () => {
    const crashReporter = stubCrashReporter();
    registerService('crashReporter', crashReporter);
    const tree = mount();

    act(() => {
      buttonsIn(tree.root)[0].props.onPress();
    });

    expect(textOf(tree.toJSON())).toContain(TITLE);
    expect(crashReporter.recordError).toHaveBeenCalledTimes(2);
  });

  it('still shows the fallback with no crash reporter registered', () => {
    resetServices();

    const tree = mount();

    expect(textOf(tree.toJSON())).toContain(TITLE);
    expect(buttonsIn(tree.root)).toHaveLength(1);
  });
});
