/**
 * ScheduleRail
 *
 * A horizontal run of choices, for the preferred date and the preferred time.
 *
 * ⚠️ The first option is "no preference", and it is selected until the customer
 * says otherwise. PROJECT_BIBLE.md section 14 makes both fields optional, and a
 * rail with nothing selected reads as a question not yet answered rather than as
 * one answered with a shrug — so having no preference is offered as a choice, in
 * the same shape as every other choice, first.
 *
 * Scrolled rather than wrapped, unlike priority: fourteen days and fourteen
 * hours wrapped into a block would take over the form, and unlike priority the
 * options are a sequence, so running out of sight to the right is the shape the
 * content already has.
 */

import React, { memo, useCallback } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { SelectionChip } from '@/features/customer/components/SelectionChip';
import type { ScheduleOption } from '@/features/customer/constants/requestScheduling';
import { useTheme } from '@/shared/theme';

export interface ScheduleRailProps {
  options: readonly ScheduleOption[];
  value: string;
  onChange: (value: string) => void;
  /** Names the group. Without it the rail is a run of unrelated radios. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
}

function RailOption({
  option,
  selected,
  onChange,
  accessibilityHint,
  testID,
}: {
  option: ScheduleOption;
  selected: boolean;
  onChange: (value: string) => void;
  accessibilityHint?: string;
  testID?: string;
}) {
  const handlePress = useCallback(() => onChange(option.value), [onChange, option.value]);

  return (
    <SelectionChip
      label={option.label}
      selected={selected}
      onPress={handlePress}
      accessibilityHint={accessibilityHint}
      testID={testID}
    />
  );
}

function ScheduleRailComponent({
  options,
  value,
  onChange,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ScheduleRailProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      // Bleeds to the screen edge and pads itself back, so a rail that runs off
      // the side looks like it continues rather than stopping at a margin.
      style={[styles.rail, { marginHorizontal: -theme.screenPadding }]}
      contentContainerStyle={{
        paddingHorizontal: theme.screenPadding,
        gap: theme.spacing.sm,
      }}
      testID={testID}>
      {options.map(option => (
        <RailOption
          key={option.value || 'any'}
          option={option}
          selected={option.value === value}
          onChange={onChange}
          accessibilityHint={accessibilityHint}
          testID={testID ? `${testID}-${option.value || 'any'}` : undefined}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: {
    // Without this the rail claims the height of the tallest thing it could
    // ever hold rather than the height of a chip.
    flexGrow: 0,
  },
});

export const ScheduleRail = memo(ScheduleRailComponent);
