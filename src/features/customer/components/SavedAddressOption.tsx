/**
 * SavedAddressOption
 *
 * One of the customer's saved addresses, offered as the service address for the
 * request being raised.
 *
 * ⚠️ It sits on `SelectableCard`, as `AddressSuggestionRow` does. Picking a saved
 * address and picking a suggestion are the same gesture — choosing where the work
 * is — so they look and announce themselves the same way: one control, one
 * announcement, the tick on the one the request holds now.
 *
 * ⚠️ The default is said in words. With no labels (section 63 puts Home / Office
 * / Other in Phase 2), the default is the one thing that tells two cards apart
 * besides the address itself, so it is a "Default" badge and "Default address" in
 * the spoken name — never a tint. The badge carries no tick: in a card whose tick
 * already means "chosen", a second one meaning "default" would say both at once.
 *
 * Not `ManageAddressesScreen`'s card. That one is a record with Edit, Delete and
 * Set as default on it; this is a single choice that changes nothing in the book.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SelectableCard } from '@/features/customer/components/SelectableCard';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { Icon, StatusBadge, Text } from '@/shared/components';
import type { SavedAddress } from '@/shared/services/types/AddressBookService';
import { useTheme } from '@/shared/theme';

const BOOK = CUSTOMER_COPY.addressBook;

export interface SavedAddressOptionProps {
  address: SavedAddress;
  /** The request already holds this address, unchanged. */
  selected: boolean;
  onSelect: (address: SavedAddress) => void;
  /** Announced after the address, so a reader knows what choosing it does. */
  accessibilityHint?: string;
  testID?: string;
}

function SavedAddressOptionComponent({
  address,
  selected,
  onSelect,
  accessibilityHint,
  testID,
}: SavedAddressOptionProps) {
  const theme = useTheme();

  return (
    <SelectableCard
      selected={selected}
      onPress={() => onSelect(address)}
      // The card's children are hidden behind this, so it says everything the
      // eye gets — the address, and whether it is the default.
      accessibilityLabel={
        address.isDefault
          ? `${address.formattedAddress}. ${BOOK.defaultSpoken}`
          : address.formattedAddress
      }
      accessibilityHint={accessibilityHint}
      testID={testID}>
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        <Icon name="location" size="md" color="textTertiary" />

        <View style={[styles.text, { gap: theme.spacing.xs }]}>
          {address.isDefault ? (
            <StatusBadge
              label={BOOK.defaultBadge}
              tone="info"
              testID={testID ? `${testID}-default` : undefined}
            />
          ) : null}
          <Text variant="bodyStrong">{address.formattedAddress}</Text>
        </View>
      </View>
    </SelectableCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Top rather than centre: a long address beside a single glyph reads as
    // lopsided when the glyph floats to the middle of the block.
    alignItems: 'flex-start',
  },
  text: {
    // A definite width, so a long address wraps inside the card rather than
    // pushing the tick off it — and is never measured at its own width and then
    // clipped (the 3E-3 lesson about `flexShrink` alone).
    flex: 1,
  },
});

export const SavedAddressOption = memo(SavedAddressOptionComponent);
