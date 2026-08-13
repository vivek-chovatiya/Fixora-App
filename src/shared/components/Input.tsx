/**
 * Input
 *
 * The only text entry primitive, plus the named variants the naming convention
 * calls for (CLAUDE.md section 15).
 *
 * The error message renders directly beneath the field rather than in a banner,
 * which is what PROJECT_BIBLE.md section 49 requires for validation failures.
 *
 * Forwards its ref so a form can move focus from one field to the next — a login
 * screen cannot wire "next" on the keyboard without it.
 */

import React, { forwardRef, memo, useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme, type IconName } from '@/shared/theme';

/**
 * Derived from TextInputProps rather than imported. React Native renamed these
 * event types in 0.86, so deriving them keeps this compiling across versions.
 */
type FocusEventArg = Parameters<NonNullable<TextInputProps['onFocus']>>[0];
type BlurEventArg = Parameters<NonNullable<TextInputProps['onBlur']>>[0];

export interface InputProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  label?: string;
  /** Validation message. Its presence puts the field into the error state. */
  error?: string;
  /** Guidance shown while there is no error. */
  helperText?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  /**
   * Accessible name for the right icon when it is pressable. Without one a
   * screen reader announces only "button", which says nothing about what it
   * does — an icon is not a name.
   */
  rightIconAccessibilityLabel?: string;
  /** Appends a marker to the label and flags the field to assistive tech. */
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

const InputComponent = forwardRef<TextInput, InputProps>(function InputBase(
  {
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    onRightIconPress,
    rightIconAccessibilityLabel,
    required = false,
    containerStyle,
    editable = true,
    onFocus,
    onBlur,
    accessibilityLabel,
    ...rest
  },
  ref,
) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const hasError = Boolean(error);

  const handleFocus = useCallback(
    (event: FocusEventArg) => {
      setIsFocused(true);
      onFocus?.(event);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (event: BlurEventArg) => {
      setIsFocused(false);
      onBlur?.(event);
    },
    [onBlur],
  );

  // Error outranks focus: a focused invalid field must still read as invalid.
  const borderColor = hasError
    ? theme.colors.danger
    : isFocused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View style={[{ gap: theme.spacing.xs }, containerStyle]}>
      {label ? (
        <Text variant="label" color={editable ? 'textSecondary' : 'textDisabled'}>
          {label}
          {required ? ' *' : ''}
        </Text>
      ) : null}

      <View
        style={[
          styles.field,
          {
            borderColor,
            borderRadius: theme.radius.md,
            backgroundColor: editable ? theme.colors.surface : theme.colors.surfaceAlt,
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.sm,
            minHeight: theme.hitSlop.minTarget,
          },
        ]}>
        {leftIcon ? <Icon name={leftIcon} size="md" color="textTertiary" /> : null}

        <TextInput
          ref={ref}
          editable={editable}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={theme.colors.textTertiary}
          style={[
            styles.input,
            theme.typography.variants.body,
            { color: editable ? theme.colors.textPrimary : theme.colors.textDisabled },
          ]}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled: !editable }}
          // Announces the validation message rather than leaving a screen
          // reader to discover the error text as unrelated content.
          accessibilityHint={error}
          {...rest}
        />

        {rightIcon ? (
          onRightIconPress ? (
            <Pressable
              onPress={onRightIconPress}
              accessibilityRole="button"
              accessibilityLabel={rightIconAccessibilityLabel}
              hitSlop={theme.spacing.sm}>
              <Icon name={rightIcon} size="md" color="textSecondary" />
            </Pressable>
          ) : (
            <Icon name={rightIcon} size="md" color="textTertiary" />
          )
        ) : null}
      </View>

      {hasError ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : helperText ? (
        <Text variant="caption" color="textTertiary">
          {helperText}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  input: {
    flex: 1,
    // Android adds vertical padding that misaligns the text against icons.
    paddingVertical: 0,
  },
});

export const Input = memo(InputComponent);

/* Named variants ---------------------------------------------------------- */

export type EmailInputProps = Omit<InputProps, 'keyboardType' | 'autoCapitalize'>;

export const EmailInput = memo(
  forwardRef<TextInput, EmailInputProps>(function EmailInputBase(props, ref) {
    return (
      <Input
        ref={ref}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        {...props}
      />
    );
  }),
);

export type PhoneInputProps = Omit<InputProps, 'keyboardType' | 'autoCapitalize'>;

/**
 * A variant, not a new component: formatting, normalisation and validation stay
 * out of it, so there is still exactly one text entry primitive.
 *
 * `leftIcon` is a default rather than a fixed value — it sits before the spread
 * so a caller can still override or drop it.
 */
export const PhoneInput = memo(
  forwardRef<TextInput, PhoneInputProps>(function PhoneInputBase(props, ref) {
    return (
      <Input
        ref={ref}
        leftIcon="call"
        keyboardType="phone-pad"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="tel"
        textContentType="telephoneNumber"
        {...props}
      />
    );
  }),
);

export interface PasswordInputProps
  extends Omit<
    InputProps,
    'secureTextEntry' | 'rightIcon' | 'onRightIconPress' | 'rightIconAccessibilityLabel'
  > {
  /**
   * Accessible name for the reveal control in each of its two states. The
   * defaults are deliberately bare: a field holding something other than a
   * password should name what it is revealing.
   */
  revealLabel?: string;
  hideLabel?: string;
}

/**
 * Owns its reveal state. This is presentation state belonging to one field, so
 * lifting it to the form would only add wiring (CLAUDE.md section 12).
 *
 * Revealing is presentation and nothing else: the value is untouched, and the
 * toggle neither submits nor validates.
 */
export const PasswordInput = memo(
  forwardRef<TextInput, PasswordInputProps>(function PasswordInputBase(
    { revealLabel = 'Show', hideLabel = 'Hide', ...props },
    ref,
  ) {
    const [isVisible, setIsVisible] = useState(false);

    const toggle = useCallback(() => {
      setIsVisible(current => !current);
    }, []);

    return (
      <Input
        ref={ref}
        secureTextEntry={!isVisible}
        autoCapitalize="none"
        autoCorrect={false}
        rightIcon={isVisible ? 'visibilityOff' : 'visibilityOn'}
        onRightIconPress={toggle}
        rightIconAccessibilityLabel={isVisible ? hideLabel : revealLabel}
        {...props}
      />
    );
  }),
);

export interface SearchInputProps
  extends Omit<InputProps, 'leftIcon' | 'rightIcon' | 'onRightIconPress'> {
  onClear?: () => void;
}

export const SearchInput = memo(
  forwardRef<TextInput, SearchInputProps>(function SearchInputBase({ onClear, value, ...props }, ref) {
    const hasValue = Boolean(value);

    return (
      <Input
        ref={ref}
        value={value}
        leftIcon="search"
        rightIcon={hasValue && onClear ? 'close' : undefined}
        onRightIconPress={hasValue ? onClear : undefined}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
    );
  }),
);
