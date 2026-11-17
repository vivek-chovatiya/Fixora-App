/**
 * FieldLabel
 *
 * The name above a form control, and the marker that says it is required.
 *
 * It exists because there is more than one kind of control. Input owns its own
 * label; a multi-select built from chips is not an Input and cannot borrow it,
 * so it wrote its own — and the two drifted. On the registration form the field
 * labels were primary text with an accented asterisk while the one above the
 * service chips was secondary text with a plain one, so a column of eleven
 * required fields had ten markers you could scan for and one you could not.
 *
 * The marker is inked rather than punctuated. As plain text in the label's own
 * colour it is a character at the end of a word; in the accent it is the only
 * thing on the row that is not prose, which is what makes it scannable.
 *
 * Indentation is the caller's business. A capsule field insets its own content
 * by its radius, so a label above one has to be pushed across to line up with
 * the value it names; a label above a row of chips does not.
 */

import React, { memo } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { Text } from '@/shared/components/Text';

export interface FieldLabelProps {
  children: string;
  /** Renders the accented required marker after the label. */
  required?: boolean;
  /** Greys the label to match a control that cannot be edited. */
  disabled?: boolean;
  style?: StyleProp<TextStyle>;
}

function FieldLabelComponent({ children, required, disabled, style }: FieldLabelProps) {
  return (
    // `textPrimary` rather than secondary: the label names the control, and a
    // control's name should not be quieter than the placeholder inside it.
    <Text
      variant="label"
      color={disabled ? 'textDisabled' : 'textPrimary'}
      style={style}>
      {children}
      {required ? (
        <Text variant="label" color="primary">
          {' *'}
        </Text>
      ) : null}
    </Text>
  );
}

export const FieldLabel = memo(FieldLabelComponent);
