/**
 * ServiceAddressScreen
 *
 * Where the work is to be done (PROJECT_BIBLE.md section 18).
 *
 * ⚠️ The address is required and the device's location is not, and every
 * decision on this screen follows from that one sentence. Typing is the primary
 * path and is always sufficient; "use my location" is a shortcut that fills the
 * box in. A customer who refuses the permission, whose phone has no fix, or
 * whose street is in nobody's gazetteer must still finish this screen — so
 * nothing here is gated on a provider answering and nothing is gated on a
 * dialog being accepted.
 *
 * ⚠️ Three sources, one answer. A suggestion chosen from the list, a position
 * resolved from the device, and a line the customer typed themselves all become
 * the same `RequestAddress` on the draft. The screen holds no address of its
 * own: what has been chosen is read back out of the draft, which is what makes
 * leaving and coming back cost nothing.
 *
 * ⚠️ A resolved location is shown, never applied silently. Turning a coordinate
 * into a street is a guess even with a real provider, and the customer is the
 * only one who can say whether it is their street — so it lands in the box as a
 * proposal with a sentence asking them to check it.
 *
 * It collects; it does not send. Section 13 puts the vendor question after this
 * one, and submission after that.
 *
 * ⚠️ A fourth source, from outside the screen. A customer with saved addresses
 * is offered "Use a saved address", which opens a picker that copies one into
 * the draft and pops back. This screen stays mounted underneath, so it takes up
 * an address it finds on the draft that it did not put there itself — see the
 * effect beside `kept`. The offer is never a gate: it is absent while the book
 * is read, when the read fails and when the book is empty.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AddressSuggestionRow } from '@/features/customer/components/AddressSuggestionRow';
import { Skeleton } from '@/features/customer/components/Skeleton';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useAddressSearch } from '@/features/customer/hooks/useAddressSearch';
import { useCurrentLocation } from '@/features/customer/hooks/useCurrentLocation';
import { useSavedAddresses } from '@/features/customer/hooks/useSavedAddresses';
import { useRequestDraft } from '@/features/customer/state/RequestDraftContext';
import { isUsableAddress, ADDRESS_MAX_LENGTH } from '@/features/customer/validation/addressRules';
import type { CustomerStackParamList } from '@/navigation/types';
import type { AddressSuggestion } from '@/shared/services/types/AddressService';
import type { RequestAddress } from '@/shared/services/types/RequestService';
import {
  BackButton,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Text,
} from '@/shared/components';
import { useNavigationEvent } from '@/shared/hooks/useNavigationEvent';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.serviceAddress;
const LOCATION_COPY = CUSTOMER_COPY.location;

/** Placeholder rows while the provider is being asked. */
const SKELETON_ROWS = 3;
const ROW_HEIGHT = 72;

type Props = NativeStackScreenProps<CustomerStackParamList, 'ServiceAddress'>;

/** A skeleton stands in for a row that has not arrived; a suggestion is a row. */
type Row =
  | { kind: 'placeholder'; key: string }
  | { kind: 'suggestion'; key: string; suggestion: AddressSuggestion };

/**
 * What the customer typed, as an address in its own right.
 *
 * ⚠️ The escape hatch that keeps this screen honest, and the reason a failing
 * provider is never a dead end. No coordinates, no locality, no placeId — the
 * app was told a line of text and asserts nothing beyond it, which is exactly
 * what `RequestAddress` is shaped to allow.
 */
function typedAddress(text: string): RequestAddress {
  return { formattedAddress: text.trim() };
}

