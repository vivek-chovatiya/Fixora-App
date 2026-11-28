/**
 * OptionsSheet
 *
 * A short list of things that can be done, raised from the bottom of the
 * screen: the notifications inbox's menu ("Mark all as read", "Clear all") and
 * a team member's photo ("Choose from gallery", "Take photo", "Remove photo")
 * (phase5-contract.md sections 3 and 5, T133 and T136, 28/11/2026). It was
 * written for those two together, and is the app's one options sheet: a
 * screen that wants a menu passes its options here rather than drawing one.
 *
 * ⚠️ Built on the platform `Modal`, the shell `ConfirmDialog` uses, not on
 * `@gorhom/bottom-sheet`. Nothing in the app wraps that library, and its modal
 * sheet needs a provider above the navigators (`App.tsx`) and a gesture root
 * of its own inside every Android modal — for a handful of rows that never
 * scroll or resize. The platform modal gives what a menu needs for nothing: a
 * screen reader confined to it while it is open, the Android back button as
 * Cancel, and nothing under it pressable.
 *
 * ⚠️ A choice runs once the sheet is on its way out, never inside it. Pressing
 * an option closes the sheet (`onClose`) and then calls the option's
 * `onSelect`. On iOS "then" is the modal's `onDismiss`, after it has gone:
 * iOS presents nothing over a view controller that is being dismissed, so a
 * dialog opened from the sheet (Clear all's question) or the camera and photo
 * library (`react-native-image-picker`) would silently not appear if they
 * were started while it was still leaving. Android shows them over a closing
 * sheet, so the choice runs at once there. The caller must therefore keep the
 * sheet mounted and close it through `visible`, never by unmounting it —
 * unmounted, iOS never calls `onDismiss` and the choice is lost.
 *
 * ⚠️ One choice per opening. Android runs it at once, while the sheet is still
 * fading out and its rows still take presses, so a quick second tap ran an
 * option twice — two "Clear all" questions, two pickers (reviewer finding,
 * 28/11/2026). The first press latches the sheet (`hasChosen`); every press
 * after it does nothing until the sheet is shown again. On iOS the same latch
 * keeps a second tap from replacing the choice waiting for `onDismiss`.
 *
 * ⚠️ An option that cannot apply is drawn disabled (`disabled`), not left out:
 * the sheet keeps its shape and says why nothing happens. Leaving one out is
 * the caller's choice for an option that makes no sense at all — "Remove
 * photo" with no photo. Every way out that is not an option — Cancel, the
 * Android back button, a tap on the dimmed backdrop — is `onClose`.
 *
 * ⚠️ Colour never carries meaning alone (PROJECT_BIBLE.md section 46): a
 * `danger` option's glyph is red, but its words and its glyph already say what
 * it does. The label stays `textPrimary`, because `danger` as text on the dark
 * surface is under the 4.5:1 that body text needs; a glyph needs 3:1, which it
 * has in both themes.
 *
 * It offers; it does not act. What a choice does, and whether it asks first,
 * is the caller's.
 */

import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/shared/components/Button';
import { useDialogBackdropPadding } from '@/shared/components/dialogBackdrop';
import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { useTheme, type IconName, type SpacingToken } from '@/shared/theme';

/** Between the sheet's edges and its rows, and below the last one before the system bar. */
const SHEET_PADDING: SpacingToken = 'lg';

export interface OptionsSheetOption {
  /** Stable among the options; also the end of the row's testID. */
  key: string;
  label: string;
  /** Said after the label: what choosing it does. */
  hint?: string;
  icon: IconName;
  /** `danger` for an option that removes something. Changes the glyph's colour, never the words. */
  tone?: 'default' | 'danger';
  /** Cannot apply right now: drawn, announced as disabled, and does nothing. */
  disabled?: boolean;
  /** Runs once the sheet is closing (see the header). */
  onSelect: () => void;
}

export interface OptionsSheetProps {
  visible: boolean;
  /** The sheet's heading, and its name for a screen reader. */
  title: string;
  options: readonly OptionsSheetOption[];
  /** Every way out that is not an option. The caller sets `visible` false. */
  onClose: () => void;
  cancelLabel: string;
  cancelHint?: string;
  /** The sheet's; each row is `<testID>-<key>`, the backdrop `<testID>-backdrop`. */
  testID?: string;
}

