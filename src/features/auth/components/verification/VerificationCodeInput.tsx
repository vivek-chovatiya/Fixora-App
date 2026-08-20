/**
 * VerificationCodeInput
 *
 * A fixed-length code entered into cells, which become the nodes of the
 * verification animation once the code is complete.
 *
 * There is one real text field here, held transparent over the drawing. The
 * cells are not inputs and never take focus individually: a code is one value,
 * and splitting it across N fields is what produces the familiar mess where
 * backspace lands in the wrong box and a pasted code fills only the first. The
 * field keeps the platform's keyboard, autofill and one-time-code handling; the
 * cells are what the user sees.
 *
 * `length` is required rather than defaulted. The two flows that use this both
 * take it from AppConfig, and a component that guessed would be encoding a code
 * shape it was never told.
 */

import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/shared/components/Text';
import { useTheme } from '@/shared/theme';

import { VerificationScene, type VerificationStatus } from './VerificationScene';

export interface VerificationCodeInputProps {
  value: string;
  onChangeText: (value: string) => void;
  /** How many cells to draw. Comes from configuration, never from this file. */
  length: number;
  status: VerificationStatus;
  /** Announced to assistive technology in place of the drawing. */
  accessibilityLabel: string;
  /** Validation message. Rendered below, and tints the cells. */
  error?: string;
  editable?: boolean;
  onSubmitEditing?: () => void;
  testID?: string;
}

function VerificationCodeInputComponent({
  value,
  onChangeText,
  length,
  status,
  accessibilityLabel,
  error,
  editable = true,
  onSubmitEditing,
  testID,
}: VerificationCodeInputProps) {
  const theme = useTheme();
  const fieldRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  /** One entry per cell: the character typed, or an empty string. */
  const characters = useMemo(
    () => Array.from({ length }, (_, index) => value[index] ?? ''),
    [value, length],
  );

  const handleChangeText = useCallback(
    (next: string) => {
      // Digits only, and never longer than the code. Trimming here rather than
      // relying on `maxLength` alone keeps a pasted string with spaces or a
      // trailing newline from arriving as a code that cannot match.
      onChangeText(next.replace(/\D/g, '').slice(0, length));
    },
    [onChangeText, length],
  );

  const focusField = useCallback(() => {
    fieldRef.current?.focus();
  }, []);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Pressable
        onPress={focusField}
        disabled={!editable}
        // The field below is the accessible control. This only widens where a
        // tap counts, so the whole drawing behaves like the field it fronts.
        accessible={false}
        style={styles.stage}>
        <VerificationScene
          status={status}
          characters={characters}
          focusedIndex={isFocused ? Math.min(value.length, length - 1) : undefined}
          hasError={error !== undefined}
          testID={testID === undefined ? undefined : `${testID}-scene`}
        />

        <TextInput
          ref={fieldRef}
          value={value}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={editable}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={length}
          returnKeyType="done"
          onSubmitEditing={onSubmitEditing}
          // The cells are the caret. A second one blinking over them, in a field
          // whose text is invisible, would sit in the wrong place by design.
          caretHidden
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled: !editable }}
          accessibilityHint={error}
          style={[StyleSheet.absoluteFill, styles.field]}
          testID={testID}
        />
      </Pressable>

      {error === undefined ? null : (
        <Text variant="caption" color="danger" align="center">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
  },
  /**
   * Present to the platform and to assistive technology, invisible to the eye.
   * `opacity: 0` rather than moving it off-screen, which on Android can drag the
   * scroll position to the field the moment it takes focus.
   */
  field: {
    opacity: 0,
  },
});

export const VerificationCodeInput = memo(VerificationCodeInputComponent);
