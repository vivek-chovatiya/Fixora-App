/**
 * useServiceQuery's quiet read (Phase 3E-15): what a screen sends by itself
 * when its tab is shown again (owner decision, 21/10/2026).
 *
 * Pinned here, because each is a way it could stop being quiet:
 *
 * - it shows nothing while it reads: no loading, no refreshing — so no
 *   placeholders and no spinner on the screens that draw from those flags
 * - a failure from before stays where it is until this read answers, rather
 *   than being cleared and drawn again; an answer clears it, a failure
 *   replaces it
 * - it never starts beside a read already in the air — a pull or another
 *   quiet read — and is free again once that read settles, however it settled
 * - a newer read still wins: a retry started meanwhile is not overwritten by
 *   the quiet answer landing late
 * - a query that is switched off is not read
 *
 * Both the shared query and `useSingleFlightQuery`, which passes it on behind
 * its own guard. `retry` and `refresh` are as they were; the suites of every
 * screen that uses them pin those.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { useServiceQuery, type UseServiceQueryResult } from '@/shared/hooks/useServiceQuery';
import { useSingleFlightQuery } from '@/shared/hooks/useSingleFlightQuery';
import { AppError } from '@/shared/types/error';

type Flavour = 'useServiceQuery' | 'useSingleFlightQuery';

let latest: UseServiceQueryResult<string>;
/** Every state the probe rendered with, to prove what no render showed. */
let seen: Array<Pick<UseServiceQueryResult<string>, 'isLoading' | 'isRefreshing' | 'error'>>;

function PlainProbe({ fetcher, enabled }: { fetcher: () => Promise<string>; enabled: boolean }) {
  latest = useServiceQuery(fetcher, [], { enabled });
  seen.push({ isLoading: latest.isLoading, isRefreshing: latest.isRefreshing, error: latest.error });
  return null;
}

function SingleFlightProbe({ fetcher, enabled }: { fetcher: () => Promise<string>; enabled: boolean }) {
  latest = useSingleFlightQuery(fetcher, [], { enabled });
  seen.push({ isLoading: latest.isLoading, isRefreshing: latest.isRefreshing, error: latest.error });
  return null;
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  // Unmounted even when an assertion failed part-way (CLAUDE.md section 7).
  while (mounted.length > 0) {
    const renderer = mounted.pop()!;
    await act(async () => {
      renderer.unmount();
    });
  }
});

async function settle() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {});
  }
}

/** Mounts the probe and lets its first read land. `calls` counts what the test does after that. */
async function mount(flavour: Flavour, fetcher: jest.Mock<Promise<string>, []>, enabled = true) {
  const Probe = flavour === 'useServiceQuery' ? PlainProbe : SingleFlightProbe;
  seen = [];
  await act(async () => {
    mounted.push(ReactTestRenderer.create(<Probe fetcher={fetcher} enabled={enabled} />));
  });
  await settle();
  const before = fetcher.mock.calls.length;
  seen = [];
  return { calls: () => fetcher.mock.calls.length - before };
}

function held<T>() {
  let land!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    land = resolve;
    fail = reject;
  });
  return { promise, land, fail };
}

const offline = () => new AppError({ kind: 'network', message: 'offline' });

