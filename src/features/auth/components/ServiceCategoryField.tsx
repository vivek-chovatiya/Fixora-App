/**
 * ServiceCategoryField
 *
 * Multi-select for the services a vendor offers.
 *
 * Extracted from the registration screen because it is the one field that
 * fetches: categories come from the backend, so it carries its own loading,
 * error and retry states rather than pushing three more branches into the form.
 *
 * It selects identifiers and renders names. No category name appears in this
 * file, and nothing here branches on one — adding a service must never require a
 * release (PROJECT_BIBLE.md section 11). The glyph comes from the backend too,
 * which is why DynamicIcon is used rather than a theme icon token.
 */

import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View, type PressableStateCallbackType } from 'react-native';

import { DynamicIcon, Icon } from '@/shared/components/Icon';
import { ErrorState } from '@/shared/components/ErrorState';
import { FieldLabel } from '@/shared/components/FieldLabel';
import { Loader } from '@/shared/components/Loader';
import { Text } from '@/shared/components/Text';
import { useServiceQuery } from '@/shared/hooks/useServiceQuery';
import { getService } from '@/shared/services/ServiceRegistry';
import type { ServiceCategory } from '@/shared/services/types/CategoryService';
import { useTheme } from '@/shared/theme';

export interface ServiceCategoryFieldProps {
  label: string;
  /** Marks the label required, the same way Input does. */
  required?: boolean;
  /** Selected category identifiers. */
  value: string[];
  onChange: (categoryIds: string[]) => void;
  /** Validation message from the form. */
  error?: string;
  disabled?: boolean;
  testID?: string;
}

function ServiceCategoryFieldComponent({
  label,
  required,
  value,
  onChange,
  error,
  disabled = false,
  testID,
}: ServiceCategoryFieldProps) {
  const theme = useTheme();

  const {
    data: categories,
    isLoading,
    error: loadError,
    retry,
  } = useServiceQuery(() => getService('category').listServiceCategories(), []);

  const toggle = useCallback(
    (categoryId: string) => {
      onChange(
        value.includes(categoryId)
          ? value.filter(id => id !== categoryId)
          : [...value, categoryId],
      );
    },
    [value, onChange],
  );

  return (
    <View style={{ gap: theme.spacing.sm }} testID={testID}>
      {/*
        Not flush by accident: this label names a row of chips rather than the
        inside of a capsule, so unlike a field label it has nothing to line up
        with and stays at the column edge with the section heading above it.
      */}
      <FieldLabel required={required}>{label}</FieldLabel>

      {isLoading ? <Loader /> : null}

      {loadError ? <ErrorState error={loadError} onRetry={retry} fullScreen={false} /> : null}

      {categories ? (
        <View style={[styles.options, { gap: theme.spacing.sm }]}>
          {categories.map(category => (
            <CategoryChip
              key={category.id}
              category={category}
              selected={value.includes(category.id)}
              disabled={disabled}
              onPress={toggle}
            />
          ))}
        </View>
      ) : null}

      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

interface CategoryChipProps {
  category: ServiceCategory;
  selected: boolean;
  disabled: boolean;
  onPress: (categoryId: string) => void;
}

function CategoryChipComponent({ category, selected, disabled, onPress }: CategoryChipProps) {
  const theme = useTheme();

  const handlePress = useCallback(() => {
    onPress(category.id);
  }, [onPress, category.id]);

  const resolveStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.chip,
      {
        backgroundColor: selected ? theme.colors.primarySubtle : theme.colors.surface,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        borderRadius: theme.radius.full,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.xs,
        minHeight: theme.hitSlop.minTarget,
        opacity: disabled ? theme.opacity.disabled : pressed ? theme.opacity.pressed : 1,
      },
    ],
    [theme, selected, disabled],
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={resolveStyle}
      accessibilityRole="checkbox"
      accessibilityLabel={category.name}
      accessibilityState={{ checked: selected, disabled }}>
      <DynamicIcon
        glyph={category.iconGlyph}
        size="sm"
        color={selected ? 'primary' : 'textTertiary'}
      />

      {/*
        `numberOfLines={1}` is load-bearing, not cosmetic.

        Inside this wrapping row the label was measured at its full width — the
        chip came out the right size — but line-broken against a narrower one.
        "Appliance Repair" put "Repair" on a second line that the height, already
        computed for one, then clipped: the vendor saw "Appliance", with no
        ellipsis and a gap where the rest belonged. A category name is backend
        data, so half of it names a service that does not exist.

        Letting it shrink did not help, nor did giving it a resolved width to
        break against, nor allowing two lines — each still broke, and the extra
        line was still clipped. Forbidding the break is what fixes it, and it
        costs nothing: with no width forced on the chip, the chip is sized to the
        whole name, so the tail is never reached. The ellipsis only appears for a
        name wider than the row itself, where an honest "…" beats a word
        silently cut in half.
      */}
      <View style={styles.labelBox}>
        <Text
          variant="label"
          color={selected ? 'primary' : 'textSecondary'}
          numberOfLines={1}>
          {category.name}
        </Text>
      </View>

      {/*
        Selection is never carried by colour alone: the mark appears, the border
        changes, and the checkbox role reports it to a screen reader.
      */}
      {selected ? <Icon name="selected" size="sm" color="primary" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
    // A name longer than the row can never push the chip past the screen edge.
    maxWidth: '100%',
  },
  labelBox: {
    flexShrink: 1,
  },
});

const CategoryChip = memo(CategoryChipComponent);

export const ServiceCategoryField = memo(ServiceCategoryFieldComponent);
