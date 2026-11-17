/**
 * StarRating
 *
 * Section 24's one-to-five stars, chosen or shown (PROJECT_BIBLE.md section 24).
 *
 * Two uses, one drawing. With `onChange` it is the rating input on the review
 * screen; without, it is the same stars read back on a submitted review — so a
 * rating looks identical before and after it is sent.
 *
 * ⚠️ Selection is said three ways, never by colour alone (section 46). A chosen
 * star is a filled glyph and an unchosen one an outline — a difference of shape
 * — the stars are coloured on top of that, and the rating is written out
 * underneath in words.
 *
 * ⚠️ One stop per star for a screen reader, each named for what it sets: "3 out
 * of 5 stars", as a radio in a group called "Rating", checked when it is the
 * rating. Five unexplained star icons would say nothing. Read-only, the whole
 * row is one node that says the rating once.
 *
 * Each star is a full minimum touch target, so five fit side by side at 360dp
 * with room to spare.
 *
 * Shared since Phase 3E-6, when the vendor's reviews (section 41) needed the
 * same stars read back. Moved, not copied — a rating must look the same to the
 * customer who gave it and the professional who received it — and its words
 * moved with it to `shared/presentation/rating.ts`. The customer's import path
 * still resolves. Inside a block that speaks for itself (a vendor's review
 * card), hide the row from assistive technology so the rating is not said
 * twice.
 */

import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View, type PressableStateCallbackType } from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { Text } from '@/shared/components/Text';
import { RATING_COPY, describeRating } from '@/shared/presentation/rating';
import { REVIEW_RATING_MAX, REVIEW_RATING_MIN } from '@/shared/services/types/ReviewService';
import { useTheme, type IconSizeToken } from '@/shared/theme';

/** Every value on section 24's scale, lowest first. */
const SCALE: readonly number[] = Array.from(
  { length: REVIEW_RATING_MAX - REVIEW_RATING_MIN + 1 },
  (_, index) => REVIEW_RATING_MIN + index,
);

export interface StarRatingProps {
  /** The rating. Anything outside the scale draws as no stars chosen. */
  value: number;
  /** Makes the stars choosable. Omit for a read-only rating. */
  onChange?: (value: number) => void;
  /** Glyph size. The touch target stays the minimum whatever this is. */
  size?: IconSizeToken;
  testID?: string;
}

interface StarProps {
  star: number;
  filled: boolean;
  /** Whether this star is the rating itself. */
  checked: boolean;
  size: IconSizeToken;
  onChange: (value: number) => void;
  testID?: string;
}

function Star({ star, filled, checked, size, onChange, testID }: StarProps) {
  const theme = useTheme();

  const onPress = useCallback(() => onChange(star), [onChange, star]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={describeRating(star)}
      // Checked is this star being the rating, not being filled: the stars
      // below a rating are filled too, and are not what was chosen.
      accessibilityState={{ checked, selected: checked }}
      accessibilityHint={RATING_COPY.hint}
      testID={testID}
      style={({ pressed }: PressableStateCallbackType) => [
        styles.star,
        {
          width: theme.hitSlop.minTarget,
          height: theme.hitSlop.minTarget,
          borderRadius: theme.radius.full,
        },
        pressed && { opacity: theme.opacity.pressed },
      ]}>
      <Icon
        name={filled ? 'star' : 'starOutline'}
        size={size}
        color={filled ? 'warning' : 'textSecondary'}
      />
    </Pressable>
  );
}

function StarRatingComponent({ value, onChange, size = 'xl', testID }: StarRatingProps) {
  const theme = useTheme();

  const rating =
    Number.isInteger(value) && value >= REVIEW_RATING_MIN && value <= REVIEW_RATING_MAX ? value : 0;

  if (!onChange) {
    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${RATING_COPY.label}: ${describeRating(rating)}`}
        style={[styles.row, { gap: theme.spacing.xxs }]}
        testID={testID}>
        {SCALE.map(star => (
          <Icon
            key={star}
            name={star <= rating ? 'star' : 'starOutline'}
            size={size}
            color={star <= rating ? 'warning' : 'textSecondary'}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={RATING_COPY.label}
        style={styles.row}
        testID={testID}>
        {SCALE.map(star => (
          <Star
            key={star}
            star={star}
            filled={star <= rating}
            checked={star === rating}
            size={size}
            onChange={onChange}
            testID={testID ? `${testID}-${star}` : undefined}
          />
        ))}
      </View>

      {/*
        The rating in words, as well as in stars. Hidden from the screen reader,
        which already heard it on the star that was checked; a live region would
        say it a second time.
      */}
      <Text
        variant="caption"
        color="textSecondary"
        importantForAccessibility="no"
        accessibilityElementsHidden
        testID={testID ? `${testID}-value` : undefined}>
        {rating > 0 ? describeRating(rating) : RATING_COPY.none}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // Wraps rather than overflowing if a large font setting ever makes the
    // glyphs wider than the row.
    flexWrap: 'wrap',
  },
  star: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const StarRating = memo(StarRatingComponent);
