/**
 * The categories screen has one job it must never get wrong: it renders what the
 * backend sent, and it passes on the id.
 *
 * So these tests pin that above everything else — the screen must know no
 * category of its own, must not reorder or filter what it is given, and must
 * carry the identifier rather than the name, because a name is display data the
 * backend is free to change and a route keyed on one is a link that breaks the
 * day somebody fixes a typo.
 *
 * The rest is the state machine every data-driven screen owes the user:
 * placeholder, list, empty, failure, retry — and a pull that fails, which keeps
 * the list and says so rather than passing it off as current.
 *
 * A stub CategoryService is registered so the screen is exercised through the
 * same abstraction the real one will arrive behind, and copy is asserted through
 * CUSTOMER_COPY rather than repeated as literals.
 */

import React from 'react';
import ReactTestRenderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';

import { CategoriesScreen } from '@/features/customer/screens/CategoriesScreen';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type { CategoryService, ServiceCategory } from '@/shared/services/types/CategoryService';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const COPY = CUSTOMER_COPY.categories;

/**
 * Deliberately not the mock service's seed, and deliberately not in alphabetical
 * order. If the screen ever sorts what it is handed, the second assertion below
 * catches it.
 */
const CATEGORIES: ServiceCategory[] = [
  { id: 'cat_roof', name: 'Roof Repair', iconGlyph: 'home-roof' },
  { id: 'cat_glaze', name: 'Glazing' },
  { id: 'cat_chimney', name: 'Chimney Sweeping', iconGlyph: 'fireplace' },
];

/** A promise a test can leave hanging, so the loading state is observable. */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

async function render(list?: () => Promise<ServiceCategory[]>) {
  const listServiceCategories = jest.fn(list ?? (async () => CATEGORIES));
  registerService('category', {
    listServiceCategories,
    // Part of the catalogue contract, and no business of this screen.
    listSubCategories: jest.fn(() => {
      throw new Error('listSubCategories must not be called from the categories screen');
    }),
  } as CategoryService);

  const navigate = jest.fn();
  const goBack = jest.fn();
  const navigation = { navigate, goBack } as never;
  const route = { key: 'Categories', name: 'Categories' as const, params: undefined } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <CategoriesScreen navigation={navigation} route={route} />
      </ThemeProvider>,
    );
  });
  mounted.push(renderer);

  return {
    renderer,
    navigate,
    goBack,
    listServiceCategories,
    /** Pull-to-refresh, as the list's refresh control would. */
    pull: async () => {
      const [grid] = renderer.root.findAll(
        node =>
          node.props?.testID === 'categories-grid' && typeof node.props?.onRefresh === 'function',
      );
      await act(async () => {
        grid.props.onRefresh();
      });
    },
    text: () => textOf(renderer.toJSON()),
    byTestID: (id: string) =>
      renderer.root.findAll(
        node => typeof node.type === 'string' && node.props?.testID === id,
      ),
    /**
     * The testID of every native view on screen that says it is busy.
     *
     * Ids, not the nodes: a failed match on a test instance makes jest print it,
     * and printing one walks the whole fiber tree — the run never finishes.
     */
    busy: () =>
      renderer.root
        .findAll(
          node => typeof node.type === 'string' && node.props?.accessibilityState?.busy === true,
        )
        .map(node => node.props.testID as string | undefined),
    /**
     * The press handler lives on the composite Pressable while the accessibility
     * props land on the host view it renders, so a button is found by asking for
     * a node carrying both.
     */
    press: async (label: string) => {
      const [target] = renderer.root.findAll(
        node =>
          node.props?.accessibilityRole === 'button' &&
          node.props?.accessibilityLabel === label &&
          typeof node.props?.onPress === 'function',
      );

      if (!target) {
        throw new Error(`No button labelled "${label}"`);
      }

      await act(async () => {
        target.props.onPress();
      });
    },
    tiles: () =>
      renderer.root.findAll(
        node =>
          typeof node.type === 'string' &&
          typeof node.props?.testID === 'string' &&
          node.props.testID.startsWith('category-') &&
          node.props.testID !== 'categories-error' &&
          node.props.testID !== 'categories-empty',
      ),
  };
}

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

/**
 * Every screen a test rendered, unmounted after it.
 *
 * Found tracing jest's "A worker process has failed to exit gracefully": the
 * tests that leave this screen loading left its `Skeleton`s pulsing forever —
 * the pulse is only cancelled on unmount — and with nothing unmounted, this
 * file's tests all passed and jest then never exited on its own.
 */
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  for (const renderer of mounted.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  resetServices();
});

