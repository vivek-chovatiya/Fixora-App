/**
 * PrioritySelector
 *
 * How urgent the job is (PROJECT_BIBLE.md section 15).
 *
 * ⚠️ It renders the values it is given and sends back the value it was given.
 * The labels, tones and glyphs come from the same presentation table the request
 * cards use, so "EMERGENCY" reads as "Emergency" in exactly one place in the
 * application — and the constant itself, not the label, is what leaves this
 * component.
 *
 * Wrapped rather than scrolled. Four options fit two lines on the narrowest
 * screen supported, and a horizontal rail would hide the fourth — which here is
 * "Emergency", the one option nobody should have to discover.
 */

import React, { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { SelectionChip } from '@/features/customer/components/SelectionChip';
import { presentPriority } from '@/features/customer/constants/requestPresentation';
import { useTheme } from '@/shared/theme';

export interface PrioritySelectorProps {
  /** Backend constants, in the order they should be offered. */
  options: readonly string[];
  /** The chosen constant, or an empty string before anything is chosen. */
  value: string;
  onChange: (priority: string) => void;
  /** Names the group, so the chips are not four loose radios. */
  accessibilityLabel: string;
  testID?: string;
}

/** Maps the presentation tone onto the fill a chosen chip takes. */
const TONE_COLOR = Object.freeze({
  neutral: 'neutral',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} as const);

function PriorityOption({
  priority,
  selected,
  onChange,
}: {
  priority: string;
  selected: boolean;
  onChange: (priority: string) => void;
}) {
  const presentation = presentPriority(priority);
  const handlePress = useCallback(() => onChange(priority), [onChange, priority]);

  return (
    <SelectionChip
      label={presentation.label}
      selected={selected}
      onPress={handlePress}
      icon={presentation.icon}
      tone={TONE_COLOR[presentation.tone]}
      testID={`priority-${priority}`}
    />
  );
}

function PrioritySelectorComponent({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: PrioritySelectorProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.group, { gap: theme.spacing.sm }]}
      testID={testID}>
      {options.map(priority => (
        <PriorityOption
          key={priority}
          priority={priority}
          selected={priority === value}
          onChange={onChange}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

export const PrioritySelector = memo(PrioritySelectorComponent);
