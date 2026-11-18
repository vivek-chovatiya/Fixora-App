/**
 * ApiCategoryService reads the backend's catalogue into the two shapes every
 * category screen was built on, so these tests pin what crosses that line:
 *
 * - the list routes and their exact bodies (the `GET` routes ignore a filter,
 *   which is why they are not used — see the service's docblock);
 * - active, visible entries only, in the backend's order, every page of them;
 * - each entry read field by field: `icon` becomes `iconGlyph`, a blank one is
 *   absent so `DynamicIcon` falls back, and `_id`, `slug`, `sortOrder`, prices
 *   and timestamps stay behind;
 * - failures as AppErrors, a malformed answer included.
 *
 * The backend is a fake axios adapter on the real HttpClient: no network.
 */

import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { AppConfig } from '@/core/config/AppConfig';
import { httpClient } from '@/core/http/HttpClient';
import { ApiCategoryService } from '@/shared/services/api/ApiCategoryService';
import { AppError } from '@/shared/types/error';

type Reply = { status: number; body: unknown } | 'network';

const sent: InternalAxiosRequestConfig[] = [];
const originalAdapter = httpClient.defaults.adapter;

/** Answers each request with whatever `reply` gives for its parsed body. */
function backendAnswers(reply: (body: Record<string, unknown>) => Reply): void {
  const adapter: AxiosAdapter = async config => {
    sent.push(config);
    const answer = reply(JSON.parse((config.data as string) ?? '{}'));
    if (answer === 'network') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    const response: AxiosResponse = {
      data: answer.body,
      status: answer.status,
      statusText: '',
      headers: {},
      config,
    };
    if (answer.status >= 400) {
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
    }
    return response;
  };
  httpClient.defaults.adapter = adapter;
}

function list(data: unknown, meta: Record<string, unknown> = {}): Reply {
  const count = Array.isArray(data) ? data.length : 0;
  return {
    status: 200,
    body: {
      success: true,
      message: 'Retrieved.',
      data,
      meta: { total: count, page: 1, limit: 100, pages: 1, hasNextPage: false, ...meta },
      errors: null,
    },
  };
}

function bodies(): Record<string, unknown>[] {
  return sent.map(config => JSON.parse(config.data as string));
}

/** A category row as the dev backend's `categoryMapper` returns it. */
function categoryRow(id: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    _id: id,
    name,
    slug: name.toLowerCase(),
    icon: 'flash',
    description: `${name} work`,
    sortOrder: 1,
    isVisible: true,
    status: 'ACTIVE',
    createdAt: '2026-11-05T10:45:14.781Z',
    updatedAt: '2026-11-05T10:45:14.781Z',
    ...extra,
  };
}

/** A sub-category row as `subCategoryMapper` returns it — `icon: null`, as seeded. */
function subCategoryRow(id: string, categoryId: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    categoryId,
    name,
    slug: name.toLowerCase(),
    icon: null,
    description: '',
    estimatedDuration: 60,
    estimatedPrice: 299,
    isVisible: true,
    status: 'ACTIVE',
    createdAt: '2026-11-05T10:45:14.801Z',
    updatedAt: '2026-11-05T10:45:14.801Z',
    ...extra,
  };
}

const ELECTRICAL = '6aec5e3ad1f333d4534faf51';
const PLUMBING = '6aec5e3ad1f333d4534faf52';

async function rejectionOf(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (caught) {
    expect(caught).toBeInstanceOf(AppError);
    return caught as AppError;
  }
  throw new Error('Expected the call to reject');
}

let service: ApiCategoryService;

beforeEach(() => {
  sent.length = 0;
  for (const method of ['log', 'warn', 'error'] as const) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
  service = new ApiCategoryService();
});

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