describe('CategoriesScreen — what it renders', () => {
  it('asks the service once and draws every category it returns', async () => {
    const { listServiceCategories, tiles, text } = await render();

    expect(listServiceCategories).toHaveBeenCalledTimes(1);
    expect(tiles()).toHaveLength(CATEGORIES.length);

    for (const category of CATEGORIES) {
      expect(text()).toContain(category.name);
    }
  });

  it('keeps the backend order rather than imposing one of its own', async () => {
    const { tiles } = await render();

    expect(tiles().map(tile => tile.props.testID)).toEqual(
      CATEGORIES.map(category => `category-${category.id}`),
    );
  });

  it('draws the glyph the backend supplied, and copes when there is none', async () => {
    const { renderer } = await render();

    const glyphs = renderer.root
      .findAll(node => typeof node.props?.name === 'string' && node.props?.size !== undefined)
      .map(node => node.props.name as string);

    expect(glyphs).toContain('home-roof');
    expect(glyphs).toContain('fireplace');
    // Glazing supplied nothing, so the registry's fallback stands in for it —
    // a category with no icon must still be tappable, not invisible.
    expect(glyphs).toContain('toolbox-outline');
  });

  it('shows the screen heading and its supporting line', async () => {
    const { text } = await render();

    expect(text()).toContain(COPY.title);
    expect(text()).toContain(COPY.subtitle);
  });
});

describe('CategoriesScreen — while the catalogue is still coming', () => {
  it('keeps the page shape instead of blanking or spinning', async () => {
    const { byTestID, text, tiles, busy } = await render(pending);

    expect(tiles()).toHaveLength(0);
    // The heading is already there, so the screen is never blank.
    expect(text()).toContain(COPY.title);

    // One region says the wait once, named and busy — not the grid itself.
    const [region] = byTestID('categories-loading');
    expect(region.props.accessibilityLabel).toBe(COPY.loadingLabel);
    expect(region.props.accessibilityState).toEqual({ busy: true });
    expect(busy()).toEqual(['categories-loading']);

    const [grid] = byTestID('categories-grid');
    expect(grid.props.accessibilityLabel).toBeUndefined();
    expect(grid.props.accessibilityState).toBeUndefined();
    expect(grid.props.accessibilityRole).toBeUndefined();
  });

  it('does not offer an empty state to someone who is still waiting', async () => {
    const { byTestID } = await render(pending);

    expect(byTestID('categories-empty')).toHaveLength(0);
  });

  it('replaces the busy region once loaded, and never names the grid after its heading', async () => {
    // The grid used to be named on every render — "Loading categories", then
    // the screen's title — so loaded, TalkBack read the heading's words again
    // as a stop of its own. Now the wait is its own region, and it is gone,
    // not updated, when the catalogue arrives.
    let answer!: (categories: ServiceCategory[]) => void;
    const { byTestID, tiles, busy } = await render(
      () => new Promise<ServiceCategory[]>(resolve => (answer = resolve)),
    );

    const [waiting] = byTestID('categories-loading');
    expect(waiting.props.accessibilityState).toEqual({ busy: true });

    await act(async () => {
      answer(CATEGORIES);
    });

    expect(tiles()).toHaveLength(CATEGORIES.length);
    // Not hidden or emptied: no longer in the tree at all, so its busy cannot outlive it.
    expect(byTestID('categories-loading')).toHaveLength(0);

    const [grid] = byTestID('categories-grid');
    expect(grid === waiting).toBe(false);
    expect(grid.props.accessibilityLabel).toBeUndefined();
    expect(grid.props.accessibilityState).toBeUndefined();
    expect(grid.props.accessibilityRole).toBeUndefined();
    // Nothing anywhere on the loaded screen still says busy.
    expect(busy()).toHaveLength(0);
  });

  it('says the wait again on a retry, and replaces it when the answer comes', async () => {
    const failure = new AppError({ kind: 'network', message: 'offline' });
    let calls = 0;
    let answer!: (categories: ServiceCategory[]) => void;
    const { byTestID, press, tiles, busy } = await render(() => {
      calls += 1;
      return calls === 1
        ? Promise.reject(failure)
        : new Promise<ServiceCategory[]>(resolve => (answer = resolve));
    });

    expect(byTestID('categories-error')).toHaveLength(1);
    expect(byTestID('categories-loading')).toHaveLength(0);

    await press('Try again');

    const [waiting] = byTestID('categories-loading');
    expect(waiting.props.accessibilityLabel).toBe(COPY.loadingLabel);
    expect(busy()).toEqual(['categories-loading']);

    await act(async () => {
      answer(CATEGORIES);
    });

    expect(tiles()).toHaveLength(CATEGORIES.length);
    expect(byTestID('categories-loading')).toHaveLength(0);
    expect(busy()).toHaveLength(0);
  });
});

