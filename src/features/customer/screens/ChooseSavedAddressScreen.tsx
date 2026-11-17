/**
 * ChooseSavedAddressScreen
 *
 * One of the customer's saved addresses, chosen as the address for the request
 * they are raising (PROJECT_BIBLE.md section 18's "address selection", over the
 * book Phase 3D-9 built).
 *
 * ⚠️ A detour from the address step, not a step. It is pushed from Service
 * Address and pops straight back to it: choosing copies the address into the
 * draft, and Service Address — which reads its address back out of the draft —
 * shows it in the box, where the customer can still edit it before continuing.
 * Nothing is sent from here and nothing moves the flow forward.
 *
 * ⚠️ It changes nothing in the book. There is no add, edit, delete or "set as
 * default" here; the book is managed from Profile. A request copies the address
 * by value (see `useSavedAddresses`), so this screen cannot alter a saved record
 * and a saved record cannot later alter the request.
 *
 * ⚠️ One choice, once. A second tap landing before the stack has moved would
 * pop a second screen — Service Address itself — so the first choice is the
 * only one acted on.
 *
 * Service Address offers this only when the book has something in it, so the
 * empty and failed states here are the rare ones: the book emptied elsewhere in
 * the meantime, or a read that worked a moment ago failing now. Both say so,
 * and Back is always there — typing an address never depended on this screen.
 */

import React, { useCallback, useRef } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { SavedAddressOption } from '@/features/customer/components/SavedAddressOption';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useSavedAddresses } from '@/features/customer/hooks/useSavedAddresses';
import type { CustomerStackParamList } from '@/navigation/types';
import {
  BackButton,
  EmptyState,
  ErrorState,
  Screen,
  Skeleton,
  Text,
} from '@/shared/components';
import type { SavedAddress } from '@/shared/services/types/AddressBookService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.chooseSavedAddress;

/** Enough placeholder cards to read as a list without promising how many. */
const PLACEHOLDER_COUNT = 2;
/** Roughly an address card, so nothing jumps as the real ones arrive. */
const CARD_HEIGHT = 88;

type Props = NativeStackScreenProps<CustomerStackParamList, 'ChooseSavedAddress'>;

/** One identity for "nothing to list", so the list is not handed a new array every render. */
const NO_ADDRESSES: readonly SavedAddress[] = Object.freeze([]);

export function ChooseSavedAddressScreen({ navigation }: Props) {
  const theme = useTheme();
  const { addresses, isLoading, error, retry, chosenId, choose } = useSavedAddresses();

  const hasChosen = useRef(false);

  const pick = useCallback(
    (address: SavedAddress) => {
      if (hasChosen.current) {
        return;
      }
      hasChosen.current = true;

      choose(address);
      navigation.goBack();
    },
    [choose, navigation],
  );

  // In the service's order — the default first — never re-sorted here. Nothing
  // listed while the first read runs: the placeholders are the loading region's,
  // in the empty slot below, not lines of the list.
  const listed = isLoading ? NO_ADDRESSES : (addresses ?? NO_ADDRESSES);

  const renderAddress = useCallback(
    ({ item }: ListRenderItemInfo<SavedAddress>) => (
      <SavedAddressOption
        address={item}
        selected={item.id === chosenId}
        onSelect={pick}
        accessibilityHint={COPY.optionHint}
        testID={`saved-address-${item.id}`}
      />
    ),
    [chosenId, pick],
  );

  const heading = (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="hero" accessibilityRole="header" testID="choose-saved-address-heading">
        {COPY.title}
      </Text>
      <Text variant="subtitle" color="textSecondary">
        {COPY.subtitle}
      </Text>
    </View>
  );

  /*
    Nothing to list: the wait while the book is read, the failure when it could
    not be, otherwise an empty book. Inside the list rather than instead of it,
    so the heading stays and the screen keeps its name — the lesson from the
    categories screen.

    ⚠️ The wait is a region of its own: named for it and busy, with a `key`, so
    it is replaced — never updated into what follows. The list used to carry
    the label and the busy state itself, stated on every render because a prop
    that becomes undefined is not unset on a view updated in place (Sub
    Categories, found on device) — and loaded, the labelled list was a TalkBack
    stop of its own ("Your saved addresses") under a heading that had just said
    as much. Now the list carries neither, ever. Not fixed by giving the list a
    key per state: that would remount the heading inside it and drop TalkBack's
    focus from it when the book arrives.
  */
  const nothing = isLoading ? (
    <View
      key="loading"
      style={{ gap: theme.spacing.md }}
      accessibilityLabel={COPY.loadingLabel}
      accessibilityState={{ busy: true }}
      testID="choose-saved-address-loading">
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <Skeleton key={index} height={CARD_HEIGHT} radiusToken="lg" />
      ))}
    </View>
  ) : error ? (
    <ErrorState
      error={error}
      title={COPY.failedTitle}
      onRetry={retry}
      fullScreen={false}
      testID="choose-saved-address-error"
    />
  ) : (
    <EmptyState
      title={COPY.emptyTitle}
      message={COPY.emptyMessage}
      icon="location"
      fullScreen={false}
      testID="choose-saved-address-empty"
    />
  );

  return (
    <Screen
      padded={false}
      header={
        <View
          style={[
            styles.bar,
            { paddingHorizontal: theme.spacing.sm, height: theme.hitSlop.minTarget },
          ]}>
          <BackButton
            onPress={navigation.goBack}
            accessibilityLabel={COPY.back}
            accessibilityHint={COPY.backHint}
            testID="choose-saved-address-back"
          />
        </View>
      }
      testID="customer-choose-saved-address">
      <FlatList
        data={listed}
        keyExtractor={address => address.id}
        renderItem={renderAddress}
        ListHeaderComponent={heading}
        ListEmptyComponent={nothing}
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.screenPadding,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.xxxl,
            gap: theme.spacing.md,
          },
        ]}
        showsVerticalScrollIndicator={false}
        testID="choose-saved-address-list"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    justifyContent: 'center',
  },
  content: {
    // So the empty and error states can centre in the space under the heading.
    flexGrow: 1,
  },
});
