/**
 * ControlledInput
 *
 * Binds an Input to react-hook-form.
 *
 * This exists because vendor registration repeats the same twelve lines of
 * Controller wiring for five fields — value, onChangeText, onBlur and the error
 * message, identical every time. It is a binding, not a form abstraction: it
 * owns no layout, no submit, no schema and no field registry, so a screen that
 * needs something unusual still drops to `Controller` directly.
 *
 * `as` accepts the named Input variants (PhoneInput, EmailInput), so the
 * keyboard and autofill behaviour they encode is not re-specified per form.
 */

import React, { type ComponentType } from 'react';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';

import { Input, type InputProps } from '@/shared/components/Input';

/**
 * Generic over the variant's props, not just the base Input's, so a variant
 * that adds its own — PasswordInput's reveal labels, for instance — can still
 * be configured through here. Pinning this to InputProps made those props a
 * type error at every call site, which is what pushed callers back to writing
 * Controller by hand.
 */
// An intersection rather than an `interface extends`, which cannot extend a
// type parameter: its members have to be statically known.
export type ControlledInputProps<
  TFieldValues extends FieldValues,
  TInputProps extends InputProps = InputProps,
> = Omit<TInputProps, 'value' | 'onChangeText' | 'onBlur' | 'error'> & {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  /** Input variant to render. Defaults to the base Input. */
  as?: ComponentType<TInputProps>;
};

export function ControlledInput<
  TFieldValues extends FieldValues,
  TInputProps extends InputProps = InputProps,
>({ control, name, as, ...inputProps }: ControlledInputProps<TFieldValues, TInputProps>) {
  // The variant owns which props it accepts; this component only ever adds the
  // four react-hook-form supplies, and every variant accepts those.
  const Field = (as ?? Input) as ComponentType<InputProps>;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <Field
          {...(inputProps as InputProps)}
          // Only ever used for text fields. Coerced rather than cast so an
          // undefined default value renders as an empty controlled field
          // instead of switching the input to uncontrolled mid-edit.
          value={value === undefined || value === null ? '' : String(value)}
          onChangeText={onChange}
          onBlur={onBlur}
          error={error?.message}
        />
      )}
    />
  );
}
