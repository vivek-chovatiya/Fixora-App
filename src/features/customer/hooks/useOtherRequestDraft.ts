/**
 * useOtherRequestDraft
 *
 * The unfinished request for another service, if the customer has one, and
 * what that service is called — for the notice at the top of the details form
 * that says what Continue there will do to it.
 *
 * ⚠️ There is one draft (`RequestDraftContext`). Opening a different service
 * leaves it alone — the details form writes nothing into another service's
 * draft — but Continue there replaces it. A customer should be told that before
 * they press it, not find out on Home afterwards that the leak repair they left
 * half-done has gone (lead decision after review, 2026-10-21).
 *
 * Only a draft worth keeping counts (`isDraftWorthKeeping`): one emptied back
 * out is nothing to lose, and the form treats it as no draft at all.
 *
 * The name is the category's, looked up in the catalogue by the draft's
 * `categoryId` — exactly how Home's resume card names the same draft — and it is
 * display only: it is never put in a route or anywhere else.
 *
 * ⚠️ Except within the same category, where it is never the bare category. An
 * unfinished Switch Repair announced as "a request for Electrician" on an
 * Electrician form reads as if it were this request (found in review). There:
 *
 * - while this category's services are still being read, nothing is said yet
 *   (`isNamed` false) — so the category's name never flashes up first;
 * - once they answer, the other draft's service is named ("Switch Repair");
 * - if that read failed, or the service is no longer listed, it is "another
 *   Electrician service" — still not this one.
 *
 * In another category it is that category's name. Both lists are the ones the
 * form has already read for its own names, handed in, so naming the other
 * request costs no second read. While the catalogue cannot name a category —
 * still loading, failed, or the category is gone — the name is absent and the
 * notice says "a service".
 */

import { useMemo } from 'react';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useRequestDraft } from '@/features/customer/state/RequestDraftContext';
import { isDraftWorthKeeping, type RequestDraft } from '@/features/customer/state/requestDraft';
import type { ServiceCategory, SubCategory } from '@/shared/services/types/CategoryService';

export interface OtherRequestDraft {
  /** Another service's draft with something in it, or null. */
  draft: RequestDraft | null;
  /**
   * Whether it can be named yet. False only for a draft in this form's own
   * category while its services are still being read: say nothing until then.
   */
  isNamed: boolean;
  /**
   * What to call it: its service, or "another <category> service", when it is
   * in this form's category; otherwise its category. Absent when the catalogue
   * cannot say, and the notice then says "a service".
   */
  serviceName?: string;
}

/** What the form already knows about names: the catalogue, and this category's services. */
export interface KnownNames {
  catalogue?: ServiceCategory[];
  services?: SubCategory[];
  /** Whether `services` is still being read (its first read, or a retry). */
  isLoading?: boolean;
}

export function useOtherRequestDraft(
  categoryId: string,
  subCategoryId: string,
  known: KnownNames,
): OtherRequestDraft {
  const { draft } = useRequestDraft();

  const other =
    draft !== null && draft.subCategoryId !== subCategoryId && isDraftWorthKeeping(draft)
      ? draft
      : null;

  const { catalogue, services, isLoading = false } = known;

  const sameCategory = other !== null && other.categoryId === categoryId;

  const serviceName = useMemo(() => {
    if (!other) {
      return undefined;
    }

    const categoryName = catalogue?.find(category => category.id === other.categoryId)?.name;
    if (!sameCategory) {
      return categoryName;
    }

    // Same category: the category's own name would read as this request.
    const subCategoryName = services?.find(service => service.id === other.subCategoryId)?.name;
    if (subCategoryName) {
      return subCategoryName;
    }

    // The services could not be read, or that one is gone: still not this one.
    return categoryName
      ? CUSTOMER_COPY.createRequest.otherDraftSameCategory.replace('{category}', categoryName)
      : undefined;
  }, [other, sameCategory, catalogue, services]);

  return {
    draft: other,
    isNamed: !(sameCategory && services === undefined && isLoading),
    serviceName,
  };
}