describe.each<Flavour>(['useServiceQuery', 'useSingleFlightQuery'])('%s — refreshQuietly', flavour => {
  it('reads again and shows nothing while it does: no loading, no refreshing', async () => {
    const fetcher = jest.fn<Promise<string>, []>().mockResolvedValue('first');
    const { calls } = await mount(flavour, fetcher);
    const answer = held<string>();
    fetcher.mockReturnValueOnce(answer.promise);

    await act(async () => {
      latest.refreshQuietly();
    });

    expect(calls()).toBe(1);
    expect(latest.data).toBe('first');

    await act(async () => {
      answer.land('second');
    });
    await settle();

    expect(latest.data).toBe('second');
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(state => !state.isLoading && !state.isRefreshing)).toBe(true);
  });

  it('keeps the failure from before until it has an answer, which then clears it', async () => {
    const fetcher = jest.fn<Promise<string>, []>().mockResolvedValue('first');
    await mount(flavour, fetcher);
    fetcher.mockRejectedValueOnce(offline());
    await act(async () => {
      latest.refresh();
    });
    await settle();
    expect(latest.error?.kind).toBe('network');

    const answer = held<string>();
    fetcher.mockReturnValueOnce(answer.promise);
    seen = [];
    await act(async () => {
      latest.refreshQuietly();
    });
    await settle();

    // Every render while it is out still has the failure: a stale notice does not blink.
    expect(seen.every(state => state.error?.kind === 'network')).toBe(true);
    expect(latest.data).toBe('first');

    await act(async () => {
      answer.land('fresh');
    });
    await settle();

    expect(latest.error).toBeNull();
    expect(latest.data).toBe('fresh');
  });

  it('replaces a failure with a newer one, keeping the data', async () => {
    const fetcher = jest.fn<Promise<string>, []>().mockResolvedValue('first');
    await mount(flavour, fetcher);
    const server = new AppError({ kind: 'server', message: 'down' });
    fetcher.mockRejectedValueOnce(server);

    await act(async () => {
      latest.refreshQuietly();
    });
    await settle();

    expect(latest.error).toBe(server);
    expect(latest.data).toBe('first');
    expect(latest.isLoading).toBe(false);
  });

  it('never starts beside a pull in the air, and is free once that settles, however it settled', async () => {
    const fetcher = jest.fn<Promise<string>, []>().mockResolvedValue('first');
    const { calls } = await mount(flavour, fetcher);
    const pulled = held<string>();
    fetcher.mockReturnValueOnce(pulled.promise);

    await act(async () => {
      latest.refresh();
    });
    await act(async () => {
      latest.refreshQuietly();
      latest.refreshQuietly();
    });
    expect(calls()).toBe(1);

    await act(async () => {
      pulled.fail(offline());
    });
    await settle();

    await act(async () => {
      latest.refreshQuietly();
    });
    await settle();
    expect(calls()).toBe(2);
  });

  it('never starts beside another quiet read', async () => {
    const fetcher = jest.fn<Promise<string>, []>().mockResolvedValue('first');
    const { calls } = await mount(flavour, fetcher);
    const quiet = held<string>();
    fetcher.mockReturnValueOnce(quiet.promise);

    await act(async () => {
      latest.refreshQuietly();
    });
    await act(async () => {
      latest.refreshQuietly();
      latest.refreshQuietly();
    });
    expect(calls()).toBe(1);

    await act(async () => {
      quiet.land('second');
    });
    await settle();
    expect(latest.data).toBe('second');
  });

  it.each(['retry', 'refresh'] as const)(
    'lets %s go ahead over a quiet read at once, visibly, and ignores the quiet answer landing later',
    async press => {
      const fetcher = jest.fn<Promise<string>, []>().mockResolvedValue('first');
      const { calls } = await mount(flavour, fetcher);
      const quiet = held<string>();
      const pressed = held<string>();
      fetcher.mockReturnValueOnce(quiet.promise).mockReturnValueOnce(pressed.promise);

      await act(async () => {
        latest.refreshQuietly();
      });
      await act(async () => {
        latest[press]();
      });

      // The press was not swallowed: its read is out, and it shows.
      expect(calls()).toBe(2);
      expect(press === 'retry' ? latest.isLoading : latest.isRefreshing).toBe(true);

      await act(async () => {
        pressed.land('pressed');
      });
      await settle();
      expect(latest.data).toBe('pressed');

      await act(async () => {
        quiet.land('quiet');
      });
      await settle();
      expect(latest.data).toBe('pressed');
    },
  );

  it('reads nothing while the query is switched off', async () => {
    const fetcher = jest.fn<Promise<string>, []>().mockResolvedValue('first');
    const { calls } = await mount(flavour, fetcher, false);

    await act(async () => {
      latest.refreshQuietly();
    });

    expect(calls()).toBe(0);
  });
});

describe('useSingleFlightQuery — a press over a quiet read is still one press', () => {
  it('sends one read for a press repeated while its own read is out', async () => {
    const fetcher = jest.fn<Promise<string>, []>().mockResolvedValue('first');
    const { calls } = await mount('useSingleFlightQuery', fetcher);
    const quiet = held<string>();
    const pressed = held<string>();
    fetcher.mockReturnValueOnce(quiet.promise).mockReturnValueOnce(pressed.promise);

    await act(async () => {
      latest.refreshQuietly();
    });
    await act(async () => {
      latest.refresh();
      latest.refresh();
      latest.retry();
    });

    expect(calls()).toBe(2);
    await act(async () => {
      pressed.land('pressed');
      quiet.land('quiet');
    });
    await settle();
    expect(latest.data).toBe('pressed');
  });
});

describe('useServiceQuery — a newer read wins over a quiet one', () => {
  it('discards the quiet answer that lands after a retry began', async () => {
    const fetcher = jest.fn<Promise<string>, []>().mockResolvedValue('first');
    await mount('useServiceQuery', fetcher);
    const quiet = held<string>();
    fetcher.mockReturnValueOnce(quiet.promise).mockResolvedValueOnce('newer');

    await act(async () => {
      latest.refreshQuietly();
    });
    // The error's Try again is a new question, and does not wait for a quiet read.
    await act(async () => {
      latest.retry();
    });
    await settle();
    expect(latest.data).toBe('newer');

    await act(async () => {
      quiet.land('older');
    });
    await settle();

    expect(latest.data).toBe('newer');
  });
});
