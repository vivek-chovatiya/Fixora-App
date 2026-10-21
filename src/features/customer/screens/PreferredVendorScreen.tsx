/**
 * PreferredVendorScreen
 *
 * Who the customer would like, if anyone (PROJECT_BIBLE.md section 18A).
 *
 * ⚠️ Two outcomes, and only two. A chosen vendor makes the request directed; no
 * choice makes it open dispatch, where the backend finds eligible vendors and
 * broadcasts to them. This screen decides which of those the customer is in and
 * nothing else — it does not rank, filter, re-order, compute distance, judge
 * availability or notify anybody, all of which section 18A.1 puts squarely on
 * the backend.
 *
 * Nothing is selected when it opens. Section 19 says the customer must never
 * reach Submit unsure whether a vendor was chosen, and a preselected option is
 * exactly how someone ends up unsure — so both outcomes are offered and one has
 * to be picked.
 *
 * ⚠️ Neither an empty list nor a failed one may stop a request. Section 18A.4 is
 * explicit about both, so "no preference" is rendered outside the query's
 * states: it is there while the vendors are loading, there when there are none,
 * and there when the request for them failed.
 *
 * It collects; it does not send. The details and the service address were
 * collected on the two screens before this one and carried here on the draft,
 * and the summary that follows is the only place a request is created. This
 * paragraph used to say the opposite, which was true for exactly as long as
 * there was no confirmation screen to disagree with it.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { NoPreferenceOption } from '@/features/customer/components/NoPreferenceOption';
import { Skeleton } from '@/features/customer/components/Skeleton';
import { VendorOption } from '@/features/customer/components/VendorOption';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useEligibleVendors } from '@/features/customer/hooks/useEligibleVendors';
import { useRequestDraft } from '@/features/customer/state/RequestDraftContext';
import { NO_VENDOR_CHOICE, type VendorChoice } from '@/features/customer/state/requestDraft';
import type { CustomerStackParamList } from '@/navigation/types';
import {
  BackButton,
  EmptyState,
  ErrorState,
  PrimaryButton,
  Screen,
  Text,
} from '@/shared/components';
import { useAnalytics } from '@/shared/hooks/useAnalytics';
import type { UseServiceQueryResult } from '@/shared/hooks/useServiceQuery';
import type { EligibleVendor } from '@/shared/services/types/VendorService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.preferredVendor;

/** Enough placeholder cards to fill a phone, so the wait has the page's shape. */
const PLACEHOLDER_COUNT = 4;
/** Height of a vendor card, used only to reserve its space while one loads. */
const CARD_HEIGHT = 88;

type Props = NativeStackScreenProps<CustomerStackParamList, 'PreferredVendor'>;

/** One identity for "nothing to list", so the list is not handed a new array every render. */
const NO_VENDORS: readonly EligibleVendor[] = Object.freeze([]);

/**
 * Why a customer went on without a professional, for section 54's
 * `vendor_selection_skipped` — read from the list as it stood when they did.
 *
 * ⚠️ Four answers rather than one, because section 54 names this event as how
 * section 58 learns whether customers want to choose a vendor at all, and only
 * `chosen_none` answers that: a list was on screen and nobody was picked. An
 * empty list (`list_empty`) or a failed one (`list_failed`) left nothing to
 * choose from — section 18A.4 lets the request through either way — and
 * `list_loading` went on before the list arrived. Counting any of those three
 * as a refusal would answer section 58's question on the customer's behalf.
 */
type SkipReason = 'chosen_none' | 'list_empty' | 'list_failed' | 'list_loading';

function skipReason({
  data,
  error,
  isLoading,
}: Pick<UseServiceQueryResult<EligibleVendor[]>, 'data' | 'error' | 'isLoading'>): SkipReason {
  // Loading first: a retry clears the failure as it starts, so a list being
  // read again is loading, not failed.
  if (isLoading) {
    return 'list_loading';
  }
  if (error) {
    return 'list_failed';
  }
  return data && data.length > 0 ? 'chosen_none' : 'list_empty';
}

