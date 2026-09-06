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

import React, { forwardRef, memo, useCallback, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { FieldLabel } from '@/shared/components/FieldLabel';
import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme, type IconName, type RadiusToken } from '@/shared/theme';

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
  /**
   * Content pinned inside the field, ahead of the value.
   *
   * For a fixed part of the input that is not typed — a dialling code, a
   * currency, a unit. It is divided off from the value so the two do not read
   * as one string, and it is not a control: anything pressable belongs in
   * `rightIcon` or outside the field.
   */
  prefix?: ReactNode;
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
  /**
   * Corner radius of the field. A capsule by default.
   *
   * Exists for `multiline`, which the capsule cannot hold: at four lines tall a
   * 999 radius is a lozenge, and the text sits inside a shape that curves away
   * from it on every side. A notes box asks for a rounded rectangle, and this is
   * the smallest way to let one field say so without every other field in the
   * application changing shape.
   */
  radiusToken?: RadiusToken;
  containerStyle?: StyleProp<ViewStyle>;
}

const InputComponent = forwardRef<TextInput, InputProps>(function InputBase(
  {
    label,
    error,
    helperText,
    leftIcon,
    prefix,
    rightIcon,
    onRightIconPress,
    rightIconAccessibilityLabel,
    required = false,
    radiusToken = 'full',
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
  const isActive = hasError || isFocused;

  // Read from the props it was already given rather than added as a second way
  // of saying the same thing.
  const isMultiline = Boolean(rest.multiline);

  const borderColor = hasError
    ? theme.colors.danger
    : isFocused
      ? theme.colors.primary
      : theme.colors.border;

  /**
   * The line thickens as well as changing colour.
   *
   * Colour alone is not a state change anyone reliably notices in the corner of
   * their eye while typing, and on the error case it would be the only signal
   * separating a valid field from an invalid one — which PROJECT_BIBLE.md
   * section 46 does not allow to be carried by colour on its own.
   */
  const fieldBorderWidth = isActive ? theme.borderWidth.thick : theme.borderWidth.thin;

  /**
   * Label and message are indented to where the text inside the field starts.
   *
   * A rounded rectangle could get away with them flush to the column edge. A
   * capsule cannot: its content is inset by the radius, so a label at x=0 sits
   * visibly to the left of the value it names.
   */
  const textInset = { paddingHorizontal: theme.spacing.xl };

  return (
    <View style={[{ gap: theme.spacing.xs }, containerStyle]}>
      {label ? (
        <FieldLabel required={required} disabled={!editable} style={textInset}>
          {label}
        </FieldLabel>
      ) : null}

      <View
        style={[
          styles.field,
          {
            borderColor,
            borderWidth: fieldBorderWidth,
            // A capsule, and matched to the button beneath it. Two different
            // shapes stacked is what made a form read as parts rather than as
            // one column, so the field and its submit button share a radius as
            // well as a height.
            borderRadius: theme.radius[radiusToken],
            backgroundColor: editable ? theme.colors.surface : theme.colors.surfaceAlt,
            // Wider than a rectangle would need. A capsule curves away from its
            // own content, so text at a rectangle's padding looks like it is
            // leaning on the end cap.
            paddingHorizontal: theme.spacing.xl,
            gap: theme.spacing.md,
            // The shared control height, so a field and its submit button are
            // the same size rather than each sized to its own minimum.
            minHeight: theme.controlHeight,
          },
          // A growing field fills from the top. Centred is right for one line
          // and wrong for four, where it would leave the first line floating in
          // the middle of the box and the padding uneven as it grew.
          isMultiline && styles.multilineField,
          isMultiline && {
            paddingVertical: theme.spacing.md,
            // Opens at roughly four lines. A multiline field the height of a
            // single-line one looks like a single-line one, so nobody writes a
            // paragraph in it — and `numberOfLines` no longer sizes one on
            // Android, while `rows` is not in this version's types.
            minHeight: theme.controlHeight * 2,
          },
        ]}>
        {leftIcon ? <Icon name={leftIcon} size="md" color="textTertiary" /> : null}

        {prefix ? (
          <>
            {/*
              Ruled off on both sides, so the fixed part and the typed part read
              as two things. Without a rule "+91" and the number run together
              into one string that the user then tries to edit.
            */}
            {leftIcon ? <FieldDivider /> : null}
            {prefix}
            <FieldDivider />
          </>
        ) : null}

        <TextInput
          ref={ref}
          editable={editable}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={theme.colors.textTertiary}
          style={[
            styles.input,
            // Fills the taller box rather than sitting in the top of it. The row
            // aligns its children to the top so a multiline field starts at the
            // first line, and without this the input keeps its one-line height —
            // which looked right and left two thirds of the box untappable.
            isMultiline && styles.multilineInput,
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
        <Text variant="caption" color="danger" style={textInset}>
          {error}
        </Text>
      ) : helperText ? (
        <Text variant="caption" color="textTertiary" style={textInset}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
});

/**
 * The rule between a field's fixed part and its value.
 *
 * Inset from the pill's ends rather than run full height: a line touching a
 * rounded edge reads as a crack in the shape.
 */
function FieldDivider() {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.divider,
        {
          width: theme.borderWidth.thin,
          marginVertical: theme.spacing.sm,
          backgroundColor: theme.colors.border,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  multilineField: {
    alignItems: 'flex-start',
  },
  divider: {
    alignSelf: 'stretch',
  },
  input: {
    flex: 1,
    // Android adds vertical padding that misaligns the text against icons.
    paddingVertical: 0,
  },
  multilineInput: {
    alignSelf: 'stretch',
    textAlignVertical: 'top',
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