describe('listServiceCategories', () => {
  it('asks the list route for active categories, a whole page at a time', async () => {
    backendAnswers(() => list([]));

    await service.listServiceCategories();

    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/categories/list');
    expect(bodies()[0]).toEqual({
      status: 'ACTIVE',
      page: AppConfig.pagination.initialPage,
      limit: AppConfig.api.fullListPageSize,
    });
  });

  it('reads each row into the app’s shape, in the backend’s order', async () => {
    backendAnswers(() =>
      list([
        categoryRow(PLUMBING, 'Plumbing', { icon: 'pipe-leak', sortOrder: 2 }),
        categoryRow(ELECTRICAL, 'Electrical', { sortOrder: 1 }),
      ]),
    );

    const categories = await service.listServiceCategories();

    // Not re-sorted: the backend's order is the order (section 11).
    expect(categories).toEqual([
      { id: PLUMBING, name: 'Plumbing', description: 'Plumbing work', iconGlyph: 'pipe-leak' },
      { id: ELECTRICAL, name: 'Electrical', description: 'Electrical work', iconGlyph: 'flash' },
    ]);
    for (const category of categories) {
      expect(Object.keys(category).sort()).toEqual(['description', 'iconGlyph', 'id', 'name']);
    }
    expect(JSON.stringify(categories)).not.toMatch(/_id|slug|sortOrder|status|createdAt/);
  });

  it.each([
    ['null', null],
    ['blank', ''],
    ['missing', undefined],
  ])('leaves an icon that is %s absent, so DynamicIcon draws its fallback', async (_case, icon) => {
    backendAnswers(() => list([categoryRow(ELECTRICAL, 'Electrical', { icon, description: '' })]));

    const [category] = await service.listServiceCategories();

    expect(category).toEqual({ id: ELECTRICAL, name: 'Electrical' });
    expect(category).not.toHaveProperty('iconGlyph');
    expect(category).not.toHaveProperty('description');
  });

  it('leaves out anything inactive or hidden that still comes back', async () => {
    backendAnswers(() =>
      list([
        categoryRow(ELECTRICAL, 'Electrical'),
        categoryRow('6aec5e3ad1f333d4534faf60', 'Retired', { status: 'INACTIVE' }),
        categoryRow('6aec5e3ad1f333d4534faf61', 'Hidden', { isVisible: false }),
      ]),
    );

    const categories = await service.listServiceCategories();

    expect(categories.map(category => category.id)).toEqual([ELECTRICAL]);
  });

  it('reads every page while the backend says there is more', async () => {
    backendAnswers(body =>
      body.page === 1
        ? list([categoryRow(ELECTRICAL, 'Electrical')], { page: 1, pages: 2, hasNextPage: true })
        : list([categoryRow(PLUMBING, 'Plumbing')], { page: 2, pages: 2, hasNextPage: false }),
    );

    const categories = await service.listServiceCategories();

    expect(bodies().map(body => body.page)).toEqual([1, 2]);
    expect(categories.map(category => category.id)).toEqual([ELECTRICAL, PLUMBING]);
  });

  it('stops at the page ceiling when the backend always says there is more', async () => {
    backendAnswers(body =>
      list([categoryRow(`6aec5e3ad1f333d4534fa${String(body.page).padStart(3, '0')}`, `C${body.page}`)], {
        hasNextPage: true,
      }),
    );

    const categories = await service.listServiceCategories();

    expect(sent).toHaveLength(AppConfig.api.fullListMaxPages);
    expect(categories).toHaveLength(AppConfig.api.fullListMaxPages);
  });

  it('stops when a page comes back empty, whatever it says', async () => {
    backendAnswers(() => list([], { hasNextPage: true }));

    await expect(service.listServiceCategories()).resolves.toEqual([]);
    expect(sent).toHaveLength(1);
  });
});