describe('CategoriesScreen — with nothing to show', () => {
  it('treats an empty catalogue as empty, not as broken', async () => {
    const { byTestID, text } = await render(async () => []);

    expect(byTestID('categories-empty')).toHaveLength(1);
    expect(byTestID('categories-error')).toHaveLength(0);
    expect(text()).toContain(COPY.emptyTitle);
    expect(text()).toContain(COPY.emptyMessage);
  });

  it('says so in its own words, with the grid unnamed and nothing busy', async () => {
    const { byTestID, busy } = await render(async () => []);

    expect(byTestID('categories-empty')).toHaveLength(1);
    expect(byTestID('categories-loading')).toHaveLength(0);
    const [grid] = byTestID('categories-grid');
    expect(grid.props.accessibilityLabel).toBeUndefined();
    expect(grid.props.accessibilityState).toBeUndefined();
    expect(busy()).toHaveLength(0);
  });
});

describe('CategoriesScreen — when the service fails', () => {
  const failure = new AppError({
    kind: 'network',
    message: 'ECONNREFUSED 10.0.2.2:8080',
  });

  const failing = async () => {
    throw failure;
  };

  it('shows the safe message and never the developer one', async () => {
    const { text } = await render(failing);

    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain(failure.message);
    expect(text()).not.toContain('ECONNREFUSED');
  });

  it('offers a retry that actually asks again', async () => {
    const { press, listServiceCategories } = await render(failing);

    expect(listServiceCategories).toHaveBeenCalledTimes(1);

    await press('Try again');

    expect(listServiceCategories).toHaveBeenCalledTimes(2);
  });

  it('does not leave a half-drawn grid behind the failure', async () => {
    const { byTestID, tiles } = await render(failing);

    expect(byTestID('categories-error')).toHaveLength(1);
    expect(tiles()).toHaveLength(0);
  });

  it('keeps the screen its own name while it is failing', async () => {
    // Found on device: rendering the failure instead of the list took the
    // heading with it, so the screen lost its identity at the moment the user
    // most needed to know where they were.
    const { text, byTestID } = await render(failing);

    expect(text()).toContain(COPY.title);
    expect(byTestID('categories-back')).toHaveLength(1);
  });

  it('says so in its own words, with the grid unnamed and nothing busy', async () => {
    const { byTestID, text, busy } = await render(failing);

    expect(byTestID('categories-error')).toHaveLength(1);
    expect(text()).toContain(failure.userMessage);
    expect(byTestID('categories-loading')).toHaveLength(0);
    const [grid] = byTestID('categories-grid');
    expect(grid.props.accessibilityLabel).toBeUndefined();
    expect(grid.props.accessibilityState).toBeUndefined();
    expect(busy()).toHaveLength(0);
  });
});

/**
 * A pull that fails. It used to say nothing: the shared query kept the tiles
 * and set an error, and the error's only place on this screen is the empty
 * slot, which a list with tiles never shows. Now the tiles stay and a notice
 * under the heading says they may be out of date.
 */
