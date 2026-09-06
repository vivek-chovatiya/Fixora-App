/**
 * PROJECT_BIBLE.md section 12 forbids service-specific screens, and the way that
 * rule gets broken is never a file called ElectricianScreen — it is a lookup
 * keyed on a name, or a param carrying a category object, or a sort the backend
 * never asked for. So these tests pin the seams where that could creep in:
 *
 * - the screen asks the service for the id it was given, and nothing else
 * - it renders what came back, in the order it came back
 * - it carries identifiers onward, never names
 * - nothing in it knows what a category contains
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

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { SubCategoriesScreen } from '@/features/customer/screens/SubCategoriesScreen';
import { registerService, resetServices } from '@/shared/services/ServiceRegistry';
import type {
  CategoryService,
  ServiceCategory,
  SubCategory,
} from '@/shared/services/types/CategoryService';
import { ThemeProvider } from '@/shared/theme';
import { AppError } from '@/shared/types/error';

const COPY = CUSTOMER_COPY.subCategories;

const CATEGORY_ID = 'cat_roof';

const CATEGORIES: ServiceCategory[] = [
  { id: CATEGORY_ID, name: 'Roof Repair', iconGlyph: 'home-roof' },
  { id: 'cat_other', name: 'Glazing' },
];

/**
 * Deliberately not in alphabetical order, and one entry deliberately without a
 * description or a glyph — both are optional in the contract, and a row that
 * only works when the backend fills everything in is a row that will break.
 */
const SERVICES: SubCategory[] = [
  {
    id: 'sub_tiles',
    name: 'Tile Replacement',
    description: 'Cracked, slipped or missing tiles',
    iconGlyph: 'home-roof',
  },
  { id: 'sub_gutter', name: 'Gutter Clearing' },
  { id: 'sub_flashing', name: 'Flashing Repair', iconGlyph: 'hammer' },
];

/** A promise a test can leave hanging, so the loading state is observable. */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

interface Stubs {
  services?: (categoryId: string) => Promise<SubCategory[]>;
  categories?: () => Promise<ServiceCategory[]>;
  categoryId?: string;
}

