/**
 * AddressSuggestionRow
 *
 * One candidate address in the list under the search box.
 *
 * ⚠️ Two lines, and the split matters. A gazetteer returns the whole postal
 * address; rendered as one string, five candidates are five paragraphs and the
 * differences between them — which is the only thing the customer is reading for
 * — are buried in the middle of each. The label is what distinguishes this one,
 * the detail is where it is.
 *
 * It sits on `SelectableCard`, which owns the chrome, the tick and the radio
 * semantics, so a suggestion and the vendor options a screen later cannot drift
 * apart. Choosing an address and choosing a professional are the same gesture
 * from the same kind of list, and they should look and announce it the same way.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SelectableCard } from '@/features/customer/components/SelectableCard';
import type { AddressSuggestion } from '@/shared/services/types/AddressService';
import { Icon, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

export interface AddressSuggestionRowProps {
  suggestion: AddressSuggestion;
  selected: boolean;
  onSelect: (suggestion: AddressSuggestion) => void;
  /** Announced after the address, so a reader knows what choosing it does. */
  accessibilityHint?: string;
  testID?: string;
}

function AddressSuggestionRowComponent({
  suggestion,
  selected,
  onSelect,
  accessibilityHint,
  testID,
}: AddressSuggestionRowProps) {
  const theme = useTheme();
  const { label, detail } = suggestion;

  return (
    <SelectableCard
      selected={selected}
      onPress={() => onSelect(suggestion)}
      /*
        Both lines, as one sentence.

        `SelectableCard` hides its children from assistive technology so the row
        is announced once rather than walked node by node — which means the
        spoken name has to carry everything the eye gets, including the locality
        that tells two identical street numbers apart.
      */
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityHint={accessibilityHint}
      testID={testID}>
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        {/*
          A pin, not a tick. The tick is `SelectableCard`'s and appears on the
          chosen one; this says what kind of thing every row is.
        */}
        <Icon name="location" size="md" color="textTertiary" />

        <View style={[styles.text, { gap: theme.spacing.xxs }]}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {label}
          </Text>
          {detail ? (
            <Text variant="caption" color="textSecondary" numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
    </SelectableCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Top rather than centre: a two-line address next to a single glyph reads as
    // lopsided when the glyph floats to the middle of the block.
    alignItems: 'flex-start',
  },
  text: {
    // Takes the slack, so a long address wraps inside the card rather than
    // pushing the tick off the edge of it.
    flex: 1,
  },
});

export const AddressSuggestionRow = memo(AddressSuggestionRowComponent);
