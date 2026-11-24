/**
 * useFormErrors
 *
 * Holds client validation errors for a form and hides a field's error (client
 * or server) as soon as the user edits that field. Submitting again clears the
 * "edited" marks, so any error that still applies reappears.
 *
 *   const form = useFormErrors<'email' | 'phone'>();
 *   onChangeText={v => { setEmail(v); form.edited('email'); }}
 *   onSubmit: form.setErrors(next)
 *   error={form.errorFor('email', serverErrors.email)}
 */

import { useCallback, useState } from 'react';

import type { FieldErrors } from '@/shared/utils/validation';

export function useFormErrors<K extends string>() {
  const [errors, setErrorsState] = useState<FieldErrors<K>>({});
  const [editedKeys, setEditedKeys] = useState<ReadonlySet<K>>(() => new Set());

  const setErrors = useCallback((next: FieldErrors<K>) => {
    setErrorsState(next);
    setEditedKeys(new Set());
  }, []);

  const edited = useCallback((key: K) => {
    setEditedKeys(prev => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);

  const errorFor = useCallback(
    (key: K, serverError?: string | null) => (editedKeys.has(key) ? undefined : errors[key] ?? serverError ?? undefined),
    [editedKeys, errors],
  );

  return { errors, setErrors, edited, errorFor };
}