function OptionsSheetComponent({
  visible,
  title,
  options,
  onClose,
  cancelLabel,
  cancelHint,
  testID,
}: OptionsSheetProps) {
  const theme = useTheme();
  // The top keeps clear of the status bar (and the offline banner); the bottom
  // is the sheet's own padding, so its surface still reaches the window's edge.
  const { paddingTop, paddingBottom } = useDialogBackdropPadding(SHEET_PADDING);

  /** The choice waiting for iOS to finish dismissing the sheet. */
  const chosen = useRef<(() => void) | null>(null);

  /** Set by the first choice; cleared each time the sheet is shown (see the header). */
  const hasChosen = useRef(false);
  useEffect(() => {
    if (visible) {
      hasChosen.current = false;
    }
  }, [visible]);

  const select = useCallback(
    (option: OptionsSheetOption) => {
      if (option.disabled || hasChosen.current) {
        return;
      }
      hasChosen.current = true;
      if (Platform.OS === 'ios') {
        chosen.current = option.onSelect;
        onClose();
        return;
      }
      onClose();
      option.onSelect();
    },
    [onClose],
  );

  const dismissed = useCallback(() => {
    const run = chosen.current;
    chosen.current = null;
    run?.();
  }, []);

  /*
    The sheet rises a little as the modal fades in, so it reads as coming from
    the bottom edge; with reduced motion it is simply there. Leaving is the
    modal's fade alone.
  */
  const isReduced = useReducedMotion();
  const rise = useSharedValue(0);
  const travel = theme.spacing.xxl;
  useEffect(() => {
    if (!visible) {
      rise.value = 0;
      return;
    }
    rise.value = withTiming(1, {
      duration: isReduced ? 0 : theme.animation.duration.normal,
      easing: theme.animation.easing.decelerate,
    });
  }, [visible, isReduced, rise, theme]);
  const riseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - rise.value) * travel }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={dismissed}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay, paddingTop }]}>
        {/*
          The backdrop is Cancel too, but not a stop for a screen reader: the
          Cancel button already is one (ConfirmDialog's rule).
        */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          importantForAccessibility="no"
          accessibilityElementsHidden
          testID={testID ? `${testID}-backdrop` : undefined}
        />

        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={title}
          style={[
            styles.sheet,
            riseStyle,
            {
              maxWidth: theme.maxContentWidth,
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              paddingTop: theme.spacing[SHEET_PADDING],
              paddingHorizontal: theme.spacing[SHEET_PADDING],
              paddingBottom,
              gap: theme.spacing.xs,
            },
          ]}
          testID={testID}>
          <Text
            variant="h3"
            accessibilityRole="header"
            style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
            {title}
          </Text>

          {options.map(option => (
            <OptionRow
              key={option.key}
              option={option}
              onSelect={select}
              testID={testID ? `${testID}-${option.key}` : undefined}
            />
          ))}

          <View style={{ paddingTop: theme.spacing.md }}>
            <Button
              label={cancelLabel}
              variant="secondary"
              fullWidth
              onPress={onClose}
              accessibilityHint={cancelHint}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

interface OptionRowProps {
  option: OptionsSheetOption;
  onSelect: (option: OptionsSheetOption) => void;
  testID?: string;
}

/**
 * One option: its glyph and its words, a full-width row at the controls'
 * height. Pressing steps the fill up, as the back button does, rather than
 * fading the words.
 */
function OptionRowComponent({ option, onSelect, testID }: OptionRowProps) {
  const theme = useTheme();
  const disabled = option.disabled === true;
  const press = useCallback(() => onSelect(option), [onSelect, option]);

  return (
    <Pressable
      onPress={press}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={option.label}
      accessibilityHint={option.hint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: theme.controlHeight,
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.lg,
          backgroundColor: pressed && !disabled ? theme.colors.surfaceAlt : theme.colors.surface,
          opacity: disabled ? theme.opacity.disabled : 1,
        },
      ]}
      testID={testID}>
      <Icon
        name={option.icon}
        size="lg"
        color={option.tone === 'danger' ? 'danger' : 'textSecondary'}
      />
      {/* `flex: 1`: a long label wraps inside the row rather than pushing past it. */}
      <Text variant="subtitle" style={styles.label}>
        {option.label}
      </Text>
    </Pressable>
  );
}

const OptionRow = memo(OptionRowComponent);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    flex: 1,
  },
});

export const OptionsSheet = memo(OptionsSheetComponent);
