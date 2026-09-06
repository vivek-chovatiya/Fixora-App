/**
 * SelectionChip
 *
 * One option in a set where exactly one is chosen.
 *
 * ⚠️ Selected is said three ways, and that is the point. PROJECT_BIBLE.md
 * section 46 does not allow a state to be carried by colour alone, so a chosen
 * chip fills, changes its text weight and gains a tick — and announces itself
 * with the radio role, which is what a screen reader needs to say "one of four,
 * this one" rather than reading four unrelated buttons.
 *
 * It exists because priority, preferred date and preferred time are the same
 * interaction three times on one screen. It is a chip, not a selection
 * framework: it owns no group, no keyboard model and no value type, so the rail
 * or row above it stays responsible for what "one of" means.
 */

import React, { memo } from 'react';
import { Pressable, StyleSheet, type PressableStateCallbackType } from 'react-native';

import { Icon, Text } from '@/shared/components';
import { useTheme, type ColorTokens, type IconName } from '@/shared/theme';

export interface SelectionChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /**
   * Drawn ahead of the label when selected, in place of the tick.
   *
   * For a set whose options mean different things rather than merely different
   * values — priority, where the glyph carries urgency the tick cannot.
   */
  icon?: IconName;
  /**
   * Colour for the selected fill. Defaults to the brand.
   *
   * Supplied so an emergency reads as one. It is never the only difference
   * between chosen and unchosen; it sits on top of the fill, the weight and the
   * glyph that are already saying it.
   */
  tone?: keyof ColorTokens;
  accessibilityHint?: string;
  testID?: string;
}

function SelectionChipComponent({
  label,
  selected,
  onPress,
  icon,
  tone = 'primary',
  accessibilityHint,
  testID,
}: SelectionChipProps) {
  const theme = useTheme();

  const glyph: IconName | undefined = selected ? (icon ?? 'selected') : icon;

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      // Radio rather than button: these are alternatives, and the role is what
      // makes assistive technology say so.
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }: PressableStateCallbackType) => [
        styles.chip,
        {
          minHeight: theme.hitSlop.minTarget,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.xs,
          borderRadius: theme.radius.full,
          backgroundColor: selected ? theme.colors[tone] : theme.colors.surface,
          // The unchosen chip is defined by its outline, the chosen one by its
          // fill. Keeping the border on both stops the row changing height or
          // width as the selection moves along it.
          borderWidth: theme.borderWidth.thin,
          borderColor: selected ? theme.colors[tone] : theme.colors.border,
        },
        pressed && { opacity: theme.opacity.pressed },
      ]}>
      {glyph ? (
        <Icon name={glyph} size="sm" color={selected ? 'onPrimary' : 'textTertiary'} />
      ) : null}

      <Text
        variant={selected ? 'bodyStrong' : 'body'}
        color={selected ? 'onPrimary' : 'textPrimary'}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const SelectionChip = memo(SelectionChipComponent);