export function PreferredVendorScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { categoryId, subCategoryId } = route.params;

  const { draft, completion, updateDraft } = useRequestDraft();
  const vendors = useEligibleVendors(categoryId, subCategoryId);

  /*
    The answer lives on the draft, not on this screen.

    That is what lets it survive going back to change a date, closing the app, and
    being resumed from Home days later — and it is what lets one validator, rather
    than each screen in turn, decide whether the request may go to the summary.
  */
  const choice: VendorChoice = draft?.vendor ?? NO_VENDOR_CHOICE;
  const [hasTriedToContinue, setHasTriedToContinue] = useState(false);

  const { data, isLoading, error, retry } = vendors;

  /*
    Section 54's dispatch decision — `vendor_selected` or
    `vendor_selection_skipped` — said when the customer moves on with it, not
    as cards are tapped: tapping through three vendors is looking, and the
    choice is what Continue carries forward.

    Once per decision. The answer last said is remembered, so the same answer
    confirmed again — a second tap on Continue, or Back from the summary and
    Continue with nothing changed — is not a second decision. A changed mind is,
    and is said.
  */
  const { track } = useAnalytics();
  const announced = useRef<string | null>(null);

  /*
    Nothing drafted means nothing to choose a professional for.

    Only the details screen and a resume from Home reach here, and both leave a
    draft behind, so this is a wiring failure rather than a state a customer can
    reach. Going back is the honest response: better than a Continue button that
    silently does nothing, and better than a crash for something recoverable.
  */
  useEffect(() => {
    if (!draft) {
      navigation.goBack();
    }
  }, [draft, navigation]);

  const chooseVendor = useCallback(
    (vendorId: string) => {
      // Replacing the whole choice is what makes this single-select: there is one
      // value, so selecting anything deselects everything else by construction
      // rather than by remembering to clear the others.
      updateDraft({ vendor: { kind: 'vendor', vendorId } });
    },
    [updateDraft],
  );

  const chooseOpen = useCallback(() => {
    updateDraft({ vendor: { kind: 'open' } });
  }, [updateDraft]);

  const onContinue = useCallback(() => {
    setHasTriedToContinue(true);

    if (!completion) {
      return;
    }

    /*
      Its own question first, and only its own.

      An unanswered vendor question is not a technical failure and is not
      reported as one: the customer is left exactly where they are, with a
      sentence naming the two answers available to them. Section 19 requires that
      nobody reaches the summary unsure whether a vendor was chosen, and this is
      what makes that true — there is no path past here that has not answered it.
    */
    if (!completion.isVendorResolved) {
      return;
    }

    /*
      ⚠️ An earlier answer has gone missing, so go back for it rather than
      refusing.

      This screen used to guard on `isReadyForReview`, which was correct while it
      was the last question — and became a silent dead end the moment the address
      step was added in front of it. Found on device: with the address cleared,
      Continue did nothing at all, because the only message this screen has is
      about vendors and the vendor question was answered.

      Sending them to the step that is actually incomplete is the useful
      response, and `completionOf` already knows which one that is. Nothing is
      cleared on the way; the draft is what holds the answers.
    */
    if (!completion.isReadyForReview) {
      navigation.navigate(completion.step === 'details' ? 'CreateRequest' : 'ServiceAddress', {
        categoryId,
        subCategoryId,
      });
      return;
    }

    // Only here, on the way forward: going back for a missing answer above is
    // not moving on with this one, and it is said when they come back past it.
    const decision = choice.kind === 'vendor' ? `vendor:${choice.vendorId}` : choice.kind;
    if (announced.current !== decision) {
      announced.current = decision;

      if (choice.kind === 'vendor') {
        track('vendor_selected', { categoryId, subCategoryId, vendorId: choice.vendorId });
      } else {
        track('vendor_selection_skipped', {
          categoryId,
          subCategoryId,
          reason: skipReason({ data, error, isLoading }),
        });
      }
    }

    navigation.navigate('RequestConfirmation', { categoryId, subCategoryId });
  }, [
    completion,
    navigation,
    categoryId,
    subCategoryId,
    choice,
    track,
    data,
    error,
    isLoading,
  ]);

  // In the backend's order, untouched. Section 18A.2: the order is the
  // recommendation. Nothing listed while the first read runs: the placeholders
  // are the loading region's, in the empty slot below, not rows of the list.
  const listed = isLoading ? NO_VENDORS : (data ?? NO_VENDORS);

  const renderVendor = useCallback(
    ({ item }: ListRenderItemInfo<EligibleVendor>) => (
      <VendorOption
        vendor={item}
        selected={choice.kind === 'vendor' && choice.vendorId === item.id}
        onSelect={chooseVendor}
        testID={`vendor-${item.id}`}
      />
    ),
    [choice, chooseVendor],
  );

  const heading = (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="hero" accessibilityRole="header" testID="preferred-vendor-heading">
        {COPY.title}
      </Text>
      <Text variant="subtitle" color="textSecondary">
        {COPY.subtitle}
      </Text>
    </View>
  );

  /*
    The wait, as a region of its own: named for it and busy, keyed so that it is
    replaced rather than updated into what follows — see the note on the list's
    empty slot below.
  */
  const waiting = (
    <View
      key="loading"
      style={{ gap: theme.spacing.md }}
      accessibilityLabel={COPY.loadingLabel}
      accessibilityState={{ busy: true }}
      testID="preferred-vendor-loading">
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <Skeleton key={index} height={CARD_HEIGHT} radiusToken="lg" />
      ))}
    </View>
  );

  /*
    Below the list rather than above it, and outside every one of the list's
    states.

    Section 18A.5 wants this visible and first-class; section 18A.4 wants it
    available when the list is empty or failed. Putting it under the vendors
    satisfies both without pretending it is one of them — it is the answer for
    someone who has read the list and not picked anybody, which is where they
    will be looking.
  */
  const footer = (
    <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.md }}>
      <NoPreferenceOption
        selected={choice.kind === 'open'}
        onSelect={chooseOpen}
        testID="vendor-no-preference"
      />

      {/*
        Said once the customer has asked to continue, not before. A screen that
        complains about an unanswered question the moment it opens is a screen
        that starts by telling someone off.
      */}
      {hasTriedToContinue && !completion?.isVendorResolved ? (
        <Text
          variant="caption"
          color="danger"
          accessibilityLiveRegion="polite"
          testID="preferred-vendor-required">
          {COPY.chooseFirst}
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
            testID="preferred-vendor-back"
          />
        </View>
      }
      testID="customer-preferred-vendor">
      <FlatList
        data={listed}
        keyExtractor={vendor => vendor.id}
        renderItem={renderVendor}
        ListHeaderComponent={heading}
        /*
          Waiting, failure and emptiness are all "the list has nothing in it", so
          all three live here rather than replacing the list — which would take
          the heading and, far worse, the footer with them, leaving a customer
          whose vendor list failed with no way to send a request section 18A.4
          says must still be sendable.

          ⚠️ The wait is a region of its own: named for it and busy, with a
          `key`, so it is replaced — never updated into what follows. Here that
          key is load-bearing: the failure below is a plain `View` too, and
          without different keys React would update the one into the other and
          the native view could keep `busy` (a prop that becomes undefined is not
          unset — Sub Categories, found on device). The list used to carry the
          label and the busy state itself, on every render — and loaded, it was a
          TalkBack stop of its own ("Available professionals") under a heading
          and subtitle that had just said as much. Now the list carries neither,
          ever. Not fixed by giving the list a key per state: that would remount
          the heading inside it and drop TalkBack's focus from it when the
          vendors land.
        */
        ListEmptyComponent={
          isLoading ? (
            waiting
          ) : error ? (
            <View style={{ gap: theme.spacing.sm }}>
              <ErrorState
                error={error}
                onRetry={retry}
                fullScreen={false}
                testID="preferred-vendor-error"
              />
              <Text variant="caption" color="textSecondary" align="center">
                {COPY.errorFallback}
              </Text>
            </View>
          ) : (
            <EmptyState
              title={COPY.emptyTitle}
              message={COPY.emptyMessage}
              icon="team"
              fullScreen={false}
              testID="preferred-vendor-empty"
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
        testID="preferred-vendor-list"
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
});