describe('CategoriesScreen — when a pull fails', () => {
  const failure = new AppError({
    kind: 'network',
    message: 'ECONNREFUSED 10.0.2.2:8080',
  });

  /** Answers, then fails once, then answers again. */
  function failingSecondTime() {
    let calls = 0;
    return async () => {
      calls += 1;
      if (calls === 2) {
        throw failure;
      }
      return CATEGORIES;
    };
  }

  it('keeps the tiles and says they may be out of date', async () => {
    const { pull, byTestID, tiles, text } = await render(failingSecondTime());
    expect(byTestID('categories-stale')).toHaveLength(0);

    await pull();

    expect(byTestID('categories-stale')).toHaveLength(1);
    expect(tiles()).toHaveLength(CATEGORIES.length);
    expect(byTestID('categories-error')).toHaveLength(0);
    expect(text()).toContain(COPY.staleTitle);
    expect(text()).toContain(COPY.staleMessage);
    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain('ECONNREFUSED');
  });

  it('clears the notice once a later pull succeeds', async () => {
    const { pull, byTestID, listServiceCategories } = await render(failingSecondTime());

    await pull();
    expect(byTestID('categories-stale')).toHaveLength(1);

    await pull();

    expect(byTestID('categories-stale')).toHaveLength(0);
    expect(listServiceCategories).toHaveBeenCalledTimes(3);
  });

  it('tries again from the notice by pulling, so the tiles never go', async () => {
    const { pull, byTestID, tiles, listServiceCategories } = await render(failingSecondTime());
    await pull();

    const [notice] = byTestID('categories-stale');
    const [retry] = notice.findAll(
      node =>
        node.props?.accessibilityRole === 'button' &&
        node.props?.accessibilityLabel === COPY.staleRetry &&
        typeof node.props?.onPress === 'function',
    );
    expect(retry.props.accessibilityHint).toBe(COPY.staleRetryHint);

    await act(async () => {
      retry.props.onPress();
    });

    expect(listServiceCategories).toHaveBeenCalledTimes(3);
    expect(byTestID('categories-stale')).toHaveLength(0);
    // A refresh, not a first load: no placeholders in between.
    expect(byTestID('categories-loading')).toHaveLength(0);
    expect(tiles()).toHaveLength(CATEGORIES.length);
  });

  it('still shows a failed first read as the full error, with no notice', async () => {
    const { byTestID } = await render(async () => {
      throw failure;
    });

    expect(byTestID('categories-error')).toHaveLength(1);
    expect(byTestID('categories-stale')).toHaveLength(0);
  });

  it('announces the notice in single sentences', async () => {
    const { pull, byTestID } = await render(failingSecondTime());

    await pull();

    const [notice] = byTestID('categories-stale');
    const [spoken] = notice.findAll(
      node => typeof node.type === 'string' && node.props?.accessibilityRole === 'alert',
    );
    expect(spoken.props.accessibilityLabel).toBe(
      `${COPY.staleTitle}. ${COPY.staleMessage} ${failure.userMessage}`,
    );
    expect(spoken.props.accessibilityLabel).not.toContain('..');
  });
});

describe('CategoriesScreen — where a category leads', () => {
  it('carries the id, and only the id', async () => {
    const { press, navigate } = await render();

    await press('Chimney Sweeping');

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('SubCategories', { categoryId: 'cat_chimney' });

    // The name is display data. A route keyed on one breaks the day somebody
    // corrects a typo in the catalogue.
    const [, params] = navigate.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(params)).toEqual(['categoryId']);
    expect(JSON.stringify(params)).not.toContain('Chimney');
  });

  it('goes back the way it came', async () => {
    const { press, goBack } = await render();

    await press(COPY.back);

    expect(goBack).toHaveBeenCalledTimes(1);
  });
});

describe('CategoriesScreen — how it is announced', () => {
  it('names every category as a button, with a hint about what it opens', async () => {
    const { tiles } = await render();

    for (const tile of tiles()) {
      expect(tile.props.accessibilityRole).toBe('button');
      expect(CATEGORIES.map(category => category.name)).toContain(
        tile.props.accessibilityLabel,
      );
      expect(tile.props.accessibilityHint).toBe(COPY.itemHint);
    }
  });

  it('never leaves the icon as the only thing saying what a category is', async () => {
    const { text } = await render();

    // Every tile carries its name as rendered text beside the glyph, so the
    // screen survives an unrecognised icon and a screen reader alike.
    for (const category of CATEGORIES) {
      expect(text()).toContain(category.name);
    }
  });

  it('gives the way back a spoken name rather than a bare chevron', async () => {
    const { byTestID } = await render();

    const [back] = byTestID('categories-back');

    expect(back.props.accessibilityRole).toBe('button');
    expect(back.props.accessibilityLabel).toBe(COPY.back);
    expect(back.props.accessibilityHint).toBe(COPY.backHint);
  });
});

/**
 * Section 54's `category_selected`: sent when a category is chosen, once per
 * choice, carrying the id and never the name the tile showed — and never for
 * the screen merely loading, failing, retrying or being pulled.
 */
describe('CategoriesScreen — what analytics is told (section 54)', () => {
  let track: jest.Mock;

  beforeEach(() => {
    track = jest.fn();
    registerService('analytics', { track, identify: jest.fn() });
  });

  it('counts the category chosen, once, by its id alone', async () => {
    const { press } = await render();

    await press('Chimney Sweeping');

    expect(track).toHaveBeenCalledTimes(1);
    const [event, properties] = track.mock.calls[0];
    expect(event).toBe('category_selected');
    expect(Object.keys(properties).sort()).toEqual(['categoryId']);
    expect(properties).toEqual({ categoryId: 'cat_chimney' });
    expect(JSON.stringify(track.mock.calls)).not.toContain('Chimney Sweeping');
  });

  it('counts nothing for opening, pulling, failing or trying again', async () => {
    const { pull } = await render();
    await pull();

    const { press } = await render(async () => {
      throw new AppError({ kind: 'network', message: 'ECONNREFUSED 10.0.2.2:8080' });
    });
    await press('Try again');

    expect(track).not.toHaveBeenCalled();
  });
});