export function ServiceAddressScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { categoryId, subCategoryId } = route.params;

  const { draft, updateDraft, completion } = useRequestDraft();

  /**
   * What is in the box.
   *
   * Seeded once from the draft and owned by this screen from then on — the same
   * arrangement the details form uses, and for the same reason: re-reading the
   * draft on every render would fight whatever the customer is typing.
   */
  const chosen = draft?.address ?? null;
  const [query, setQuery] = useState(() => chosen?.formattedAddress ?? '');

  /**
   * What was resolved or picked, so an untouched selection is not re-typed.
   *
   * A suggestion carries a locality, a postcode and a point; the text in the box
   * carries none of that. Keeping the rich version means choosing "Koramangala"
   * and pressing Continue sends the coordinates too, while editing the text
   * afterwards correctly falls back to what the customer actually wrote.
   */
  const resolved = useRef<RequestAddress | null>(chosen);

  /**
   * Whether the customer settled on the typed text rather than a match.
   *
   * The only part of "is this confirmed?" that cannot be read off the address
   * itself: a line somebody typed and then pressed *Use what I typed* on is
   * indistinguishable, as data, from the same line half-typed. Everything else
   * is derived below rather than mirrored, which is what stops it going stale
   * when the draft arrives after this screen has mounted.
   *
   * Also set for a saved address taken up from the draft. It was chosen on
   * purpose, and one saved by hand carries no handle or point to be matched by.
   */
  const [tookTypedText, setTookTypedText] = useState(false);

  /**
   * The address this screen last put on the draft, or found there on opening.
   *
   * How it tells its own writes from anybody else's: the draft stores the very
   * object `keep` was given, so an address on the draft that is not this one
   * was put there from outside.
   */
  const kept = useRef<RequestAddress | null>(chosen);

  /**
   * Counts the customer's explicit address actions, so a late answer can tell
   * it has been overtaken.
   *
   * ⚠️ The device's location can take seconds, and the screen stays usable
   * while it looks. Found in review: tap "Use my current location", choose a
   * saved address (or type) before it answers, and the late answer overwrote
   * the choice — box, draft and the address Continue would send. Every explicit
   * action bumps this, and so does leaving the screen (Continue, or anything
   * pushed on top); the location callback notes it when asked and keeps its
   * answer only if nothing has bumped it since. Asking for the location does not
   * bump it, so a second tap while it looks — which the hook ignores — cannot
   * orphan the answer to the first.
   */
  const addressTurn = useRef(0);

  const [hasTriedToContinue, setHasTriedToContinue] = useState(false);

  const search = useAddressSearch(query);
  const location = useCurrentLocation();
  const saved = useSavedAddresses();

  const trimmed = query.trim();

  /**
   * Whether the address in hand was matched rather than merely typed.
   *
   * ⚠️ It decides whether the confirmation card is drawn, and the distinction is
   * the point. Free text is already displayed by the box the customer is typing
   * into, so a card repeating it is a second copy of the same words — and, seen
   * on device, one that appeared the moment eight characters had been entered
   * and read as though a half-typed word had already been accepted.
   *
   * Read off the address rather than remembered: a provider's answer carries its
   * own handle and a device's carries a point, and a typed line carries neither.
   * Editing a matched address therefore un-matches it by construction, with no
   * flag to keep in step.
   */
  const isMatched =
    chosen !== null && (chosen.placeId !== undefined || chosen.latitude !== undefined);
  const isConfirmed = isMatched || tookTypedText;

  /**
   * Written to the draft as it is chosen, not only on the way out.
   *
   * The same lesson the details form learned: unmounting is the tidy signal that
   * somebody left, and being killed mid-flow is exactly what draft persistence
   * exists for. An address is one tap rather than a paragraph, so it is written
   * on the tap rather than on a timer.
   */
  const keep = useCallback(
    (address: RequestAddress | null) => {
      kept.current = address;
      updateDraft({ address });
    },
    [updateDraft],
  );

  /*
    An address put on the draft from elsewhere is taken up as if chosen here.

    The saved-address picker writes the draft and pops back, and this screen
    stays mounted underneath it the whole time with its box seeded once and
    owned since. Without this the draft would hold the saved address while the
    box still showed what was there before — and the next keystroke would write
    the box's old text over the customer's choice. So the box, the rich copy and
    the settled flag follow the draft: the box shows the line, the address
    counts as chosen, and a later edit drops its metadata exactly as an edited
    suggestion does.
  */
  useEffect(() => {
    if (chosen === kept.current) {
      return;
    }

    addressTurn.current += 1;
    kept.current = chosen;
    resolved.current = chosen;
    setQuery(chosen?.formattedAddress ?? '');
    setTookTypedText(chosen !== null);
  }, [chosen]);

  const pickSuggestion = useCallback(
    (suggestion: AddressSuggestion) => {
      addressTurn.current += 1;
      resolved.current = suggestion.address;
      setQuery(suggestion.address.formattedAddress);
      keep(suggestion.address);
    },
    [keep],
  );

  /*
    Proposed, not applied.

    The resolved address goes into the box and the draft so it survives an
    interruption, and the hook's own message asks the customer to check it.
    Nothing moves them forward — that is still a deliberate press of Continue.
  */
  const useLocation = useCallback(() => {
    // Noted, not bumped — see `addressTurn`.
    const askedAt = addressTurn.current;

    location.resolve(suggestion => {
      if (addressTurn.current !== askedAt) {
        // Overtaken: the customer has answered another way since asking.
        return false;
      }

      resolved.current = suggestion.address;
      setQuery(suggestion.address.formattedAddress);
      keep(suggestion.address);
      return true;
    });
  }, [location, keep]);

  /*
    Opens the saved addresses, which write their answer to the draft — never to
    a route — and come back here, where the effect beside `kept` takes it up.
    Going there is already answering another way, so a location still being
    looked for is not then dropped into the box underneath the picker.
  */
  const openSaved = useCallback(() => {
    addressTurn.current += 1;
    navigation.navigate('ChooseSavedAddress');
  }, [navigation]);

  /** Takes the typed line exactly as written, when no suggestion fits. */
  const useTyped = useCallback(() => {
    addressTurn.current += 1;
    resolved.current = null;
    // Chosen deliberately, so it earns the card even though nothing matched it.
    setTookTypedText(true);
    keep(typedAddress(trimmed));
  }, [keep, trimmed]);

  const clear = useCallback(() => {
    addressTurn.current += 1;
    resolved.current = null;
    setTookTypedText(false);
    setQuery('');
    keep(null);
  }, [keep]);

  const onChangeText = useCallback(
    (text: string) => {
      addressTurn.current += 1;
      setQuery(text);

      /*
        The draft follows the box, including back to nothing.

        Typing over a chosen address does not leave the old one on the draft to
        be silently submitted; an emptied box is an unanswered question again,
        which `completionOf` reads and the flow respects.
      */
      const next = text.trim();
      // Any edit un-settles a previously accepted typed line; a matched one
      // un-matches itself, because what is written loses its handle and point.
      setTookTypedText(false);

      if (next.length === 0) {
        resolved.current = null;
        keep(null);
        return;
      }

      const rich = resolved.current;
      const matches = rich !== null && rich.formattedAddress.trim() === next;

      keep(matches ? rich : typedAddress(next));
    },
    [keep],
  );

  const onContinue = useCallback(() => {
    setHasTriedToContinue(true);

    /*
      Asked of the draft, not of this screen's state.

      `completionOf` is the one authority on whether a request may move on, and
      checking it here rather than reasoning about the text box is what keeps
      this screen from becoming a second opinion that could disagree.
    */
    if (!completion?.isAddressComplete) {
      return;
    }

    // Moving on is an answer: a location still being looked for is not then
    // written under the screens that follow (see `addressTurn`).
    addressTurn.current += 1;
    navigation.navigate('PreferredVendor', { categoryId, subCategoryId });
  }, [completion, navigation, categoryId, subCategoryId]);

  /*
    Any way of leaving counts, not only Continue.

    Found in review: this screen stays mounted under Preferred Vendor and the
    summary, so a location that landed after Continue still called `keep` — the
    draft's address silently became the device's, Submit sent it, and "Is this
    right?" appeared on a screen the customer had left. Continue bumps the turn
    itself; this catches the rest (anything pushed on top). From the navigation
    context (`useNavigationEvent`) rather than the `navigation` prop, so a test
    rendering this screen without a navigator still renders — there it simply
    never blurs.
  */
  useNavigationEvent('blur', () => {
    addressTurn.current += 1;
  });

  const rows = useMemo<Row[]>(() => {
    if (search.isSearching) {
      return Array.from({ length: SKELETON_ROWS }, (_, index) => ({
        kind: 'placeholder' as const,
        key: `placeholder-${index}`,
      }));
    }

    return search.suggestions.map(suggestion => ({
      kind: 'suggestion' as const,
      key: suggestion.id,
      suggestion,
    }));
  }, [search.isSearching, search.suggestions]);

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<Row>) => {
      if (item.kind === 'placeholder') {
        return <Skeleton height={ROW_HEIGHT} radiusToken="lg" />;
      }

      return (
        <AddressSuggestionRow
          suggestion={item.suggestion}
          // Selected when it is the address currently held, matched on the
          // provider's own handle rather than on the string — two suggestions
          // can share a line and mean different buildings.
          selected={chosen?.placeId !== undefined && chosen.placeId === item.suggestion.id}
          onSelect={pickSuggestion}
          accessibilityHint={COPY.suggestionHint}
          testID={`address-suggestion-${item.suggestion.id}`}
        />
      );
    },
    [chosen?.placeId, pickSuggestion],
  );

  const header = (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header" testID="service-address-heading">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      <Input
        label={COPY.searchLabel}
        placeholder={COPY.searchPlaceholder}
        value={query}
        onChangeText={onChangeText}
        accessibilityLabel={COPY.searchLabel}
        accessibilityHint={COPY.searchHint}
        maxLength={ADDRESS_MAX_LENGTH}
        autoCapitalize="words"
        testID="service-address-input"
      />

      {/*
        The shortcut, under the box it fills in rather than above it.

        Typing is the primary path and reads first; this is the alternative for
        somebody who would rather not. It is never the only way forward, and it
        disappears for nobody — a blocked permission changes the message beside
        it, not whether this screen works.
      */}
      <View style={{ gap: theme.spacing.sm }}>
        <SecondaryButton
          label={location.phase === 'working' ? COPY.locating : COPY.useCurrentLocation}
          onPress={useLocation}
          icon="location"
          isLoading={location.phase === 'working'}
          fullWidth
          accessibilityHint={COPY.useCurrentLocationHint}
        />

        {location.message ? (
          <Text
            variant="caption"
            /*
              Never red. Every message this hook produces says the same thing —
              that route did not work, the other one is open — and none of them
              is the customer having done something wrong. Red on this screen is
              reserved for the one message that actually blocks them, and a
              colour that means two things means neither.
            */
            color="textSecondary"
            // Announced when it appears, because it is the answer to a button
            // the customer just pressed and they may not be looking at it.
            accessibilityLiveRegion="polite"
            testID="service-address-location-message">
            {location.message}
          </Text>
        ) : null}

        {/*
          Only when Settings is the actual route out. A blocked permission
          cannot be re-requested, so offering the dialog again would be a button
          that visibly does nothing.
        */}
        {location.phase === 'blocked' ? (
          <Button
            label={LOCATION_COPY.openSettings}
            variant="secondary"
            onPress={location.openSettings}
            accessibilityHint={LOCATION_COPY.openSettingsHint}
          />
        ) : null}

        {/*
          The saved addresses, for a customer who has some — the same kind of
          shortcut as the one above it, and just as optional. Nothing is drawn
          while the book is being read, when no read has worked, or when it is
          empty: none of those is the customer's problem, and typing is untouched
          by all three.

          Last in the group, under the location button and whatever it says,
          because it arrives a moment after the screen does: drawn above, it
          would push the location button down under a finger already on its way
          there (found in review).
        */}
        {saved.hasAny ? (
          <SecondaryButton
            label={COPY.useSaved}
            onPress={openSaved}
            icon="home"
            fullWidth
            accessibilityHint={COPY.useSavedHint}
          />
        ) : null}
      </View>

      {isConfirmed && chosen && isUsableAddress(chosen) ? (
        <Card bordered background="primarySubtle" style={{ padding: theme.spacing.lg }}>
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${COPY.selectedLabel}: ${chosen.formattedAddress}`}
            style={{ gap: theme.spacing.xxs }}
            testID="service-address-selected">
            <Text variant="overline" color="textTertiary">
              {COPY.selectedLabel}
            </Text>
            <Text variant="bodyStrong">{chosen.formattedAddress}</Text>
          </View>
        </Card>
      ) : null}
    </View>
  );

  /*
    Below the list and outside every one of its states.

    The same arrangement the vendor screen uses, for the same reason: a customer
    whose search failed or matched nothing must still be able to continue, and
    putting Continue inside the list would take it away exactly when it is needed
    most.
  */
  const footer = (
    <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.md }}>
      {/*
        The escape hatch, offered only once a search has actually come back
        empty. Before that it would be an invitation to give up on a list that
        is still arriving.
      */}
      {search.hasSearchedEmpty && !isConfirmed ? (
        <Button
          label={COPY.useTyped}
          variant="secondary"
          onPress={useTyped}
          accessibilityHint={COPY.useTypedHint}
        />
      ) : null}

      {isConfirmed && chosen && isUsableAddress(chosen) ? (
        <Button
          label={COPY.change}
          variant="secondary"
          onPress={clear}
          accessibilityHint={COPY.changeHint}
        />
      ) : null}

      {/*
        Said once Continue has been pressed, not before. A screen that complains
        about an unanswered question the moment it opens is a screen that starts
        by telling somebody off.
      */}
      {hasTriedToContinue && !completion?.isAddressComplete ? (
        <Text
          variant="caption"
          color="danger"
          accessibilityLiveRegion="polite"
          testID="service-address-required">
          {trimmed.length > 0 ? COPY.tooShort : COPY.required}
        </Text>
      ) : null}

      <PrimaryButton
        label={COPY.submit}
        onPress={onContinue}
        fullWidth
        // Never disabled. A dead button explains nothing; this one is pressable,
        // and pressing it is how the customer finds out what is still missing.
        accessibilityHint={COPY.submitHint}
      />
    </View>
  );

  return (
    <Screen
      padded={false}
      keyboardAvoiding
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
            testID="service-address-back"
          />
        </View>
      }
      testID="customer-service-address">
      <FlatList
        data={rows}
        keyExtractor={row => row.key}
        renderItem={renderRow}
        ListHeaderComponent={header}
        /*
          Emptiness has three meanings here and they are not interchangeable:
          nothing typed yet, a search that failed, and a search that found
          nothing. Only the last one is about the address itself, and only the
          last one offers the typed line as the answer.
        */
        ListEmptyComponent={
          /*
            Nothing at all once the question is answered.

            Seen on device: resolving an address from the device put the full
            postal line into the search box, the gazetteer had nothing matching
            it, and "No matching addresses" appeared underneath the address the
            customer had just been given. Every state below is about helping
            somebody find an address; none of them applies to somebody who has
            one.
          */
          isConfirmed && chosen && isUsableAddress(chosen) ? null : search.error ? (
            <View
              style={[styles.notice, { gap: theme.spacing.sm, paddingTop: theme.spacing.md }]}>
              <Icon name="warning" size="sm" color="textTertiary" />
              <Text
                variant="caption"
                color="textSecondary"
                style={styles.grow}
                testID="service-address-search-error">
                {/* The safe sentence only — never the provider's own message. */}
                {COPY.searchErrorFallback}
              </Text>
            </View>
          ) : search.hasSearchedEmpty ? (
            <EmptyState
              title={COPY.noResultsTitle}
              message={COPY.noResultsMessage}
              icon="location"
              fullScreen={false}
              testID="service-address-no-results"
            />
          ) : (
            <EmptyState
              title={COPY.emptyTitle}
              message={COPY.emptyMessage}
              icon="search"
              fullScreen={false}
              testID="service-address-empty"
            />
          )
        }
        ListFooterComponent={footer}
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
        keyboardShouldPersistTaps="handled"
        // Named in both states, and busy stated in both — the lesson from the
        // sub-categories list, where a region carrying a state but no label
        // announced itself as "busy".
        accessibilityLabel={COPY.suggestionsLabel}
        accessibilityState={{ busy: search.isSearching }}
        testID="service-address-list"
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
    flexGrow: 1,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  grow: {
    flex: 1,
  },
});