async function render({ services, categories, categoryId = CATEGORY_ID }: Stubs = {}) {
  const listSubCategories = jest.fn(services ?? (async (_id: string) => SERVICES));
  const listServiceCategories = jest.fn(categories ?? (async () => CATEGORIES));

  registerService('category', {
    listServiceCategories,
    listSubCategories,
  } as CategoryService);

  const navigate = jest.fn();
  const goBack = jest.fn();
  const navigation = { navigate, goBack } as never;
  const route = {
    key: 'SubCategories',
    name: 'SubCategories' as const,
    params: { categoryId },
  } as never;

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <SubCategoriesScreen navigation={navigation} route={route} />
      </ThemeProvider>,
    );
  });

  return {
    renderer,
    navigate,
    goBack,
    listSubCategories,
    listServiceCategories,
    text: () => textOf(renderer.toJSON()),
    byTestID: (id: string) =>
      renderer.root.findAll(
        node => typeof node.type === 'string' && node.props?.testID === id,
      ),
    rows: () =>
      renderer.root.findAll(
        node =>
          typeof node.type === 'string' &&
          typeof node.props?.testID === 'string' &&
          node.props.testID.startsWith('sub-category-'),
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

describe('SubCategoriesScreen — what it asks for', () => {
  it('asks the service for the category it was routed with', async () => {
    const { listSubCategories } = await render();

    expect(listSubCategories).toHaveBeenCalledTimes(1);
    expect(listSubCategories).toHaveBeenCalledWith(CATEGORY_ID);
  });

  it('follows the id it is given rather than one it remembers', async () => {
    const { listSubCategories } = await render({ categoryId: 'cat_other' });

    expect(listSubCategories).toHaveBeenCalledWith('cat_other');
  });
});

describe('SubCategoriesScreen — what it renders', () => {
  it('draws every service the backend returned', async () => {
    const { rows, text } = await render();

    expect(rows()).toHaveLength(SERVICES.length);

    for (const service of SERVICES) {
      expect(text()).toContain(service.name);
    }
  });

  it('keeps the backend order rather than imposing one of its own', async () => {
    const { rows } = await render();

    expect(rows().map(row => row.props.testID)).toEqual(
      SERVICES.map(service => `sub-category-${service.id}`),
    );
  });

  it('preserves the backend identifiers', async () => {
    const { rows } = await render();

    for (const service of SERVICES) {
      expect(rows().map(row => row.props.testID)).toContain(`sub-category-${service.id}`);
    }
  });

  it('shows a description where there is one, and nothing where there is not', async () => {
    const { text } = await render();

    expect(text()).toContain('Cracked, slipped or missing tiles');
    // Gutter Clearing has none, and must still render as a complete row.
    expect(text()).toContain('Gutter Clearing');
  });

  it('draws the glyph the backend supplied, and falls back when there is none', async () => {
    const { renderer } = await render();

    const glyphs = renderer.root
      .findAll(node => typeof node.props?.name === 'string' && node.props?.size !== undefined)
      .map(node => node.props.name as string);

    expect(glyphs).toContain('home-roof');
    expect(glyphs).toContain('hammer');
    // Gutter Clearing supplied nothing, so the registry's fallback stands in.
    expect(glyphs).toContain('toolbox-outline');
  });
});

describe('SubCategoriesScreen — which category the user is in', () => {
  it('names the category once the catalogue says what it is called', async () => {
    const { byTestID, text } = await render();

    const [headingText] = byTestID('sub-categories-heading');

    expect(headingText.props.children).toBe('Roof Repair');
    // And the stand-in has stepped aside rather than sitting alongside it.
    expect(text()).not.toContain(COPY.fallbackTitle);
  });

  it('still says what to do when the category cannot be named', async () => {
    // A category withdrawn between one screen and the next is a real state, and
    // it must not leave the screen with a blank heading.
    const { text } = await render({ categories: async () => [] });

    expect(text()).toContain(COPY.fallbackTitle);
  });

  it('does not hold the services up waiting for the name', async () => {
    const { rows } = await render({ categories: pending });

    expect(rows()).toHaveLength(SERVICES.length);
  });

  it('does not let a missing name break the screen', async () => {
    const { rows, text } = await render({
      categories: async () => {
        throw new AppError({ kind: 'network' });
      },
    });

    expect(rows()).toHaveLength(SERVICES.length);
    expect(text()).toContain(COPY.fallbackTitle);
  });
});

describe('SubCategoriesScreen — while the services are still coming', () => {
  it('keeps the page shape instead of blanking or spinning', async () => {
    const { byTestID, rows, text } = await render({ services: pending });

    expect(rows()).toHaveLength(0);
    expect(text()).toContain(COPY.subtitle);

    const [list] = byTestID('sub-categories-list');
    expect(list.props.accessibilityState.busy).toBe(true);
    expect(list.props.accessibilityLabel).toBe(COPY.loadingLabel);
  });

  it('does not offer an empty state to someone who is still waiting', async () => {
    const { byTestID } = await render({ services: pending });

    expect(byTestID('sub-categories-empty')).toHaveLength(0);
  });

  it('stops calling itself busy once it is not, and keeps a name either way', async () => {
    // Found on device, twice: a list with a busy state and no label reported the
    // state as its name; and clearing the state once loaded did not unset it,
    // because the view is updated rather than remounted. Both have to be stated
    // on every render.
    const { byTestID } = await render();

    const [list] = byTestID('sub-categories-list');

    expect(list.props.accessibilityState).toEqual({ busy: false });
    expect(list.props.accessibilityLabel).toBe('Roof Repair');
  });
});

describe('SubCategoriesScreen — with nothing to show', () => {
  it('treats an empty category as empty, not as broken', async () => {
    const { byTestID, text } = await render({ services: async () => [] });

    expect(byTestID('sub-categories-empty')).toHaveLength(1);
    expect(byTestID('sub-categories-error')).toHaveLength(0);
    expect(text()).toContain(COPY.emptyTitle);
    expect(text()).toContain(COPY.emptyMessage);
  });
});

describe('SubCategoriesScreen — when the service fails', () => {
  const failure = new AppError({
    kind: 'network',
    message: 'ECONNREFUSED 10.0.2.2:8080',
  });

  const failing = async () => {
    throw failure;
  };

  it('shows the safe message and never the developer one', async () => {
    const { text } = await render({ services: failing });

    expect(text()).toContain(failure.userMessage);
    expect(text()).not.toContain(failure.message);
    expect(text()).not.toContain('ECONNREFUSED');
  });

  it('offers a retry that actually asks again, for the same category', async () => {
    const { press, listSubCategories } = await render({ services: failing });

    expect(listSubCategories).toHaveBeenCalledTimes(1);

    await press('Try again');

    expect(listSubCategories).toHaveBeenCalledTimes(2);
    expect(listSubCategories).toHaveBeenLastCalledWith(CATEGORY_ID);
  });

  it('keeps the screen its own name while it is failing', async () => {
    const { text, byTestID } = await render({ services: failing });

    expect(text()).toContain('Roof Repair');
    expect(byTestID('sub-categories-back')).toHaveLength(1);
  });
});

describe('SubCategoriesScreen — where a service leads', () => {
  it('carries both identifiers, and nothing else', async () => {
    const { press, navigate } = await render();

    await press('Flashing Repair');

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('CreateRequest', {
      categoryId: CATEGORY_ID,
      subCategoryId: 'sub_flashing',
    });

    const [, params] = navigate.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(params).sort()).toEqual(['categoryId', 'subCategoryId']);
    // No name, no glyph, no response object — a route keyed on display data
    // breaks the day somebody corrects a typo in the catalogue.
    expect(JSON.stringify(params)).not.toContain('Flashing');
    expect(JSON.stringify(params)).not.toContain('hammer');
    expect(JSON.stringify(params)).not.toContain('Roof Repair');
  });

  it('goes back the way it came', async () => {
    const { press, goBack } = await render();

    await press(COPY.back);

    expect(goBack).toHaveBeenCalledTimes(1);
  });
});

describe('SubCategoriesScreen — how it is announced', () => {
  it('names every service as a button, with a hint about what it starts', async () => {
    const { rows } = await render();

    for (const row of rows()) {
      expect(row.props.accessibilityRole).toBe('button');
      expect(row.props.accessibilityHint).toBe(COPY.itemHint);
      expect(typeof row.props.accessibilityLabel).toBe('string');
    }
  });

  it('folds the description into the spoken name so it is not lost', async () => {
    // A Pressable carrying a label does not read its children, so a description
    // left as a separate node would be silent.
    const { rows } = await render();

    const [tiles] = rows().filter(row => row.props.testID === 'sub-category-sub_tiles');

    expect(tiles.props.accessibilityLabel).toContain('Tile Replacement');
    expect(tiles.props.accessibilityLabel).toContain('Cracked, slipped or missing tiles');
  });

  it('gives the way back a spoken name rather than a bare chevron', async () => {
    const { byTestID } = await render();

    const [back] = byTestID('sub-categories-back');

    expect(back.props.accessibilityRole).toBe('button');
    expect(back.props.accessibilityLabel).toBe(COPY.back);
    expect(back.props.accessibilityHint).toBe(COPY.backHint);
  });
});
