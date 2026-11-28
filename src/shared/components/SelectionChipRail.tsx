/**
 * SelectionChipRail
 *
 * One row of `SelectionChip`s, exactly one of them chosen, that scrolls
 * sideways when it is wider than the screen.
 *
 * It began as the customer's `ScheduleRail` (preferred date and time) and was
 * moved here when both requests lists were asked to put their status filters on
 * one sideways row as well (T134, 28/11/2026): three rails that look and behave
 * the same are one rail. `ScheduleRail` is now this with its own test ids.
 *
 * Bleeds to the screen edge and pads itself back by the gutter, so the first
 * chip lines up with everything above it and a row that runs off the side looks
 * like it continues rather than stopping at a margin. No scroll indicator: the
 * cut-off chip at the edge already says there is more.
 *
 * ⚠️ The chosen chip is brought into view, moving the row as little as it can:
 * nothing moves when the chip is already whole on screen, and a chip half off
 * one side is pulled in just far enough to clear the gutter on that side. It is
 * measured after it is chosen, not before — choosing a chip gives it a tick and
 * a heavier weight, so it grows, and a position read off the old layout would
 * stop a few points short. Motion follows reduced motion like everything else.
 *
 * Not a selection framework, as the chip is not: it owns no value, only which
 * option is drawn as chosen, and reports a press. The screen decides what a
 * choice means.
 */

import React, { memo, useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { SelectionChip } from '@/shared/components/SelectionChip';
import { useTheme } from '@/shared/theme';

export interface SelectionChipRailOption<Value extends string> {
  /** What the screen receives when it is chosen. */
  value: Value;
  /** What the person reads. */
  label: string;
}

export interface SelectionChipRailProps<Value extends string> {
  options: readonly SelectionChipRailOption<Value>[];
  /** The option drawn as chosen. */
  value: Value;
  onChange: (value: Value) => void;
  /** Names the group. Without it the rail is a run of unrelated radios. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Lands on the rail itself. */
  testID?: string;
  /**
   * Each chip's test id. Defaults to `${testID}-${value}` when the rail has one.
   *
   * Supplied by screens whose chips had ids before the rail existed, so the
   * suites that press them by id did not have to change.
   */
  chipTestID?: (value: Value) => string;
}

/** Where a chip sits along the row, in the row's own coordinates. */
interface ChipSpan {
  x: number;
  width: number;
}

interface RailOptionProps<Value extends string> {
  option: SelectionChipRailOption<Value>;
  selected: boolean;
  onChange: (value: Value) => void;
  onMeasured: (value: Value, span: ChipSpan) => void;
  accessibilityHint?: string;
  testID?: string;
}

function RailOption<Value extends string>({
  option,
  selected,
  onChange,
  onMeasured,
  accessibilityHint,
  testID,
}: RailOptionProps<Value>) {
  const handlePress = useCallback(() => onChange(option.value), [onChange, option.value]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      onMeasured(option.value, { x, width });
    },
    [onMeasured, option.value],
  );

  return (
    // A plain view for its measurements: the chip takes no layout callback, and
    // this one is invisible to assistive technology, so the radios still read as
    // the group's own.
    <View onLayout={handleLayout}>
      <SelectionChip
        label={option.label}
        selected={selected}
        onPress={handlePress}
        accessibilityHint={accessibilityHint}
        testID={testID}
      />
    </View>
  );
}

function SelectionChipRailComponent<Value extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  accessibilityHint,
  testID,
  chipTestID,
}: SelectionChipRailProps<Value>) {
  const theme = useTheme();
  const isReduced = useReducedMotion();

  const railRef = useRef<ScrollView>(null);
  const spans = useRef(new Map<Value, ChipSpan>());
  /** How wide the visible row is and how far along it has been scrolled. */
  const viewport = useRef({ width: 0, offset: 0 });

  const gutter = theme.screenPadding;

  /** Scrolls only if `target` is not already whole on screen, and only as far as it must. */
  const reveal = useCallback(
    (target: Value) => {
      const span = spans.current.get(target);
      const { width, offset } = viewport.current;

      if (!span || width <= 0) {
        return;
      }

      // The offsets at which the chip's left, or right, edge sits one gutter in.
      const showStart = Math.max(0, span.x - gutter);
      const showEnd = span.x + span.width + gutter - width;

      let next: number | null = null;
      if (showStart < offset) {
        next = showStart;
      } else if (showEnd > offset) {
        // A chip wider than the row keeps its start in view rather than its end.
        next = Math.min(showEnd, showStart);
      }

      if (next === null) {
        return;
      }

      viewport.current.offset = next;
      railRef.current?.scrollTo({ x: next, animated: !isReduced });
    },
    [gutter, isReduced],
  );

  // Chosen by a press, or by the screen: brought into view with what is known now…
  useEffect(() => {
    reveal(value);
  }, [reveal, value]);

  // …and again once the chosen chip has been measured at its chosen size.
  const handleMeasured = useCallback(
    (chipValue: Value, span: ChipSpan) => {
      spans.current.set(chipValue, span);
      if (chipValue === value) {
        reveal(chipValue);
      }
    },
    [reveal, value],
  );

  const handleRailLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewport.current.width = event.nativeEvent.layout.width;
      reveal(value);
    },
    [reveal, value],
  );

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    viewport.current.offset = event.nativeEvent.contentOffset.x;
  }, []);

  const testIDFor = (optionValue: Value): string | undefined => {
    if (chipTestID) {
      return chipTestID(optionValue);
    }
    return testID ? `${testID}-${optionValue}` : undefined;
  };

  return (
    <ScrollView
      ref={railRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={handleRailLayout}
      onScroll={handleScroll}
      // Often enough to know where the row is when a chip is chosen mid-drag.
      scrollEventThrottle={16}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.rail, { marginHorizontal: -gutter }]}
      contentContainerStyle={{
        paddingHorizontal: gutter,
        gap: theme.spacing.sm,
      }}
      testID={testID}>
      {options.map(option => (
        <RailOption
          key={option.value}
          option={option}
          selected={option.value === value}
          onChange={onChange}
          onMeasured={handleMeasured}
          accessibilityHint={accessibilityHint}
          testID={testIDFor(option.value)}
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

/** `memo` drops the type parameter; the cast puts it back. */
export const SelectionChipRail = memo(SelectionChipRailComponent) as typeof SelectionChipRailComponent;
