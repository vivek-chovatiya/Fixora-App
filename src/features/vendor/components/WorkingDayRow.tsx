/**
 * WorkingDayRow
 *
 * One day of the week on the Working hours screen (PROJECT_BIBLE.md section
 * 38, "Working Hours"): open or closed, and — when open — when it opens and
 * when it closes.
 *
 * ⚠️ The day is one stop, spoken whole: "Monday, open, 9:00 AM to 7:00 PM",
 * as a switch that is on — or "Sunday, closed", off. The two times are their
 * own stops only while the day is open, each named for its day ("Monday
 * closing time, 7:00 PM"), because two buttons that both say "7:00 PM" down a
 * list of seven days say nothing about which they change.
 *
 * ⚠️ A day closing at or before it opens is said three ways (section 46, never
 * colour alone): the closing time drawn with a thick danger border, the reason
 * in words under it, and that sentence announced when it appears. It is the
 * screen's draft that is wrong, so it is said at once — not only on Save.
 *
 * It holds nothing. The times are chosen in the screen's dialog; this reports
 * which one was pressed.
 */

import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View, type PressableStateCallbackType } from 'react-native';

import { SwitchRow } from '@/features/vendor/components/SwitchRow';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { presentDay, presentHours } from '@/features/vendor/constants/workingHoursPresentation';
import type { WorkingDayDraft } from '@/features/vendor/validation/workingHoursForm';
import { Card, Icon, Text } from '@/shared/components';
import { formatTimeValue } from '@/shared/presentation/clockTime';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.workingHours;

/** Which of a day's two times. */
export type WorkingTimeEdge = 'opensAt' | 'closesAt';

export interface WorkingDayRowProps {
  draft: WorkingDayDraft;
  /** What is wrong with the day, in words; null when nothing is. */
  problem: string | null;
  onToggle: (day: string, isOpen: boolean) => void;
  onChooseTime: (day: string, edge: WorkingTimeEdge) => void;
  disabled?: boolean;
  testID?: string;
}

interface TimeFieldProps {
  label: string;
  time: string;
  spoken: string;
  invalid: boolean;
  disabled: boolean;
  onPress: () => void;
  testID?: string;
}

/** One of a day's times: what it is, and the way to the list of others. */
function TimeField({ label, time, spoken, invalid, disabled, onPress, testID }: TimeFieldProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={COPY.timeHint}
      accessibilityState={{ disabled }}
      style={({ pressed }: PressableStateCallbackType) => [
        styles.field,
        {
          minHeight: theme.controlHeight,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
          gap: theme.spacing.xs,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surface,
          // Thicker as well as red when wrong: colour alone is not enough (section 46).
          borderWidth: invalid ? theme.borderWidth.thick : theme.borderWidth.thin,
          borderColor: invalid ? theme.colors.danger : theme.colors.border,
        },
        pressed && !disabled && { opacity: theme.opacity.pressed },
        disabled && { opacity: theme.opacity.disabled },
      ]}
      testID={testID}>
      <View style={styles.fieldCopy}>
        <Text variant="caption" color="textTertiary">
          {label}
        </Text>
        <Text variant="bodyStrong">{time}</Text>
      </View>
      <Icon name="down" size="sm" color="textTertiary" />
    </Pressable>
  );
}

function WorkingDayRowComponent({
  draft,
  problem,
  onToggle,
  onChooseTime,
  disabled = false,
  testID,
}: WorkingDayRowProps) {
  const theme = useTheme();
  const { long } = presentDay(draft.day);
  const hours = presentHours(draft);
  const opens = formatTimeValue(draft.opensAt);
  const closes = formatTimeValue(draft.closesAt);

  const toggle = useCallback(
    (isOpen: boolean) => onToggle(draft.day, isOpen),
    [draft.day, onToggle],
  );
  const chooseOpens = useCallback(
    () => onChooseTime(draft.day, 'opensAt'),
    [draft.day, onChooseTime],
  );
  const chooseCloses = useCallback(
    () => onChooseTime(draft.day, 'closesAt'),
    [draft.day, onChooseTime],
  );

  const id = (suffix: string) => (testID ? `${testID}-${suffix}` : undefined);

  return (
    <Card bordered shadow="none" style={{ gap: theme.spacing.md }} testID={testID}>
      <SwitchRow
        label={long}
        description={hours.text}
        value={draft.isOpen}
        onValueChange={toggle}
        disabled={disabled}
        accessibilityLabel={
          draft.isOpen ? COPY.dayOpenSpoken(long, hours.spoken) : COPY.dayClosedSpoken(long)
        }
        accessibilityHint={draft.isOpen ? COPY.dayCloseHint(long) : COPY.dayOpenHint(long)}
        testID={id('switch')}
      />

      {draft.isOpen ? (
        <>
          <View style={[styles.times, { gap: theme.spacing.sm }]}>
            <TimeField
              label={COPY.opensLabel}
              time={opens}
              spoken={COPY.opensSpoken(long, opens)}
              invalid={false}
              disabled={disabled}
              onPress={chooseOpens}
              testID={id('opens')}
            />
            <TimeField
              label={COPY.closesLabel}
              time={closes}
              spoken={COPY.closesSpoken(long, closes)}
              invalid={problem !== null}
              disabled={disabled}
              onPress={chooseCloses}
              testID={id('closes')}
            />
          </View>

          {problem ? (
            <Text
              variant="caption"
              color="danger"
              accessibilityLiveRegion="polite"
              testID={id('problem')}>
              {problem}
            </Text>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  times: {
    flexDirection: 'row',
  },
  field: {
    // An equal share of the row each: a definite width, so a long time wraps rather than clips.
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldCopy: {
    flex: 1,
  },
});

export const WorkingDayRow = memo(WorkingDayRowComponent);
