/**
 * ManageAddressesScreen
 *
 * The addresses a customer has kept (PROJECT_BIBLE.md section 18's "address
 * display, add address, edit address, delete address, default address", reached
 * from section 25's Manage Addresses and section 26's Addresses route).
 *
 * ⚠️ No label anywhere. Section 18's Phase 1 list has none and section 63 puts
 * Home / Office / Other in Phase 2, so each card is the address itself — which
 * is also why the default has to be said in words rather than shown by a tint:
 * with nothing else distinguishing one card from another, colour alone would be
 * the only difference, and for a good many people there would be none.
 *
 * ⚠️ This screen is not part of raising a request. Section 18's service address
 * is collected by `ServiceAddressScreen` and is untouched by this screen (owner
 * decision, 2026-09-29): a customer with an empty address book books a visit
 * exactly as before. Since then the address step offers "Use a saved address"
 * (`ChooseSavedAddressScreen`), which reads this book and copies one address
 * into the draft — but nothing here writes to a draft, and no request ever
 * refers to one of these records: a request copies the fields it needs, so
 * deleting an address cannot change a visit already booked.
 *
 * ⚠️ A failed change is not a failed screen. Losing the list and failing to
 * delete one address are different things, and they are drawn differently: the
 * first replaces the page, the second is a line above a list that is still
 * correct.
 */

import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useAddressBook } from '@/features/customer/hooks/useAddressBook';
import type { CustomerStackParamList, CustomerTabParamList } from '@/navigation/types';
import {
  BackButton,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  SecondaryButton,
  Text,
} from '@/shared/components';
import type { SavedAddress } from '@/shared/services/types/AddressBookService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.addressBook;

type Props = CompositeScreenProps<
  NativeStackScreenProps<CustomerStackParamList, 'Addresses'>,
  BottomTabScreenProps<CustomerTabParamList>
>;

export function ManageAddressesScreen({ navigation }: Props) {
  const theme = useTheme();
  const book = useAddressBook();
  const { reload } = book;

  const [removing, setRemoving] = useState<SavedAddress | null>(null);

  /*
    Read again on the way back in — but not on the way in.

    Add and Edit are their own screens and this one stays mounted underneath
    them, so without this a newly saved address would not appear until the
    screen was left and reopened. The first focus is skipped because the query
    has just read on mount: reloading there too would ask for the same list
    twice on every visit, and would replace a failure with a second attempt
    before anybody saw it.
  */
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedBefore.current) {
        focusedBefore.current = true;
        return;
      }
      reload();
    }, [reload]),
  );

  const add = useCallback(() => navigation.navigate('EditAddress', {}), [navigation]);

  const confirmRemove = useCallback(() => {
    const target = removing;
    setRemoving(null);
    if (target) {
      book.remove(target.id);
    }
  }, [book, removing]);

  const cancelRemove = useCallback(() => setRemoving(null), []);

  const header = (
    <View style={[styles.bar, { paddingHorizontal: theme.spacing.sm, height: theme.hitSlop.minTarget }]}>
      <BackButton
        onPress={navigation.goBack}
        accessibilityLabel={CUSTOMER_COPY.profile.title}
        testID="addresses-back"
      />
    </View>
  );

  // The list could not be read, so there is nothing to show and nothing to act
  // on. A retry is the only useful thing on the page.
  if (book.error && book.addresses.length === 0) {
    return (
      <Screen header={header} testID="customer-addresses">
        <ErrorState
          error={book.error}
          title={COPY.failedTitle}
          onRetry={book.reload}
          testID="addresses-error"
        />
      </Screen>
    );
  }

  return (
    <Screen
      scrollable
      header={header}
      contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
      testID="customer-addresses">
      <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.xs }}>
        <Text variant="hero" accessibilityRole="header" testID="addresses-heading">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      {/* Above the list, because the list below it is still what is stored. */}
      {book.changeError ? (
        <ErrorState
          error={book.changeError}
          title={COPY.changeFailedTitle}
          fullScreen={false}
          testID="addresses-change-error"
        />
      ) : null}

      {book.isLoading ? (
        <Text
          variant="body"
          color="textSecondary"
          accessibilityLiveRegion="polite"
          testID="addresses-loading">
          {COPY.loading}
        </Text>
      ) : null}

      {!book.isLoading && book.addresses.length === 0 ? (
        <EmptyState
          icon="location"
          title={COPY.emptyTitle}
          message={COPY.emptyMessage}
          actionLabel={COPY.add}
          onAction={add}
          fullScreen={false}
          testID="addresses-empty"
        />
      ) : null}

      {book.addresses.map(address => (
        <AddressCard
          key={address.id}
          address={address}
          isBusy={book.changingId === address.id}
          isDisabled={book.isChanging}
          onEdit={() => navigation.navigate('EditAddress', { addressId: address.id })}
          onRemove={() => setRemoving(address)}
          onSetDefault={() => book.setDefault(address.id)}
        />
      ))}

      {book.addresses.length > 0 ? (
        <Button
          label={COPY.add}
          icon="add"
          onPress={add}
          disabled={book.isChanging}
          fullWidth
          accessibilityHint={COPY.addHint}
        />
      ) : null}

      <ConfirmDialog
        visible={removing !== null}
        title={COPY.removeTitle}
        message={removing ? `${COPY.removeMessage} ${removing.formattedAddress}.` : undefined}
        cancelLabel={COPY.removeCancel}
        cancelHint={COPY.removeCancelHint}
        confirmLabel={COPY.removeConfirm}
        confirmHint={COPY.removeConfirmHint}
        onCancel={cancelRemove}
        onConfirm={confirmRemove}
        testID="addresses-remove-dialog"
      />
    </Screen>
  );
}