describe('listSubCategories', () => {
  it('asks the list route for one category’s active services', async () => {
    backendAnswers(() => list([]));

    await service.listSubCategories(ELECTRICAL);

    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/subcategories/list');
    expect(Object.keys(bodies()[0]).sort()).toEqual(['categoryId', 'limit', 'page', 'status']);
    expect(bodies()[0]).toEqual({
      status: 'ACTIVE',
      categoryId: ELECTRICAL,
      page: AppConfig.pagination.initialPage,
      limit: AppConfig.api.fullListPageSize,
    });
  });

  it('reads each row into the app’s shape, leaving the price and duration behind', async () => {
    backendAnswers(() =>
      list([
        subCategoryRow('6aec5e3ad1f333d4534faf57', ELECTRICAL, 'Fan & Light Installation'),
        subCategoryRow('6aec5e3ad1f333d4534faf58', ELECTRICAL, 'Switch & Socket Repair', {
          icon: 'toggle-switch-outline',
          description: 'Switches and sockets',
        }),
      ]),
    );

    const services = await service.listSubCategories(ELECTRICAL);

    expect(services).toEqual([
      { id: '6aec5e3ad1f333d4534faf57', name: 'Fan & Light Installation' },
      {
        id: '6aec5e3ad1f333d4534faf58',
        name: 'Switch & Socket Repair',
        description: 'Switches and sockets',
        iconGlyph: 'toggle-switch-outline',
      },
    ]);
    expect(JSON.stringify(services)).not.toMatch(/categoryId|estimated|slug|status|299/);
  });

  it('leaves out another category’s services, should the filter ever be ignored', async () => {
    backendAnswers(() =>
      list([
        subCategoryRow('6aec5e3ad1f333d4534faf57', ELECTRICAL, 'Fan & Light Installation'),
        subCategoryRow('6aec5e3ad1f333d4534faf5b', PLUMBING, 'Tap & Sink Leak Repair'),
      ]),
    );

    const services = await service.listSubCategories(ELECTRICAL);

    expect(services.map(entry => entry.name)).toEqual(['Fan & Light Installation']);
  });

  it('answers an empty category with an empty list, not an error', async () => {
    backendAnswers(() => list([]));

    await expect(service.listSubCategories(ELECTRICAL)).resolves.toEqual([]);
  });

  it('leaves out inactive and hidden services', async () => {
    backendAnswers(() =>
      list([
        subCategoryRow('6aec5e3ad1f333d4534faf57', ELECTRICAL, 'Shown'),
        subCategoryRow('6aec5e3ad1f333d4534faf58', ELECTRICAL, 'Retired', { status: 'INACTIVE' }),
        subCategoryRow('6aec5e3ad1f333d4534faf59', ELECTRICAL, 'Hidden', { isVisible: false }),
      ]),
    );

    const services = await service.listSubCategories(ELECTRICAL);

    expect(services.map(entry => entry.name)).toEqual(['Shown']);
  });
});

describe('failures', () => {
  it('reads a rejected category id as a validation error in the app’s words', async () => {
    backendAnswers(() => ({
      status: 400,
      body: {
        success: false,
        message: 'Validation Failed',
        code: 'VALIDATION_FAILED',
        data: null,
        errors: [{ field: 'categoryId', message: '"categoryId" length must be 24 characters long' }],
      },
    }));

    const error = await rejectionOf(service.listSubCategories('cat_electrician'));

    expect(error.kind).toBe('validation');
    expect(error.fieldErrors).toEqual({ categoryId: AppError.defaultMessage('validation') });
    expect(error.userMessage).not.toContain('24 characters');
  });

  it('reads no connection as a retryable network error', async () => {
    backendAnswers(() => 'network');

    const error = await rejectionOf(service.listServiceCategories());

    expect(error.kind).toBe('network');
    expect(error.isRetryable).toBe(true);
  });

  it.each([
    ['a row with no id', [{ ...categoryRow(ELECTRICAL, 'Electrical'), id: undefined }]],
    ['a row with no name', [categoryRow(ELECTRICAL, '')]],
    ['a row that is not an object', ['Electrical']],
    ['data that is not a list', { categories: [] }],
  ])('refuses %s as a server fault', async (_case, data) => {
    backendAnswers(() => list(data));

    const error = await rejectionOf(service.listServiceCategories());

    expect(error.kind).toBe('server');
    expect(error.isRetryable).toBe(true);
  });
});
