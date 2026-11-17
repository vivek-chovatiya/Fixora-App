/**
 * useStaleState: one rule for a read that failed with something on screen —
 * keep it and say it may be out of date — and nothing on screen is the error
 * state. Seven list hooks share it.
 *
 * The half worth pinning hardest is the one that used to be wrong. The shared
 * query clears its error the moment a refresh starts, so the notice vanished as
 * soon as its Try again was pressed — the button's spinner was never seen — and
 * a second failure drew it again from nothing, announced as if new. Pinned here
 * through the real query and the real notice:
 *
 * - pressing Try again keeps the notice, with its button busy
 * - a read that answers takes it away
 * - a read that fails again leaves the very same notice saying the very same
 *   thing — nothing for a screen reader to be told twice — and a failure for a
 *   different reason changes what it says
 * - a pull is held the same way: it is the same refresh
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { StaleNotice } from '@/shared/components';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { splitStale, useStaleState, type StaleInput } from '@/shared/hooks/useStaleState';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

type Instance = ReactTestRenderer.ReactTestInstance;

const offline = () => new AppError({ kind: 'network', message: 'ECONNREFUSED 10.0.2.2:8080' });
const down = () => new AppError({ kind: 'server', message: 'HTTP 503 from upstream' });

describe('splitStale — the rule', () => {
  const failure = offline();
  const held = down();

  const cases: Array<[string, StaleInput, AppError | null, ReturnType<typeof splitStale>]> = [
    [
      'nothing on screen and a failure: the error state, no notice',
      { hasData: false, error: failure, isRefreshing: false },
      null,
      { error: failure, isStale: false, staleError: null },
    ],
    [
      'nothing on screen and nothing wrong',
      { hasData: false, error: null, isRefreshing: false },
      null,
      { error: null, isStale: false, staleError: null },
    ],
    [
      'nothing on screen while reading: never a held failure',
      { hasData: false, error: null, isRefreshing: true },
      held,
      { error: null, isStale: false, staleError: null },
    ],
    [
      'something on screen and a failure: stale, never also an error',
      { hasData: true, error: failure, isRefreshing: false },
      null,
      { error: null, isStale: true, staleError: failure },
    ],
    [
      'something on screen and nothing wrong',
      { hasData: true, error: null, isRefreshing: false },
      null,
      { error: null, isStale: false, staleError: null },
    ],
    [
      'something on screen, a failure held, and a refresh in the air: still stale',
      { hasData: true, error: null, isRefreshing: true },
      held,
      { error: null, isStale: true, staleError: held },
    ],
    [
      'something on screen, a failure held, and the refresh answered: fresh',
      { hasData: true, error: null, isRefreshing: false },
      held,
      { error: null, isStale: false, staleError: null },
    ],
    [
      'something on screen, a refresh in the air and nothing held: not stale',
      { hasData: true, error: null, isRefreshing: true },
      null,
      { error: null, isStale: false, staleError: null },
    ],
    [
      'a newer failure replaces the held one',
      { hasData: true, error: failure, isRefreshing: false },
      held,
      { error: null, isStale: true, staleError: failure },
    ],
  ];

  it.each(cases)('%s', (_name, input, previous, expected) => {
    expect(splitStale(input, previous)).toEqual(expected);
  });
});

/** A list screen at its smallest: the real query, the rule, and the real notice. */
let latest: ReturnType<typeof useStaleState> & { refresh: () => void; isRefreshing: boolean };

function Probe({ fetcher }: { fetcher: () => Promise<string> }) {
  const query = useServiceQuery(fetcher, []);
  const stale = useStaleState({
    hasData: query.data !== undefined,
    error: query.error,
    isRefreshing: query.isRefreshing,
  });
  latest = { ...stale, refresh: query.refresh, isRefreshing: query.isRefreshing };

  return stale.isStale ? (
    <StaleNotice
      title="Could not refresh"
      message="This list may be out of date."
      error={stale.staleError}
      retryLabel="Try again"
      retryHint="Loads the list again"
      onRetry={query.refresh}
      isRetrying={query.isRefreshing}
      testID="stale"
    />
  ) : null;
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  // Unmounted even when an assertion failed part-way (CLAUDE.md section 7).
  for (const renderer of mounted.splice(0)) {
    await act(async () => {
      renderer.unmount();
    });
  }
});

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {});
  }
}

