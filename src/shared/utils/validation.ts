/**
 * Client-side validation for UX only. The backend remains the authority and its
 * field errors are merged in by `mergeFieldErrors`.
 */

import type { AppError } from '@/shared/types/error';

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

export const validators = {
  required: (value: string, label: string) => (value.trim() ? undefined : `${label} is required.`),
  email: (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? undefined : 'Enter a valid email address.',
  phone: (value: string) =>
    /^\+?[0-9]{10,15}$/.test(value.replace(/[\s-]/g, '')) ? undefined : 'Enter a valid phone number (10–15 digits).',
  password: (value: string) => (value.length >= 8 ? undefined : 'Password must be at least 8 characters.'),
  minLength: (value: string, min: number, label: string) =>
    value.trim().length >= min ? undefined : `${label} must be at least ${min} characters.`,
};

/** Normalises a phone number the way the backend stores it. */
export const normalizePhone = (value: string) => value.replace(/[\s-]/g, '');

export function compact<K extends string>(errors: FieldErrors<K>): FieldErrors<K> {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => Boolean(v))) as FieldErrors<K>;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** Pulls backend field errors (e.g. "email already exists") onto the form. */
export function mergeFieldErrors<K extends string>(error: AppError | null, keys: readonly K[]): FieldErrors<K> {
  if (!error?.fieldErrors) {
    return {};
  }
  const result: FieldErrors<K> = {};
  keys.forEach(key => {
    const message = error.fieldErrors?.[key];
    if (message) {
      result[key] = message;
    }
  });
  return result;
}
