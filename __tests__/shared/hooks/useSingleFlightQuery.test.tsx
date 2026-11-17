/**
 * useSingleFlightQuery: one request in the air at a time, and a guard that
 * cannot stick (Phase 3E-3).
 *
 * The second half is the one that matters. In Phase 3E-2 a guard released by
 * watching `isLoading` stayed shut for good after a retry that failed at once —
 * Try again worked exactly once. This guard is released when the call settles,
 * so it is pinned here against both an immediate failure and an immediate
 * success, and against a service that returns the very same object twice.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { useSingleFlightQuery } from '@/shared/hooks/useSingleFlightQuery';
import type { UseServiceQueryResult } from '@/shared/hooks/useServiceQuery';
import { AppError } from '@/shared/types/error';

let latest: UseServiceQueryResult<string>;

function Probe({ fetcher }: { fetcher: () => Promise<string> }) {
  latest = useSingleFlightQuery(fetcher, []);
  return null;
}

function KeyedProbe({
  fetcher,
  input,
}: {
  fetcher: (key: string) => Promise<string>;
  input: string;
}) {
  latest = useSingleFlightQuery(() => fetcher(input), [input]);
  return null;
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

async function mount(fetcher: () => Promise<string>) {
  await act(async () => {
    mounted.push(ReactTestRenderer.create(<Probe fetcher={fetcher} />));
  });
  await act(async () => {});
}

async function mountKeyed(fetcher: (key: string) => Promise<string>, input: string) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<KeyedProbe fetcher={fetcher} input={input} />);
  });
  mounted.push(renderer);
  return renderer;
}

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

const offline = () => new AppError({ kind: 'network', message: 'offline' });

describe('useSingleFlightQuery', () => {
  it('loads once on mount and gives the answer', async () => {
    const fetcher = jest.fn(async () => 'first');
    await mount(fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(latest.data).toBe('first');
    expect(latest.isLoading).toBe(false);
  });

  it('sends one request however often retry is pressed in a row', async () => {
    const fetcher = jest.fn<Promise<string>, []>().mockRejectedValueOnce(offline());
    fetcher.mockResolvedValue('ok');
    await mount(fetcher);
    expect(latest.error?.kind).toBe('network');

    await act(async () => {
      latest.retry();
      latest.retry();
      latest.retry();
    });
    await settle();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(latest.data).toBe('ok');
  });

  it('can retry again after a retry that failed at once', async () => {
    const fetcher = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(offline())
      .mockRejectedValueOnce(offline())
      .mockRejectedValueOnce(offline())
      .mockResolvedValue('at last');
    await mount(fetcher);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await act(async () => {
        latest.retry();
      });
      await settle();
    }

    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(latest.data).toBe('at last');
    expect(latest.error).toBeNull();
  });

  it('can refresh again after a refresh that failed at once', async () => {
    const fetcher = jest
      .fn<Promise<string>, []>()
      .mockResolvedValueOnce('first')
      .mockRejectedValueOnce(offline())
      .mockResolvedValue('second');
    await mount(fetcher);

    await act(async () => {
      latest.refresh();
    });
    await settle();
    // The old answer is kept and the failure is reported beside it.
    expect(latest.data).toBe('first');
    expect(latest.error?.kind).toBe('network');

    await act(async () => {
      latest.refresh();
    });
    await settle();

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(latest.data).toBe('second');
    expect(latest.error).toBeNull();
  });

  it('is not fooled by a service that returns the very same answer twice', async () => {
    const fetcher = jest.fn(async () => 'same');
    await mount(fetcher);

    for (let pull = 0; pull < 3; pull += 1) {
      await act(async () => {
        latest.refresh();
      });
      await settle();
    }

    // Every pull was sent: the guard opened again each time, though nothing changed.
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('stays shut while a newer read is in the air, though the read it replaced has settled', async () => {
    // The inputs change mid-read: the newer read starts while the older one is
    // still running. A boolean guard was opened by the older one's `finally`.
    const finishes = new Map<string, (value: string) => void>();
    const fetcher = jest.fn(
      (key: string) => new Promise<string>(resolve => finishes.set(key, resolve)),
    );
    const renderer = await mountKeyed(fetcher, 'a');
    await act(async () => {
      renderer.update(<KeyedProbe fetcher={fetcher} input="b" />);
    });
    expect(fetcher.mock.calls.map(([key]) => key)).toEqual(['a', 'b']);

    await act(async () => {
      finishes.get('a')!('answer a');
    });
    await settle();
    await act(async () => {
      latest.refresh();
      latest.retry();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    await act(async () => {
      finishes.get('b')!('answer b');
    });
    await settle();
    expect(latest.data).toBe('answer b');

    await act(async () => {
      latest.refresh();
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('opens again once the newest read fails, though the read it replaced never answers', async () => {
    // A dead connection: the superseded read hangs until the request timeout.
    // Try again on the newest read's failure must not wait for it.
    const fetcher = jest.fn((key: string) =>
      key === 'a' ? new Promise<string>(() => {}) : Promise.reject(offline()),
    );
    const renderer = await mountKeyed(fetcher, 'a');
    await act(async () => {
      renderer.update(<KeyedProbe fetcher={fetcher} input="b" />);
    });
    await settle();
    expect(latest.error?.kind).toBe('network');

    await act(async () => {
      latest.retry();
    });

    expect(fetcher.mock.calls.map(([key]) => key)).toEqual(['a', 'b', 'b']);
  });

  it('ignores a refresh while a request is still in the air, then allows the next', async () => {
    let finish!: (value: string) => void;
    const fetcher = jest
      .fn<Promise<string>, []>()
      .mockImplementationOnce(() => new Promise<string>(resolve => (finish = resolve)))
      .mockResolvedValue('second');
    await mount(fetcher);
    expect(latest.isLoading).toBe(true);

    await act(async () => {
      latest.refresh();
      latest.retry();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish('first');
    });
    await settle();
    expect(latest.data).toBe('first');

    await act(async () => {
      latest.refresh();
    });
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(latest.data).toBe('second');
  });
});