/** Each call to the service, held until the test says how it ends. */
function heldCalls() {
  const calls: Array<{ land: (value: string) => void; fail: (error: unknown) => void }> = [];
  const fetcher = jest.fn(
    () =>
      new Promise<string>((land, fail) => {
        calls.push({ land, fail });
      }),
  );
  return { fetcher, calls };
}

async function mount(fetcher: () => Promise<string>) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <Probe fetcher={fetcher} />
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  const notice = (): Instance | undefined =>
    renderer.root.findAll(node => typeof node.type === 'string' && node.props?.testID === 'stale')[0];
  const spoken = (): Instance | undefined =>
    notice()?.findAll(
      node => typeof node.type === 'string' && node.props?.accessibilityRole === 'alert',
    )[0];
  const tryAgain = (): Instance =>
    notice()!.findAll(
      node => node.props?.accessibilityLabel === 'Try again' && typeof node.props?.onPress === 'function',
    )[0];

  return { renderer, notice, spoken, tryAgain };
}

/** Mounted with a list on screen and a failed pull: the notice is up. */
async function staleList() {
  const { fetcher, calls } = heldCalls();
  const view = await mount(fetcher);

  await act(async () => calls[0].land('the list'));
  await act(async () => latest.refresh());
  await act(async () => calls[1].fail(offline()));
  await flush();
  expect(view.notice()).toBeDefined();

  return { ...view, fetcher, calls };
}

describe('useStaleState — the notice while it is answered', () => {
  it('stays up with its button busy while Try again reads, then goes when the read answers', async () => {
    const view = await staleList();
    const before = view.spoken();
    expect(view.tryAgain().props.accessibilityState).toMatchObject({ busy: false });

    await act(async () => {
      view.tryAgain().props.onPress();
    });

    expect(view.fetcher).toHaveBeenCalledTimes(3);
    expect(latest.isRefreshing).toBe(true);
    expect(view.notice()).toBeDefined();
    expect(view.spoken()).toBe(before);
    expect(view.tryAgain().props.accessibilityState).toMatchObject({ busy: true });

    await act(async () => view.calls[2].land('the list, again'));
    await flush();

    expect(view.notice()).toBeUndefined();
    expect(latest).toMatchObject({ isStale: false, staleError: null, error: null });
  });

  it('is the very same notice, saying the same thing, when the retry fails the same way', async () => {
    const view = await staleList();
    const before = view.spoken()!;
    const said = before.props.accessibilityLabel;

    await act(async () => {
      view.tryAgain().props.onPress();
    });
    await act(async () => view.calls[2].fail(offline()));
    await flush();

    // Never taken down and put back: the same node, its words unchanged, so a
    // screen reader has nothing new to announce.
    expect(view.spoken()).toBe(before);
    expect(view.spoken()!.props.accessibilityLabel).toBe(said);
    expect(view.tryAgain().props.accessibilityState).toMatchObject({ busy: false });
    expect(latest.isStale).toBe(true);
  });

  it('says the newer reason when the retry fails differently', async () => {
    const view = await staleList();
    const before = view.spoken()!;

    await act(async () => {
      view.tryAgain().props.onPress();
    });
    await act(async () => view.calls[2].fail(down()));
    await flush();

    expect(view.spoken()).toBe(before);
    expect(view.spoken()!.props.accessibilityLabel).toContain(down().userMessage);
    expect(view.spoken()!.props.accessibilityLabel).not.toContain(offline().userMessage);
    expect(latest.staleError?.kind).toBe('server');
  });

  it('holds through a pull the same way, which is the same refresh', async () => {
    const view = await staleList();

    await act(async () => latest.refresh());

    expect(view.notice()).toBeDefined();
    expect(latest.staleError?.kind).toBe('network');

    await act(async () => view.calls[2].land('the list, again'));
    await flush();

    expect(view.notice()).toBeUndefined();
  });

  it('never holds a failure over an empty screen: nothing read is the error state', async () => {
    const { fetcher, calls } = heldCalls();
    await mount(fetcher);

    await act(async () => calls[0].fail(offline()));
    await flush();

    expect(latest).toMatchObject({ isStale: false, staleError: null });
    expect(latest.error?.kind).toBe('network');
  });
});
