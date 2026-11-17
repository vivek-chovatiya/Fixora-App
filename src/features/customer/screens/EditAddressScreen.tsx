/**
 * EditAddressScreen
 *
 * Saving a new address, or changing one already saved (PROJECT_BIBLE.md
 * section 18's "add address" and "edit address").
 *
 * ⚠️ It finds addresses the way the rest of the app does. `useAddressSearch`
 * and `AddressService` are the same gazetteer the service-address step uses,
 * and `isUsableAddress` is the same rule — reused rather than reimplemented, so
 * there is one answer to "is this an address" and one place a real provider
 * plugs into. Nothing here talks to a geocoder itself.
 *
 * ⚠️ No label, no map, no pin. Section 63 puts Home / Office / Other and map
 * selection in Phase 2; this screen is a box and a list of candidates.
 *
 * ⚠️ What the customer cannot see, they cannot edit. `placeId` and the
 * coordinates come from whichever suggestion was chosen and are carried along
 * silently; they are replaced only when a different suggestion is chosen, and
 * dropped when the address is typed by hand — because coordinates kept beside
 * a line somebody has since rewritten would point at the old place. `id` and
 * `isDefault` are not on this form at all: which address is default is changed
 * from the list, so saving an edit can never quietly move it.
 *
 * ⚠️ Leaving with an unsaved address asks first, through `beforeRemove` so that
 * the Android back button and the back gesture are guarded too — the lesson
 * Edit Profile paid for in 3D-8.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NavigationAction } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AddressSuggestionRow } from '@/features/customer/components/AddressSuggestionRow';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useAddressSearch } from '@/features/customer/hooks/useAddressSearch';
import { useSavedAddressEditor } from '@/features/customer/hooks/useSavedAddressEditor';
import { isUsableAddress } from '@/features/customer/validation/addressRules';
import type { CustomerStackParamList } from '@/navigation/types';
import {
  BackButton,
  Button,
  ConfirmDialog,
  ErrorState,
  Input,
  Screen,
  Text,
} from '@/shared/components';
import type {
  SavedAddress,
  SavedAddressInput,
} from '@/shared/services/types/AddressBookService';
import type { AddressSuggestion } from '@/shared/services/types/AddressService';
import { ADDRESS_MAX_LENGTH } from '@/features/customer/validation/addressRules';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.addressBook;
const ADDRESS_COPY = CUSTOMER_COPY.serviceAddress;

type Props = NativeStackScreenProps<CustomerStackParamList, 'EditAddress'>;

/**
 * What the customer typed, as an address in its own right.
 *
 * No coordinates, no locality, no placeId — the app was told a line of text and
 * asserts nothing beyond it. The same escape hatch `ServiceAddressScreen` has,
 * and the reason a failing provider is never a dead end here either.
 */
function typedAddress(text: string): SavedAddressInput {
  return { formattedAddress: text.trim() };
}

/** Everything a chosen suggestion knew, kept for the request it will become. */
function fromSuggestion(suggestion: AddressSuggestion): SavedAddressInput {
  const { formattedAddress, addressLine, locality, postalCode, placeId, latitude, longitude } =
    suggestion.address;

  return {
    formattedAddress,
    ...(addressLine ? { addressLine } : {}),
    ...(locality ? { locality } : {}),
    ...(postalCode ? { postalCode } : {}),
    ...(placeId ? { placeId } : {}),
    ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
  };
}

/** The saved record, as the form's starting value. */
function fromSaved(address: SavedAddress): SavedAddressInput {
  const { formattedAddress, addressLine, locality, postalCode, placeId, latitude, longitude } =
    address;

  return {
    formattedAddress,
    ...(addressLine ? { addressLine } : {}),
    ...(locality ? { locality } : {}),
    ...(postalCode ? { postalCode } : {}),
    ...(placeId ? { placeId } : {}),
    ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
  };
}