interface AddressCardProps {
  address: SavedAddress;
  isBusy: boolean;
  isDisabled: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onSetDefault: () => void;
}

/**
 * One saved address and what can be done to it.
 *
 * ⚠️ Every action names the address it acts on. "Edit" three times in a list
 * tells a screen reader nothing about which address is about to change, and
 * this is a screen where getting the wrong one deletes somebody's home address.
 */
function AddressCard({
  address,
  isBusy,
  isDisabled,
  onEdit,
  onRemove,
  onSetDefault,
}: AddressCardProps) {
  const theme = useTheme();

  const named = (action: string) => `${action}: ${address.formattedAddress}`;

  return (
    <Card
      bordered
      style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
      testID={`address-${address.id}`}>
      <View style={{ gap: theme.spacing.xs }}>
        {/*
          A word and a mark, not a tint. The default is the only thing
          distinguishing one card from another here, so it must survive being
          seen in greyscale.
        */}
        {address.isDefault ? (
          <View style={[styles.badge, { gap: theme.spacing.xs }]}>
            <Icon name="selected" size="sm" color="primary" />
            <Text variant="label" color="primary">
              {COPY.defaultBadge}
            </Text>
          </View>
        ) : null}

        <Text
          variant="body"
          accessibilityLabel={
            address.isDefault
              ? `${address.formattedAddress}. ${COPY.defaultSpoken}`
              : address.formattedAddress
          }
          testID={`address-${address.id}-text`}>
          {address.formattedAddress}
        </Text>
      </View>

      <View style={[styles.actions, { gap: theme.spacing.sm }]}>
        {/* Offered only where it means something: the default is already it. */}
        {address.isDefault ? null : (
          <SecondaryButton
            label={COPY.setDefault}
            onPress={onSetDefault}
            isLoading={isBusy}
            disabled={isDisabled}
            accessibilityLabel={named(COPY.setDefault)}
            accessibilityHint={COPY.setDefaultHint}
            style={styles.action}
          />
        )}
        <SecondaryButton
          label={COPY.edit}
          icon="edit"
          onPress={onEdit}
          disabled={isDisabled}
          accessibilityLabel={named(COPY.editHint)}
          style={styles.action}
        />
        <Button
          label={COPY.remove}
          variant="danger"
          icon="remove"
          onPress={onRemove}
          disabled={isDisabled}
          accessibilityLabel={named(COPY.removeHint)}
          style={styles.action}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  bar: {
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  /* Side by side where they fit, stacked where they do not — as ConfirmDialog. */
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  action: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: '40%',
  },
});
