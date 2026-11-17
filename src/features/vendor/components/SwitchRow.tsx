/**
 * SwitchRow
 *
 * A setting that is on or off: its name, a line saying what the current state
 * means, and a switch — the Profile tab's "Accepting new requests" and each
 * day's open or closed on the Working hours screen (PROJECT_BIBLE.md section
 * 38). Two consumers, one control, so the two can never behave differently.
 *
 * ⚠️ The whole row is the control, and it is one stop. A screen reader hears
 * the name, the role "switch" and on or off in one place — never the words,
 * then a separate unlabelled switch beside them — and a thumb that lands on
 * the words rather than the knob still flips it. The platform switch inside is
 * drawn for the eye only: hidden from assistive technology and given no
 * touches of its own, so the row's press is the only way it changes.
 *
 * ⚠️ Busy is said as well as shown. While the change it asked for is in the
 * air the row is locked — `disabled` and `busy` in its state — and a spinner
 * sits beside the switch, which already shows the value asked for. Both parts
 * of the state are present on every render: a state that becomes `undefined`
 * is not cleared on a view that is updated rather than remounted (see Lessons).
 *
 * It asks nothing and saves nothing. What a flip does — at once, after a
 * question, or only into a draft — is the caller's.
 */

import React, { memo, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  View,
  type PressableStateCallbackType,
} from 'react-native';

import { Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface SwitchRowProps {
  label: string;
  /** What the current state means, under the name. */
  description?: string;
  value: boolean;
  /** Called with the value the vendor asked for. */
  onValueChange: (value: boolean) => void;
  /** The change it asked for is in the air: locked, with a spinner. */
  isBusy?: boolean;
  disabled?: boolean;
  /** Spoken name, when the row should be heard as more than its label. Starts with the label. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

function SwitchRowComponent({
  label,
  description,
  value,
  onValueChange,
  isBusy = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: SwitchRowProps) {
  const theme = useTheme();
  const isLocked = disabled || isBusy;

  const toggle = useCallback(() => {
    if (isLocked) {
      return;
    }
    onValueChange(!value);
  }, [isLocked, onValueChange, value]);

  return (
    <Pressable
      onPress={toggle}
      disabled={isLocked}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: value, disabled: isLocked, busy: isBusy }}
      style={({ pressed }: PressableStateCallbackType) => [
        styles.row,
        { minHeight: theme.hitSlop.minTarget, gap: theme.spacing.md },
        pressed && !isLocked && { opacity: theme.opacity.pressed },
      ]}
      testID={testID}>
      {/* A definite width, so a long name or line wraps instead of being clipped (3E-3). */}
      <View style={[styles.copy, { gap: theme.spacing.xxs }]}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="caption" color="textSecondary">
            {description}
          </Text>
        ) : null}
      </View>

      <View
        style={[styles.control, { gap: theme.spacing.sm }]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {isBusy ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
        <Switch
          value={value}
          disabled={isLocked}
          focusable={false}
          // The thumb is light in both themes, so it stands clear of either track.
          thumbColor={theme.colors.onPrimary}
          trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primary }}
          ios_backgroundColor={theme.colors.borderStrong}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copy: {
    flex: 1,
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export const SwitchRow = memo(SwitchRowComponent);
