/**
 * TextField
 *
 * Labelled input with inline validation message (App PROJECT_BIBLE §49 —
 * validation errors appear beside the relevant field).
 */

import React, { forwardRef, memo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme } from '@/shared/theme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  helper?: string;
  secure?: boolean;
  optional?: boolean;
}

const TextFieldComponent = forwardRef<TextInput, TextFieldProps>(function TextFieldComponent(
  { label, error, helper, secure = false, optional = false, multiline, testID, ...rest },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);

  const borderColor = error ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.border;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label" color="textSecondary">
        {label}
        {optional ? <Text variant="caption" color="textTertiary"> (optional)</Text> : null}
      </Text>
      <View
        style={[
          styles.inputRow,
          {
            borderColor,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surface,
            minHeight: multiline ? 96 : theme.hitSlop.minTarget + 4,
            paddingHorizontal: theme.spacing.md,
          },
        ]}>
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={label}
          placeholderTextColor={theme.colors.textTertiary}
          secureTextEntry={hidden}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            theme.typography.variants.body,
            {
              color: theme.colors.textPrimary,
              paddingVertical: theme.spacing.md,
              textAlignVertical: multiline ? 'top' : 'center',
            },
          ]}
          {...rest}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden(h => !h)}
            hitSlop={12}>
            <Text variant="label" color="primary">
              {hidden ? 'Show' : 'Hide'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={[styles.row, { gap: theme.spacing.xs }]}>
          <Icon name="error" size="xs" color="danger" />
          <Text variant="caption" color="danger" testID={testID ? `${testID}-error` : undefined}>
            {error}
          </Text>
        </View>
      ) : helper ? (
        <Text variant="caption" color="textTertiary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  input: { flex: 1, outlineStyle: 'none' } as object,
  row: { flexDirection: 'row', alignItems: 'center' },
});

export const TextField = memo(TextFieldComponent);
