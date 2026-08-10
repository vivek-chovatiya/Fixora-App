/**
 * Pagination
 *
 * One pagination contract for every list in the application, so that list
 * screens and the pagination hook never need per-endpoint special cases.
 */

import { AppConfig } from '@/core/config/AppConfig';

export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  /** Total matching records across all pages. */
  total: number;
  hasMore: boolean;
}

export const defaultPageRequest: PageRequest = {
  page: AppConfig.pagination.initialPage,
  pageSize: AppConfig.pagination.defaultPageSize,
};

/** Builds a Page from a full result set. Used by mock services. */
export function toPage<T>(all: readonly T[], request: PageRequest): Page<T> {
  const start = (request.page - AppConfig.pagination.initialPage) * request.pageSize;
  const items = all.slice(start, start + request.pageSize);

  return {
    items,
    page: request.page,
    pageSize: request.pageSize,
    total: all.length,
    hasMore: start + items.length < all.length,
  };
}

export function emptyPage<T>(request: PageRequest = defaultPageRequest): Page<T> {
  return {
    items: [],
    page: request.page,
    pageSize: request.pageSize,
    total: 0,
    hasMore: false,
  };
}