export function EditAddressScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const addressId = route.params?.addressId;
  const isEditing = addressId !== undefined;

  // Read from the service rather than passed in — see the hook for why.
  const { saved, save } = useSavedAddressEditor(addressId);

  const existing = useMemo(
    () => saved.data?.find(address => address.id === addressId),
    [addressId, saved.data],
  );

  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<SavedAddressInput | null>(null);
  const [showError, setShowError] = useState(false);

  // Seeded once, when the record arrives.
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && existing) {
      seeded.current = true;
      setQuery(existing.formattedAddress);
      setChosen(fromSaved(existing));
    }
  }, [existing]);

  const search = useAddressSearch(query);

  /*
    The chosen suggestion while the box still reads as it did when it was
    chosen; otherwise whatever has been typed since.

    Rewriting the line by hand is how somebody corrects a flat number the
    gazetteer did not know, and the metadata from the old suggestion would no
    longer describe it — so it goes with the text it belonged to.
  */
  const input: SavedAddressInput | null = useMemo(() => {
    const text = query.trim();
    if (!text) {
      return null;
    }
    if (chosen && chosen.formattedAddress.trim() === text) {
      return chosen;
    }
    return typedAddress(text);
  }, [chosen, query]);

  const isValid = isUsableAddress(input ? { formattedAddress: input.formattedAddress } : null);

  const allowLeave = useRef(false);
  const interrupted = useRef<NavigationAction | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  /** Untouched while adding, or unchanged while editing, leaves without a word. */
  const isDirty = isEditing
    ? existing !== undefined && query.trim() !== existing.formattedAddress.trim()
    : query.trim().length > 0;

  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (allowLeave.current || !isDirty || save.isSubmitting) {
          return;
        }
        event.preventDefault();
        interrupted.current = event.data.action;
        setIsDiscarding(true);
      }),
    [isDirty, navigation, save.isSubmitting],
  );

  const onSave = useCallback(async () => {
    if (!input || !isValid) {
      // Says what is wrong rather than doing nothing when Save is pressed.
      setShowError(true);
      return;
    }
    const result = await save.mutate(input);
    if (result !== null) {
      allowLeave.current = true;
      navigation.goBack();
    }
  }, [input, isValid, navigation, save]);

  const chooseSuggestion = useCallback((suggestion: AddressSuggestion) => {
    const next = fromSuggestion(suggestion);
    setChosen(next);
    setQuery(next.formattedAddress);
    setShowError(false);
  }, []);

  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    setShowError(false);
  }, []);

  const confirmDiscard = useCallback(() => {
    setIsDiscarding(false);
    allowLeave.current = true;

    const action = interrupted.current;
    interrupted.current = null;
    if (action) {
      navigation.dispatch(action);
      return;
    }
    navigation.goBack();
  }, [navigation]);

  const keepEditing = useCallback(() => {
    interrupted.current = null;
    setIsDiscarding(false);
  }, []);

  const heading = isEditing ? COPY.editTitle : COPY.addTitle;

  return (
    <Screen
      scrollable
      keyboardAvoiding
      header={
        <View
          style={[
            styles.bar,
            { paddingHorizontal: theme.spacing.sm, height: theme.hitSlop.minTarget },
          ]}>
          <BackButton
            onPress={navigation.goBack}
            accessibilityLabel={COPY.title}
            testID="edit-address-back"
          />
        </View>
      }
      contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
      testID="customer-edit-address">
      <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.xs }}>
        <Text variant="hero" accessibilityRole="header" testID="edit-address-heading">
          {heading}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {isEditing ? COPY.editSubtitle : COPY.addSubtitle}
        </Text>
      </View>

      <Input
        label={ADDRESS_COPY.searchLabel}
        placeholder={ADDRESS_COPY.searchPlaceholder}
        value={query}
        onChangeText={onChangeText}
        error={showError && !isValid ? ADDRESS_COPY.tooShort : undefined}
        maxLength={ADDRESS_MAX_LENGTH}
        autoCapitalize="words"
        multiline
        radiusToken="lg"
        testID="edit-address-input"
      />

      {/* The provider failing is not a dead end: what was typed still saves. */}
      {search.error ? (
        <ErrorState
          error={search.error}
          title={COPY.searchFailedTitle}
          fullScreen={false}
          testID="edit-address-search-error"
        />
      ) : null}

      <View style={{ gap: theme.spacing.xs }} testID="edit-address-suggestions">
        {search.suggestions.map(suggestion => (
          <AddressSuggestionRow
            key={suggestion.id}
            suggestion={suggestion}
            selected={chosen?.placeId === suggestion.address.placeId && chosen?.placeId !== undefined}
            onSelect={chooseSuggestion}
            testID={`edit-address-suggestion-${suggestion.id}`}
          />
        ))}
      </View>

      <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.xs }}>
        {save.error ? (
          <ErrorState
            error={save.error}
            title={COPY.saveFailedTitle}
            fullScreen={false}
            testID="edit-address-error"
          />
        ) : null}

        <Button
          label={save.isSubmitting ? COPY.saving : COPY.save}
          onPress={onSave}
          isLoading={save.isSubmitting}
          fullWidth
          accessibilityHint={COPY.saveHint}
        />
      </View>

      <ConfirmDialog
        visible={isDiscarding}
        title={COPY.discardTitle}
        message={COPY.discardMessage}
        cancelLabel={COPY.discardKeep}
        cancelHint={COPY.discardKeepHint}
        confirmLabel={COPY.discardConfirm}
        confirmHint={COPY.discardConfirmHint}
        onCancel={keepEditing}
        onConfirm={confirmDiscard}
        testID="edit-address-discard-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    justifyContent: 'center',
  },
});
