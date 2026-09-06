/**
 * useSubCategories
 *
 * What is inside one category, and the name of the category itself.
 *
 *   Screen → hook → CategoryService interface → implementation
 *
 * ⚠️ Two queries, and only one of them matters. The services are the screen;
 * the category's name is context, so it is fetched separately, never awaited,
 * and never allowed to hold the list up or take it down. A screen that showed
 * nothing because it could not work out its own title would have failed at the
 * only job it has.
 *
 * The name is recovered from the catalogue the app already asks for rather than
 * travelling in a navigation param. A param would mean routing on display data:
 * the name is the backend's to change and to translate, and a screen that was
 * handed one would keep showing the old spelling until somebody navigated again.
 * It is the same query Home and the categories screen run, so once there is real
 * caching in front of the service this costs nothing; until then it is one extra
 * list read on a screen the user reached by tapping something in that very list.
 */

import { useMemo } from 'react';

import { useCategories } from '@/features/customer/hooks/useCategories';
import { useServiceQuery, type UseServiceQueryResult } from '@/shared/hooks/useServiceQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { SubCategory } from '@/shared/services/types/CategoryService';

export interface SubCategoryBrowse {
  services: UseServiceQueryResult<SubCategory[]>;
  /**
   * The category being browsed, once it is known.
   *
   * `undefined` while the catalogue is loading, and if the id is not in it —
   * which is a real possibility rather than a defensive flourish, since a
   * category can be withdrawn between one screen and the next.
   */
  categoryName?: string;
}

export function useSubCategories(categoryId: string): SubCategoryBrowse {
  const services = useServiceQuery<SubCategory[]>(
    () => getService('category').listSubCategories(categoryId),
    [categoryId],
  );

  const categories = useCategories();

  const categoryName = useMemo(
    () => categories.data?.find(category => category.id === categoryId)?.name,
    [categories.data, categoryId],
  );

  return { services, categoryName };
}
