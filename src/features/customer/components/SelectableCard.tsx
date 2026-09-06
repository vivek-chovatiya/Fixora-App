/**
 * SelectableCard
 *
 * One option in a set where exactly one is chosen, at the size of a card.
 *
 * ⚠️ It owns the chrome, not the content. Border, tint, tick, press feedback and
 * the radio semantics live here so a vendor and "no preference" cannot drift
 * apart — they are alternatives in one group, and an option that looked or
 * announced itself differently would read as a different kind of thing.
 *
 * Selected is said four ways: the fill changes, the border thickens and takes
 * the brand colour, a tick appears, and the node reports itself checked.
 * PROJECT_BIBLE.md section 46 does not allow a state to rest on colour, and here
 * it would be resting on colour twice over.
 *
 * The whole card is one control and one announcement. Its children are hidden
 * from assistive technology, so a screen reader hears "Sharma Electricals, 4.8
 * stars, 126 reviews, 2 km away — selected" as one thing rather than walking
 * five separate nodes inside a button.
 *
 * `SelectionChip` is the same idea at the size of a word. They are not merged:
 * a chip is a value in a row of values, a card is an entity with a name and
 * supporting detail, and one component doing both would be configured into
 * being two anyway.
 */

import React, { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableStateCallbackType } from 'react-native';

import { Icon } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface SelectableCardProps {
  children: ReactNode;
  selected: boolean;
  onPress: () => void;
  /** The whole card's spoken name. Children are hidden behind it. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
}

function SelectableCardComponent({
  children,
  selected,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: SelectableCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, checked: selected }}
      style={({ pressed }: PressableStateCallbackType) => [
        styles.card,
        {
          minHeight: theme.hitSlop.minTarget,
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          borderRadius: theme.radius.lg,
          backgroundColor: selected ? theme.colors.primarySubtle : theme.colors.surface,
          // Thickens rather than merely changing colour, for the same reason the
          // text fields do: a line that only changes hue is a line that changed
          // nothing for a good number of readers.
          borderWidth: selected ? theme.borderWidth.thick : theme.borderWidth.thin,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
        pressed && { opacity: theme.opacity.pressed },
      ]}>
      {/*
        Hidden as a group, not individually. The card's label already says
        everything inside it, and leaving the children exposed would put a name,
        a rating and an area into the focus order as separate stops inside a
        control that is meant to be one.
      */}
      <View
        style={styles.body}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {children}
      </View>

      {/*
        Reserved whether or not it is filled, so nothing reflows as the selection
        moves down the list.
      */}
      <View style={[styles.tick, { width: theme.iconSize.lg, height: theme.iconSize.lg }]}>
        {selected ? <Icon name="selected" size="lg" color="primary" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    // Takes the slack, so a long vendor name wraps inside the card rather than
    // pushing the tick off the end of it.
    flex: 1,
  },
  tick: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const SelectableCard = memo(SelectableCardComponent);
