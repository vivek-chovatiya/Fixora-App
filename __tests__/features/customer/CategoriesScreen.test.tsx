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
 * placeholder, list, empty, failure, retry.
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

  return {
    renderer,
    navigate,
    goBack,
    listServiceCategories,
    text: () => textOf(renderer.toJSON()),
    byTestID: (id: string) =>
      renderer.root.findAll(
        node => typeof node.type === 'string' && node.props?.testID === id,
      ),
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

afterEach(() => {
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
    const { byTestID, text, tiles } = await render(pending);

    expect(tiles()).toHaveLength(0);
    // The heading is already there, so the screen is never blank.
    expect(text()).toContain(COPY.title);

    const [grid] = byTestID('categories-grid');
    expect(grid.props.accessibilityState.busy).toBe(true);
    expect(grid.props.accessibilityLabel).toBe(COPY.loadingLabel);
  });

  it('does not offer an empty state to someone who is still waiting', async () => {
    const { byTestID } = await render(pending);

    expect(byTestID('categories-empty')).toHaveLength(0);
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
