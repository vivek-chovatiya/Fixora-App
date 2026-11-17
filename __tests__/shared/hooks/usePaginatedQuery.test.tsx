/**
 * usePaginatedQuery's quiet read (Phase 3E-15; review decisions, 21/10/2026):
 * a list read again by itself when its tab is shown again.
 *
 * Pinned here, because each was a way to get it wrong:
 *
 * - every page on screen is read again, one request per page at the list's own
 *   page size — the requests a scroll makes, never one long page a backend
 *   might refuse — and the list is swapped in whole only when the last lands
 * - it stops at a page that says there is no more, and the page counter,
 *   `hasMore` and `total` are what it read, so the next page asked for is the
 *   one after them
 * - superseded part-way (a pull, a new question) or unmounted, it is dropped
 * - a next page that had already failed stays the failure, so `retry` still
 *   carries on from the page after the last that arrived
 * - a next page asked for while it is out is held — one, however often asked —
 *   and asked for once it lands, if there is more and nothing newer replaced it
 *
 * My Requests' own suite pins the same through the screen.
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import {
  usePaginatedQuery,
  type UsePaginatedQueryResult,
} from '@/shared/hooks/usePaginatedQuery';
import { AppError } from '@/shared/types/error';
import { toPage, type Page, type PageRequest } from '@/shared/types/pagination';

const PAGE = 3;

type Fetch = jest.Mock<Promise<Page<string>>, [PageRequest]>;

let latest: UsePaginatedQueryResult<string>;

function Probe({ fetchPage, question }: { fetchPage: Fetch; question: string }) {
  latest = usePaginatedQuery<string>(fetchPage, [question], { pageSize: PAGE, getKey: item => item });
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
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {});
  }
}

const rows = (count: number, prefix = 'r') => Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);

/** Pages a fixed list the way a backend would. */
const pagesOf = (all: string[]): Fetch => jest.fn(async (request: PageRequest) => toPage(all, request));

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

async function mount(fetchPage: Fetch, question = 'all') {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<Probe fetchPage={fetchPage} question={question} />);
  });
  mounted.push(renderer);
  await settle();
  return renderer;
}

/** Mounts and loads pages until `pages` are on screen. */
async function mountWithPages(fetchPage: Fetch, pages: number) {
  const renderer = await mount(fetchPage);
  for (let i = 1; i < pages; i += 1) {
    await act(async () => {
      latest.loadMore();
    });
    await settle();
  }
  fetchPage.mockClear();
  return renderer;
}

async function quietly() {
  await act(async () => {
    latest.refreshQuietly();
  });
}

