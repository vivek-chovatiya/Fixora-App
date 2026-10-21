/**
 * useCategoryNames
 *
 * The names of the vendor's chosen categories, for display.
 *
 * The profile stores identifiers only (PROJECT_BIBLE.md section 11), so the
 * names come from `CategoryService` — the same catalogue registration and setup
 * choose from — in the order the vendor's list has them. An identifier the
 * catalogue no longer carries is left out rather than shown as a raw id.
 */

import { useCallback, useMemo } from 'react';

import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { ServiceCategory } from '@/shared/services/types/CategoryService';
import type { AppError } from '@/shared/types/error';

export interface CategoryNames {
  names: string[];
  isLoading: boolean;
  error: AppError | null;
  retry: () => void;
}

export function useCategoryNames(categoryIds: readonly string[]): CategoryNames {
  const query = useServiceQuery<ServiceCategory[]>(
    useCallback(() => getService('category').listServiceCategories(), []),
    [],
  );

  const names = useMemo(() => {
    const byId = new Map((query.data ?? []).map(category => [category.id, category.name]));
    return categoryIds.flatMap(id => {
      const name = byId.get(id);
      return name ? [name] : [];
    });
  }, [categoryIds, query.data]);

  return { names, isLoading: query.isLoading, error: query.error, retry: query.retry };
}
