/**
 * The standard Fixora response envelope and helpers that unwrap it.
 *
 * Every endpoint returns { success, message, data, meta, errors }. Services
 * unwrap here so hooks and screens only ever see domain data.
 */

import type { Page } from '@/shared/types/pagination';

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  unreadCount?: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta: ApiMeta;
  errors: unknown;
}

export async function unwrap<T>(promise: Promise<ApiEnvelope<T>>): Promise<T> {
  const envelope = await promise;
  return envelope.data;
}

/** Converts a paginated envelope into the app's single Page contract. */
export async function unwrapPage<T>(promise: Promise<ApiEnvelope<T[]>>): Promise<Page<T>> {
  const { data, meta } = await promise;
  return {
    items: data,
    page: meta.page ?? 1,
    pageSize: meta.limit ?? data.length,
    total: meta.total ?? data.length,
    hasMore: Boolean(meta.hasNextPage),
  };
}
