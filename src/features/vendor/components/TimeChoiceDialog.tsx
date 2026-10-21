/**
 * TimeChoiceDialog
 *
 * The list of times a day can open or close at, on the Working hours screen
 * (PROJECT_BIBLE.md section 38, "Working Hours"): every half hour of the day,
 * the current one chosen, one tap to choose another.
 *
 * ⚠️ A list to choose from, not a picker. No picker dependency (CLAUDE.md
 * section 2 has none), and a clock wheel would offer minutes nobody works to.
 * The choices are `SelectionChip`s — the app's one way of saying "one of
 * these" (radio role, chosen said by fill, weight and a tick, never colour
 * alone) — two to a row, an hour a row, in a scroll that opens on the current
 * time, so "7:00 PM" is in view without scrolling past the night.
 *
 * Built like `ConfirmDialog` and for its reasons: the platform `Modal`
 * confines a screen reader to it, the title is its name and a heading, and
 * every way out that is not a choice — Cancel, Android back, the backdrop —
 * changes nothing. Choosing is the caller's to apply; this only reports it.
 *
 * ⚠️ Never taller than the screen. The dialog may grow to the space inside
 * the backdrop's padding and no further, and the list shrinks to fit inside
 * it; nothing here is a fixed height or width.
 *
 * ⚠️ That padding includes the status bar and the gesture bar
 * (`useDialogBackdropPadding`). This list is tall enough to fill the window, and
 * with the spacing token alone its title was drawn under the status bar on a
 * Pixel 7 (21/10/2026).
 */

import React, { memo, useCallback, useRef } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import {
  SecondaryButton,
  SelectionChip,
  Text,
  useDialogBackdropPadding,
} from '@/shared/components';
import { breakpoints, useTheme } from '@/shared/theme';

export interface TimeChoice {
  /** What is stored: `HH:mm`. */
  value: string;
  /** What the vendor reads, in their own clock. */
  label: string;
}

export interface TimeChoiceDialogProps {
  visible: boolean;
  title: string;
  options: readonly TimeChoice[];
  /** The time chosen now; null when none of the options is. */
  value: string | null;
  onChoose: (value: string) => void;
  onCancel: () => void;
  /** Names the set, so the choices are heard as one group. */
  groupLabel: string;
  cancelLabel: string;
  cancelHint?: string;
  testID?: string;
}

interface OptionProps {
  option: TimeChoice;
  selected: boolean;
  onChoose: (value: string) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
}

function TimeOption({ option, selected, onChoose, onLayout, testID }: OptionProps) {
  const choose = useCallback(() => onChoose(option.value), [onChoose, option.value]);

  return (
    <View onLayout={onLayout} style={styles.cell}>
      <SelectionChip label={option.label} selected={selected} onPress={choose} testID={testID} />
    </View>
  );
}

function TimeChoiceDialogComponent({
  visible,
  title,
  options,
  value,
  onChoose,
  onCancel,
  groupLabel,
  cancelLabel,
  cancelHint,
  testID,
}: TimeChoiceDialogProps) {
  const theme = useTheme();
  const backdropPadding = useDialogBackdropPadding('xl');
  const scroll = useRef<ScrollView>(null);

  // The current time a row below the top edge, so the one before it shows too.
  const bringIntoView = useCallback(
    (event: LayoutChangeEvent) => {
      const top = event.nativeEvent.layout.y - theme.spacing.xxxl;
      scroll.current?.scrollTo({ y: Math.max(0, top), animated: false });
    },
    [theme.spacing.xxxl],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // The Android back button is Cancel.
      onRequestClose={onCancel}>
      <View
        style={[styles.backdrop, { backgroundColor: theme.colors.overlay }, backdropPadding]}>
        {/* Cancel too, but not a stop of its own: the Cancel button already is one. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          importantForAccessibility="no"
          accessibilityElementsHidden
          testID={testID ? `${testID}-backdrop` : undefined}
        />

        <View
          accessibilityViewIsModal
          accessibilityLabel={title}
          style={[
            styles.dialog,
            {
              maxWidth: breakpoints.sm,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xl,
              padding: theme.spacing.xl,
              gap: theme.spacing.lg,
            },
          ]}
          testID={testID}>
          <Text variant="h3" accessibilityRole="header">
            {title}
          </Text>

          <ScrollView
            ref={scroll}
            style={styles.list}
            contentContainerStyle={[styles.options, { gap: theme.spacing.sm }]}
            accessibilityRole="radiogroup"
            accessibilityLabel={groupLabel}>
            {options.map(option => (
              <TimeOption
                key={option.value}
                option={option}
                selected={option.value === value}
                onChoose={onChoose}
                onLayout={option.value === value ? bringIntoView : undefined}
                testID={testID ? `${testID}-${option.value}` : undefined}
              />
            ))}
          </ScrollView>

          <SecondaryButton
            label={cancelLabel}
            onPress={onCancel}
            fullWidth
            accessibilityHint={cancelHint}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    width: '100%',
    // Up to the space inside the backdrop's padding — the system bars included —
    // never past the screen.
    maxHeight: '100%',
  },
  list: {
    // Takes no more than its choices need, and gives way when they do not fit.
    flexGrow: 0,
    flexShrink: 1,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  /*
    Two to a row, equal widths, at any dialog width: more than a third and
    less than a half, so a third never fits and two always do — an hour to a
    row ("9:00 AM", "9:30 AM"), which is easier to run an eye down than a
    ragged wrap. A share of the row, never a fixed width.
  */
  cell: {
    flexBasis: '40%',
    flexGrow: 1,
  },
});

export const TimeChoiceDialog = memo(TimeChoiceDialogComponent);
