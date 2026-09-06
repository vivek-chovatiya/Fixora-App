/**
 * useCreateRequest
 *
 * Raises a request (PROJECT_BIBLE.md section 13).
 *
 *   Screen → hook → RequestService interface → implementation
 *
 * ⚠️ This is where the form's values become the service's payload, and the
 * translation is the whole job. The controls hold what a control can hold — an
 * empty string for "no preference", whatever the customer typed in the notes
 * box — and `CreateRequestInput` takes optional fields. Passing the form
 * straight through would send empty strings where the contract means "not
 * answered", so the mapping is explicit and lives in one place rather than being
 * assembled at the call site.
 *
 * The identifiers come from the route and go through untouched. Nothing the
 * screen resolved for display — the category's name, the service's name, a
 * glyph — is anywhere near the payload.
 */

import { useCallback } from 'react';

import { toOptionalValue } from '@/features/customer/constants/requestScheduling';
import type { CreateRequestForm } from '@/features/customer/validation/requestSchemas';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { getService } from '@/shared/services/ServiceRegistry';
import type { CreateRequestInput, CreatedRequest } from '@/shared/services/types/RequestService';
import type { AppError } from '@/shared/types/error';

export interface RequestSubmission {
  /**
   * Resolves with the created request, or `null` when the call failed.
   *
   * `vendorId` is omitted for open dispatch rather than passed as a sentinel —
   * see `CreateRequestInput.vendorId`.
   */
  submit: (
    values: CreateRequestForm,
    imageUrls: string[],
    vendorId?: string,
  ) => Promise<CreatedRequest | null>;
  isSubmitting: boolean;
  error: AppError | null;
  /** Clears a failure so the retry starts from a clean state. */
  reset: () => void;
}

/**
 * Builds the payload.
 *
 * Exported for its test rather than for reuse: what this screen sends is the
 * part of it worth pinning down, and pinning it down through the screen would
 * mean asserting on a mock call instead of on the rule.
 */
export function buildCreateRequestInput(
  categoryId: string,
  subCategoryId: string,
  values: CreateRequestForm,
  imageUrls: string[],
  vendorId?: string,
): CreateRequestInput {
  return {
    categoryId,
    subCategoryId,
    priority: values.priority,
    preferredDate: toOptionalValue(values.preferredDate),
    preferredTime: toOptionalValue(values.preferredTime),
    // Omitted rather than sent empty. An empty array is a statement that there
    // are no photographs; the absent field is the absence of the question.
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    /*
      Sent exactly as typed, or not at all.

      Only emptiness is judged, and only to decide whether the field is there.
      Trimming would be the app editing someone's description of their own
      problem, and the schema deliberately does not do it either.
    */
    notes: values.notes.trim().length > 0 ? values.notes : undefined,
    /*
      Passed through exactly as given, absence included.

      There is no branch here and deliberately no default. Whether the customer
      chose a vendor is the vendor screen's answer; this only has to avoid
      turning "nobody" into somebody, which any fallback value would do.
    */
    vendorId,
  };
}

export function useCreateRequest(categoryId: string, subCategoryId: string): RequestSubmission {
  const mutation = useServiceMutation((input: CreateRequestInput) =>
    getService('request').createRequest(input),
  );

  const { mutate } = mutation;

  const submit = useCallback(
    (values: CreateRequestForm, imageUrls: string[], vendorId?: string) =>
      mutate(buildCreateRequestInput(categoryId, subCategoryId, values, imageUrls, vendorId)),
    [mutate, categoryId, subCategoryId],
  );

  return {
    submit,
    isSubmitting: mutation.isSubmitting,
    error: mutation.error,
    reset: mutation.reset,
  };
}
