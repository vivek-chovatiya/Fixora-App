import React, { memo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/shared/components/Text';
import { useTheme } from '@/shared/theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
  tone?: 'primary' | 'danger';
}

/** Selection pill. Selected state is a soft tint + coloured border rather than a solid fill. */
function ChipComponent({ label, selected = false, onPress, testID, tone = 'primary' }: ChipProps) {
  const theme = useTheme();
  const accent = tone === 'danger' ? theme.colors.danger : theme.colors.primary;
  const accentSubtle = tone === 'danger' ? theme.colors.dangerSubtle : theme.colors.primarySubtle;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 36,
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: selected ? accent : theme.colors.border,
        backgroundColor: selected ? accentSubtle : pressed ? theme.colors.surfaceAlt : theme.colors.surface,
      })}>
      <Text variant="label" style={{ color: selected ? accent : theme.colors.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

export const Chip = memo(ChipComponent);

/** Equal-width segmented switch for 2–3 mutually exclusive modes (e.g. customer / provider). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testIDPrefix?: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', padding: 4, gap: 4, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt }}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testIDPrefix ? `${testIDPrefix}-${option.value}` : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 40,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.sm,
              borderRadius: theme.radius.sm + 2,
              backgroundColor: selected ? theme.colors.surface : 'transparent',
              borderWidth: selected ? 1 : 0,
              borderColor: theme.colors.border,
            }}>
            <Text variant="label" color={selected ? 'textPrimary' : 'textSecondary'} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface ChipGroupProps<T extends string> {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  /** Single swipeable row instead of wrapping lines. */
  scroll?: boolean;
  /** Horizontal inset for a scrolling row; use 0 when the parent already pads the screen. */
  inset?: number;
  testIDPrefix?: string;
  toneFor?: (value: T) => 'primary' | 'danger';
}

export function ChipGroup<T extends string>({ options, value, onChange, scroll = false, inset, testIDPrefix, toneFor }: ChipGroupProps<T>) {
  const theme = useTheme();
  const chips = options.map(option => (
    <Chip
      key={option.value}
      label={option.label}
      selected={option.value === value}
      onPress={() => onChange(option.value)}
      testID={testIDPrefix ? `${testIDPrefix}-${option.value}` : undefined}
      tone={toneFor ? toneFor(option.value) : 'primary'}
    />
  ));

  if (scroll) {
    const padding = inset ?? theme.screenPadding;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={padding === 0 ? { marginHorizontal: -theme.screenPadding } : undefined}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingHorizontal: padding === 0 ? theme.screenPadding : padding }}>
        {chips}
      </ScrollView>
    );
  }
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>{chips}</View>;
}
