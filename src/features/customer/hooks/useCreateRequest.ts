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
 *
 * It is also where section 54's `request_created` is sent, because this is the
 * one place that sees the service say yes: once per request the backend
 * created, never for a send that failed, and the next attempt after a failure
 * counts only if that one succeeds.
 *
 * ⚠️ The event describes the request by its shape — identifiers, the priority
 * constant, counts and flags — and never by its content. No notes, no address,
 * no photograph URL, no date or time: whether a preference was given is the
 * whole of what analytics learns about one (section 54, and AnalyticsService's
 * own rule).
 */

import { useCallback } from 'react';

import { toOptionalValue } from '@/features/customer/constants/requestScheduling';
import type { CreateRequestForm } from '@/features/customer/validation/requestSchemas';
import { useAnalytics } from '@/shared/hooks/useAnalytics';
import { useServiceMutation } from '@/shared/hooks/useServiceMutation';
import { getService } from '@/shared/services/ServiceRegistry';
import type { AnalyticsProperties } from '@/shared/services/types/AnalyticsService';
import type {
  CreateRequestInput,
  CreatedRequest,
  RequestAddress,
} from '@/shared/services/types/RequestService';
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
    address: RequestAddress,
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
  address: RequestAddress,
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
      Passed through whole, and positioned before `vendorId` for a reason: this
      is the one field on the payload that no backend has agreed to yet. It is
      the frontend's `RequestAddress`, and when the server publishes its own
      shape the translation belongs here — in the one function that turns what
      the customer said into what the API is sent — and nowhere else.

      Not reshaped, not flattened, not trimmed. Whatever the customer confirmed
      on the address screen is what is sent; this function decides the payload's
      structure, never its content.
    */
    address,
    /*
      Passed through exactly as given, absence included.

      There is no branch here and deliberately no default. Whether the customer
      chose a vendor is the vendor screen's answer; this only has to avoid
      turning "nobody" into somebody, which any fallback value would do.
    */
    vendorId,
  };
}

/**
 * What `request_created` says about a request: read off the payload that was
 * accepted, so the event describes exactly what was sent, and the backend's
 * reference for it.
 *
 * Date and time are two flags because section 14 makes them two independent
 * answers — a day with no hour, or an hour on any day — and one flag for both
 * could not say which was given.
 */
function describeCreatedRequest(
  created: CreatedRequest,
  input: CreateRequestInput,
): AnalyticsProperties {
  return {
    requestId: created.id,
    categoryId: input.categoryId,
    subCategoryId: input.subCategoryId,
    priority: input.priority,
    // Directed when a vendor was named; absent is open dispatch (section 18A).
    directed: input.vendorId !== undefined,
    photoCount: input.imageUrls?.length ?? 0,
    hasPreferredDate: input.preferredDate !== undefined,
    hasPreferredTime: input.preferredTime !== undefined,
  };
}

export function useCreateRequest(categoryId: string, subCategoryId: string): RequestSubmission {
  const mutation = useServiceMutation((input: CreateRequestInput) =>
    getService('request').createRequest(input),
  );

  const { mutate } = mutation;
  const { track } = useAnalytics();

  const submit = useCallback(
    async (
      values: CreateRequestForm,
      imageUrls: string[],
      address: RequestAddress,
      vendorId?: string,
    ) => {
      const input = buildCreateRequestInput(
        categoryId,
        subCategoryId,
        values,
        imageUrls,
        address,
        vendorId,
      );
      const created = await mutate(input);

      // Null is a failure, already surfaced through `error`; nothing was created.
      if (created) {
        track('request_created', describeCreatedRequest(created, input));
      }
      return created;
    },
    [mutate, track, categoryId, subCategoryId],
  );

  return {
    submit,
    isSubmitting: mutation.isSubmitting,
    error: mutation.error,
    reset: mutation.reset,
  };
}
