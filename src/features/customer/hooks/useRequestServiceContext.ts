/**
 * useRequestServiceContext
 *
 * Turns the two identifiers a request is started with into the two names a
 * customer needs to see.
 *
 *   Screen → hook → CategoryService interface → implementation
 *
 * ⚠️ Context, never identity. The names exist so the customer can confirm what
 * they are asking for; the request itself carries only the ids it was handed
 * (PROJECT_BIBLE.md sections 11 and 12), so nothing resolved here reaches the
 * service. That is also why a failure to resolve is survivable: a request for a
 * service whose name did not load is still a request for that service.
 *
 * It is `useSubCategories` again with one extra lookup, deliberately rather than
 * accidentally. That hook already asks for the category's name and the services
 * inside it, which is one of the two answers needed and the list containing the
 * other — so reusing it costs a `find` and keeps request creation on exactly the
 * queries the screen before it already ran.
 */

import { useMemo } from 'react';

import { useSubCategories } from '@/features/customer/hooks/useSubCategories';
import type { AppError } from '@/shared/types/error';

export interface RequestServiceContext {
  /** The category, once the catalogue has answered. */
  categoryName?: string;
  /** The service itself, once the catalogue has answered. */
  subCategoryName?: string;
  /** True while either name is still unknown and might yet arrive. */
  isLoading: boolean;
  /**
   * Why the names are missing, when they are missing because of a failure.
   *
   * Surfaced rather than swallowed, but never as a blocker: the screen says the
   * name could not be loaded and carries on, because the alternative is
   * refusing to take a request over a caption.
   */
  error: AppError | null;
  /** Re-runs the catalogue read behind the names. */
  retry: () => void;
}

export function useRequestServiceContext(
  categoryId: string,
  subCategoryId: string,
): RequestServiceContext {
  const { services, categoryName } = useSubCategories(categoryId);

  const subCategoryName = useMemo(
    () => services.data?.find(service => service.id === subCategoryId)?.name,
    [services.data, subCategoryId],
  );

  return {
    categoryName,
    subCategoryName,
    isLoading: services.isLoading,
    error: services.error,
    retry: services.retry,
  };
}
