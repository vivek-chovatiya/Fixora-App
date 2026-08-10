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
  data: TResult | undefined;
  error: AppError | null;
  isSubmitting: boolean;
  isError: boolean;
  reset: () => void;
}

export function useServiceMutation<TArgs extends unknown[], TResult>(
  mutator: (...args: TArgs) => Promise<TResult>,
): UseServiceMutationResult<TArgs, TResult> {
  const [data, setData] = useState<TResult | undefined>(undefined);
  const [error, setError] = useState<AppError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mountedRef = useRef(true);
  const mutatorRef = useRef(mutator);
  mutatorRef.current = mutator;

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
      if (mountedRef.current) {
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
