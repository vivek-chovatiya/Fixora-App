/**
 * BaseApiService
 *
 * Shared foundation for every future ApiService implementation.
 *
 * Exists from day one so that when backend contracts land, an ApiService is
 * written against an established shape rather than introducing a new pattern
 * mid-project. Concrete implementations supply a base path and call the typed
 * helpers; none of them construct an axios instance or handle errors, because
 * HttpClient already does both.
 *
 * @example
 * class ApiCategoryService extends BaseApiService implements CategoryService {
 *   constructor() { super('/categories'); }
 *   list() { return this.get<Category[]>(''); }
 * }
 */

import type { AxiosRequestConfig } from 'axios';

import { Http } from '@/core/http/HttpClient';

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

  protected get<T>(resource = '', config?: AxiosRequestConfig): Promise<T> {
    return Http.get<T>(this.path(resource), config);
  }

  protected post<T>(resource = '', body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return Http.post<T>(this.path(resource), body, config);
  }

  protected put<T>(resource = '', body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return Http.put<T>(this.path(resource), body, config);
  }

  protected patch<T>(resource = '', body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return Http.patch<T>(this.path(resource), body, config);
  }

  protected delete<T>(resource = '', config?: AxiosRequestConfig): Promise<T> {
    return Http.delete<T>(this.path(resource), config);
  }
}
