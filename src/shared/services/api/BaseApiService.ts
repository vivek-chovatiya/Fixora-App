/**
 * BaseApiService
 *
 * Shared foundation for every ApiService implementation.
 *
 * Exists from day one so that when backend contracts land, an ApiService is
 * written against an established shape rather than introducing a new pattern
 * mid-project. Concrete implementations supply a base path and call the typed
 * helpers; none of them construct an axios instance, read the envelope or handle
 * errors, because HttpClient already does all three.
 *
 * Lists that page come back through `postPage`, already in the app's one `Page`
 * shape (`shared/types/pagination`). The backend's list endpoints are POSTs
 * that take `{ page, limit, ...filter }` in the body and answer with `meta`
 * (`Fixora-Backend/src/utils/pagination.js`); `pageFromMeta` is the one place
 * that meta becomes a `Page`.
 *
 * @example
 * class ApiThingService extends BaseApiService implements ThingService {
 *   constructor() { super('/things'); }
 *   detail(id: string) { return this.post<unknown>('/detail', { id }).then(toThing); }
 * }
 */

import { AppConfig } from '@/core/config/AppConfig';
import { Http, type HttpPageMeta, type HttpRequestConfig } from '@/core/http/HttpClient';
import { createLogger } from '@/core/logger/Logger';
import { malformedResponse } from '@/shared/services/api/apiResponse';
import type { Page, PageRequest } from '@/shared/types/pagination';

const log = createLogger('BaseApiService');

/**
 * A whole list as `postAllPages` read it.
 *
 * `truncated` is true when the backend still had more after
 * `AppConfig.api.fullListMaxPages` pages: the items are then the first part of
 * the list only, and any count taken from them is "at least" that many. A
 * caller that shows a count says so (`VendorDashboardCounts.isLowerBound`).
 */
export interface FullList<T> {
  items: T[];
  truncated: boolean;
}

/** Lists already reported as cut short, so a list refreshed every visit logs it once. */
const reportedTruncated = new Set<string>();

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * The backend's pagination `meta` as the app's `Page`.
 *
 * Each field falls back to what was asked for rather than failing, and a list
 * with no `meta` at all is one page with nothing after it: the items are what
 * matters, and a missing count must not hide them.
 */
export function pageFromMeta<T>(
  items: T[],
  meta: Partial<HttpPageMeta> | undefined,
  request: PageRequest,
): Page<T> {
  return {
    items,
    page: isCount(meta?.page) ? meta.page : request.page,
    pageSize: isCount(meta?.limit) ? meta.limit : request.pageSize,
    total: isCount(meta?.total) ? meta.total : items.length,
    hasMore: meta?.hasNextPage === true,
  };
}

export abstract class BaseApiService {
  protected constructor(private readonly basePath: string) {}

  /** Joins the service base path with a resource path, avoiding double slashes. */
  protected path(resource = ''): string {
    if (!resource) {
      return this.basePath;
    }
    const suffix = resource.startsWith('/') ? resource : `/${resource}`;
    return `${this.basePath}${suffix}`;
  }

  protected get<T>(resource = '', config?: HttpRequestConfig): Promise<T> {
    return Http.get<T>(this.path(resource), config);
  }

  protected post<T>(resource = '', body?: unknown, config?: HttpRequestConfig): Promise<T> {
    return Http.post<T>(this.path(resource), body, config);
  }

  protected put<T>(resource = '', body?: unknown, config?: HttpRequestConfig): Promise<T> {
    return Http.put<T>(this.path(resource), body, config);
  }

  protected patch<T>(resource = '', body?: unknown, config?: HttpRequestConfig): Promise<T> {
    return Http.patch<T>(this.path(resource), body, config);
  }

  protected delete<T>(resource = '', config?: HttpRequestConfig): Promise<T> {
    return Http.delete<T>(this.path(resource), config);
  }

  /**
   * One page of a backend list endpoint. The items are left as the backend
   * sent them, for the service to read into its own type.
   *
   * ⚠️ `page` and `limit` are written after the filter, so a filter can never
   * carry its own and quietly ask for a different page.
   */
  protected async postPage(
    resource: string,
    filter: Readonly<Record<string, unknown>>,
    request: PageRequest,
  ): Promise<Page<unknown>> {
    const { data, meta } = await Http.postEnvelope<unknown>(this.path(resource), {
      ...filter,
      page: request.page,
      limit: request.pageSize,
    });

    if (!Array.isArray(data)) {
      throw malformedResponse(`${resource} data`);
    }

    return pageFromMeta<unknown>(data, meta, request);
  }

  /**
   * Every page of a backend list, in the backend's order, for a list the app
   * needs whole — the catalogue, the vendors for a category, an inbox's unread
   * count. `AppConfig.api.fullListPageSize` is the backend's own ceiling for one
   * page, so a short list is one request.
   *
   * Moved here from `ApiCategoryService` when a second service needed it.
   *
   * ⚠️ Stops at `AppConfig.api.fullListMaxPages` and keeps what it read — a
   * guard against a server that always says there is more. It says so in the
   * answer (`truncated`), never silently (code review, 17/11/2026), and logs it
   * once per list for the life of the app.
   */
  protected async postAllPages(
    resource: string,
    filter: Readonly<Record<string, unknown>>,
  ): Promise<FullList<unknown>> {
    const rows: unknown[] = [];
    const pageSize = AppConfig.api.fullListPageSize;

    for (let read = 0; read < AppConfig.api.fullListMaxPages; read += 1) {
      const page = await this.postPage(resource, filter, {
        page: AppConfig.pagination.initialPage + read,
        pageSize,
      });
      rows.push(...page.items);

      if (!page.hasMore || page.items.length === 0) {
        return { items: rows, truncated: false };
      }
    }

    const list = this.path(resource);
    if (!reportedTruncated.has(list)) {
      reportedTruncated.add(list);
      log.warn('List longer than the page ceiling; using what was read', {
        resource: list,
        count: rows.length,
      });
    }
    return { items: rows, truncated: true };
  }
}
