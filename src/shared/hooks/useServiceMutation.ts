/**
 * useServiceMutation
 *
 * Runs a write operation against a service, exposing submitting and error state
 * for forms and action buttons.
 *
 * Errors are returned rather than thrown so callers are never forced into a
 * try/catch inside a component, but they are always surfaced — never swallowed.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { createLogger } from '@/core/logger/Logger';
import { AppError } from '@/shared/types/error';

const log = createLogger('useServiceMutation');

export interface UseServiceMutationResult<TArgs extends unknown[], TResult> {
  /** Resolves with the result, or `null` when the mutation failed. */
  mutate: (...args: TArgs) => Promise<TResult | null>;
  /** The last result. Always undefined when `retainResult` is false. */
  data: TResult | undefined;
  error: AppError | null;
  isSubmitting: boolean;
  isError: boolean;
  reset: () => void;
}

export interface UseServiceMutationOptions {
  /**
   * Whether the last result is kept in hook state. Defaults to true.
   *
   * Set false when the result is a credential. `mutate` still resolves with it,
   * so the caller decides where it lives and for how long — but the hook stops
   * being a second place it is held, which is the difference between one owner
   * and two for something like the vendor auth code.
   */
  retainResult?: boolean;
}

export function useServiceMutation<TArgs extends unknown[], TResult>(
  mutator: (...args: TArgs) => Promise<TResult>,
  options: UseServiceMutationOptions = {},
): UseServiceMutationResult<TArgs, TResult> {
  const { retainResult = true } = options;
  const [data, setData] = useState<TResult | undefined>(undefined);
  const [error, setError] = useState<AppError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mountedRef = useRef(true);
  const mutatorRef = useRef(mutator);
  mutatorRef.current = mutator;

  const retainRef = useRef(retainResult);
  retainRef.current = retainResult;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutate = useCallback(async (...args: TArgs): Promise<TResult | null> => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await mutatorRef.current(...args);
      // Returned either way; only retention is optional.
      if (mountedRef.current && retainRef.current) {
        setData(result);
      }
      return result;
    } catch (caught) {
      const appError = AppError.from(caught);
      log.error('mutation failed', { kind: appError.kind, message: appError.message });
      if (mountedRef.current) {
        setError(appError);
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, []);

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setIsSubmitting(false);
  }, []);

  return { mutate, data, error, isSubmitting, isError: error !== null, reset };
}
