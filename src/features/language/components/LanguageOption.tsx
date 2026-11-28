/**
 * LanguageOption
 *
 * One language in the chooser: its name in its own script, what it is called
 * in the language the app speaks now beneath it, and a tick when it is the one
 * selected. A radio — the chooser holds one answer of three.
 *
 * ⚠️ A sibling of the customer feature's `SelectableCard`, not a use of it, and
 * drawn to match it exactly (the same tint, border, tick and press). That card
 * lives in `features/customer`, and a feature does not import another
 * feature's components; promoting it to `shared/components` would be a change
 * to a component four customer screens are verified against, which this slice
 * was not asked to make. If the owner approves that promotion, this file
 * becomes a `SelectableCard` with two lines of text inside and is deleted.
 *
 * The two names are spoken together ("हिन्दी, Hindi") so a screen reader whose
 * voice cannot read one script still says the other.
 */

import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View, type PressableStateCallbackType } from 'react-native';

import type { AppLocale } from '@/core/i18n';
import { Icon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface LanguageOptionProps {
  locale: AppLocale;
  /** In its own script. */
  name: string;
  /** In the app's current language, or null when it would repeat `name`. */
  localName: string | null;
  selected: boolean;
  onSelect: (locale: AppLocale) => void;
  accessibilityHint?: string;
  testID?: string;
}

function LanguageOptionComponent({
  locale,
  name,
  localName,
  selected,
  onSelect,
  accessibilityHint,
  testID,
}: LanguageOptionProps) {
  const theme = useTheme();
  const press = useCallback(() => onSelect(locale), [locale, onSelect]);

  return (
    <Pressable
      onPress={press}
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={localName ? `${name}, ${localName}` : name}
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
          // Thicker when chosen, not only another colour — as `SelectableCard`.
          borderWidth: selected ? theme.borderWidth.thick : theme.borderWidth.thin,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
        pressed && { opacity: theme.opacity.pressed },
      ]}>
      {/* One stop: the label above already says both names. */}
      <View
        style={[styles.body, { gap: theme.spacing.xxs }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Text variant="bodyStrong">{name}</Text>
        {localName ? (
          <Text variant="caption" color="textSecondary">
            {localName}
          </Text>
        ) : null}
      </View>

      {/* Reserved whether or not it is filled, so nothing moves as the tick does. */}
      <View style={[styles.tick, { width: theme.iconSize.lg, height: theme.iconSize.lg }]}>
        {selected ? <Icon name="selected" size="lg" color="onPrimarySubtle" /> : null}
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
    // Takes the slack, so a long name wraps inside the card at 360dp.
    flex: 1,
  },
  tick: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const LanguageOption = memo(LanguageOptionComponent);