describe('usePaginatedQuery — refreshQuietly reads page by page', () => {
  it('reads every page on screen, one request per page at the list’s own size', async () => {
    const fetchPage = pagesOf(rows(10));
    await mountWithPages(fetchPage, 3);
    expect(latest.items).toEqual(rows(9));

    await quietly();
    await settle();

    expect(fetchPage.mock.calls.map(([request]) => request)).toEqual([
      { page: 1, pageSize: PAGE },
      { page: 2, pageSize: PAGE },
      { page: 3, pageSize: PAGE },
    ]);
    expect(latest.items).toEqual(rows(9));
    expect(latest.isLoading || latest.isRefreshing || latest.isLoadingMore).toBe(false);
  });

  it('swaps the list in whole only when the last page lands', async () => {
    const all = rows(10);
    const fetchPage = pagesOf(all);
    await mountWithPages(fetchPage, 2);
    const second = held<Page<string>>();
    const fresh = ['new', ...all];
    fetchPage
      .mockImplementationOnce(async request => toPage(fresh, request))
      .mockImplementationOnce(() => second.promise);

    await quietly();
    await settle();

    // Page one has an answer, page two does not: the list on screen is untouched.
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(latest.items).toEqual(rows(6));

    await act(async () => {
      second.land(toPage(fresh, { page: 2, pageSize: PAGE }));
    });
    await settle();

    expect(latest.items).toEqual(fresh.slice(0, 6));
  });

  it('stops at a page that says there is no more, and counts from what it read', async () => {
    const fetchPage = pagesOf(rows(10));
    await mountWithPages(fetchPage, 3);
    // The list shrank to four while the customer was away.
    fetchPage.mockImplementation(async request => toPage(rows(4), request));

    await quietly();
    await settle();

    expect(fetchPage.mock.calls.map(([request]) => request.page)).toEqual([1, 2]);
    expect(latest.items).toEqual(rows(4));
    expect(latest.hasMore).toBe(false);
    expect(latest.total).toBe(4);

    // Two pages are on screen now, not three: the next return reads two, and
    // the next page asked for is the third.
    fetchPage.mockClear();
    fetchPage.mockImplementation(async request => toPage(rows(10), request));
    await quietly();
    await settle();
    expect(fetchPage.mock.calls.map(([request]) => request.page)).toEqual([1, 2]);

    await act(async () => {
      latest.loadMore();
    });
    await settle();
    expect(fetchPage.mock.calls.map(([request]) => request.page)).toEqual([1, 2, 3]);
    expect(latest.items).toEqual(rows(9));
  });

  it('asks for the page after what it read when the list grew', async () => {
    const fetchPage = pagesOf(rows(5));
    await mountWithPages(fetchPage, 2);
    expect(latest.hasMore).toBe(false);
    fetchPage.mockImplementation(async request => toPage(rows(10), request));

    await quietly();
    await settle();
    expect(latest.items).toEqual(rows(6));
    expect(latest.hasMore).toBe(true);

    await act(async () => {
      latest.loadMore();
    });
    await settle();

    expect(fetchPage.mock.calls.map(([request]) => request.page)).toEqual([1, 2, 3]);
    expect(latest.items).toEqual(rows(9));
  });

  it('is dropped when a pull replaces it part-way', async () => {
    const fetchPage = pagesOf(rows(10));
    await mountWithPages(fetchPage, 2);
    const second = held<Page<string>>();
    fetchPage
      .mockImplementationOnce(async request => toPage(rows(10, 'q'), request))
      .mockImplementationOnce(() => second.promise)
      .mockImplementation(async request => toPage(rows(10, 'p'), request));

    await quietly();
    await settle();
    await act(async () => {
      latest.refresh();
    });
    await settle();
    await act(async () => {
      second.land(toPage(rows(10, 'q'), { page: 2, pageSize: PAGE }));
    });
    await settle();

    // The pull's first page, and nothing of the quiet read.
    expect(latest.items).toEqual(rows(3, 'p'));
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('is dropped, asking nothing more, when the list goes away part-way', async () => {
    const fetchPage = pagesOf(rows(10));
    const renderer = await mountWithPages(fetchPage, 2);
    const first = held<Page<string>>();
    fetchPage.mockImplementationOnce(() => first.promise);

    await quietly();
    await act(async () => {
      renderer.unmount();
    });
    mounted.splice(mounted.indexOf(renderer), 1);
    await act(async () => {
      first.land(toPage(rows(10), { page: 1, pageSize: PAGE }));
    });
    await settle();

    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

describe('usePaginatedQuery — a quiet read that fails', () => {
  it('keeps a next page that had already failed as the failure, so retry carries on from there', async () => {
    const fetchPage = pagesOf(rows(10));
    await mountWithPages(fetchPage, 2);
    fetchPage.mockRejectedValueOnce(offline());
    await act(async () => {
      latest.loadMore();
    });
    await settle();
    expect(latest.failedDuring).toBe('more');

    fetchPage.mockRejectedValueOnce(offline());
    await quietly();
    await settle();

    expect(latest.failedDuring).toBe('more');
    expect(latest.items).toEqual(rows(6));

    fetchPage.mockClear();
    await act(async () => {
      latest.retry();
    });
    await settle();

    expect(fetchPage.mock.calls.map(([request]) => request)).toEqual([{ page: 3, pageSize: PAGE }]);
    expect(latest.items).toEqual(rows(9));
  });

  it('lets Try again on a failed next page go ahead over a quiet read, and drops the quiet answer', async () => {
    const fetchPage = pagesOf(rows(10));
    await mountWithPages(fetchPage, 2);
    fetchPage.mockRejectedValueOnce(offline());
    await act(async () => {
      latest.loadMore();
    });
    await settle();
    expect(latest.failedDuring).toBe('more');

    fetchPage.mockClear();
    const quietFirst = held<Page<string>>();
    const third = held<Page<string>>();
    fetchPage.mockImplementationOnce(() => quietFirst.promise).mockImplementationOnce(() => third.promise);
    await quietly();
    await act(async () => {
      latest.retry();
    });

    // At once, and visibly: the tap was not swallowed.
    expect(fetchPage.mock.calls.map(([request]) => request.page)).toEqual([1, 3]);
    expect(latest.isLoadingMore).toBe(true);
    await act(async () => {
      third.land(toPage(rows(10), { page: 3, pageSize: PAGE }));
    });
    await settle();
    expect(latest.items).toEqual(rows(9));

    await act(async () => {
      quietFirst.land(toPage(rows(10, 'q'), { page: 1, pageSize: PAGE }));
    });
    await settle();
    expect(latest.items).toEqual(rows(9));
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('stands in for the pull when nothing had failed, keeping what is on screen', async () => {
    const fetchPage = pagesOf(rows(10));
    await mountWithPages(fetchPage, 2);
    fetchPage.mockRejectedValueOnce(offline());

    await quietly();
    await settle();

    expect(latest.failedDuring).toBe('refresh');
    expect(latest.items).toEqual(rows(6));
  });
});

describe('usePaginatedQuery — a next page asked for during a quiet read', () => {
  it('is held, and asked for once the quiet read lands — once, however often it was asked', async () => {
    const fetchPage = pagesOf(rows(10));
    await mountWithPages(fetchPage, 2);
    const second = held<Page<string>>();
    fetchPage
      .mockImplementationOnce(async request => toPage(rows(10), request))
      .mockImplementationOnce(() => second.promise);

    await quietly();
    await settle();
    await act(async () => {
      latest.loadMore();
      latest.loadMore();
    });
    await settle();
    // Nothing beside the quiet read.
    expect(fetchPage).toHaveBeenCalledTimes(2);

    await act(async () => {
      second.land(toPage(rows(10), { page: 2, pageSize: PAGE }));
    });
    await settle();

    expect(fetchPage.mock.calls.map(([request]) => request.page)).toEqual([1, 2, 3]);
    expect(latest.items).toEqual(rows(9));
  });

  it('is not asked for when the quiet read finds there is no more', async () => {
    const fetchPage = pagesOf(rows(10));
    await mountWithPages(fetchPage, 2);
    const second = held<Page<string>>();
    fetchPage
      .mockImplementationOnce(async request => toPage(rows(5), request))
      .mockImplementationOnce(() => second.promise);

    await quietly();
    await settle();
    await act(async () => {
      latest.loadMore();
    });
    await act(async () => {
      second.land(toPage(rows(5), { page: 2, pageSize: PAGE }));
    });
    await settle();

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(latest.items).toEqual(rows(5));
  });

  it('is not asked for when something newer replaced the quiet read', async () => {
    const fetchPage = pagesOf(rows(10));
    await mountWithPages(fetchPage, 2);
    const first = held<Page<string>>();
    fetchPage.mockImplementationOnce(() => first.promise);

    await quietly();
    await act(async () => {
      latest.loadMore();
    });
    await act(async () => {
      latest.refresh();
    });
    await settle();
    await act(async () => {
      first.land(toPage(rows(10), { page: 1, pageSize: PAGE }));
    });
    await settle();

    // The quiet read's first page and the pull's: no held next page after either.
    expect(fetchPage.mock.calls.map(([request]) => request.page)).toEqual([1, 1]);
    expect(latest.items).toEqual(rows(3));
  });
});
