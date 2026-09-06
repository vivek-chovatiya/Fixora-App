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
 * This is where the request is actually created. The details were collected on
 * the previous screen and carried here as a draft; what happens after creation
 * is sections 19 and 20, which are not built.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { NoPreferenceOption } from '@/features/customer/components/NoPreferenceOption';
import { Skeleton } from '@/features/customer/components/Skeleton';
import { VendorOption } from '@/features/customer/components/VendorOption';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useCreateRequest } from '@/features/customer/hooks/useCreateRequest';
import { useEligibleVendors } from '@/features/customer/hooks/useEligibleVendors';
import { useRequestDraft } from '@/features/customer/state/RequestDraftContext';
import type { CustomerStackParamList } from '@/navigation/types';
import {
  BackButton,
  EmptyState,
  ErrorState,
  PrimaryButton,
  Screen,
  Text,
  useToast,
} from '@/shared/components';
import type { EligibleVendor } from '@/shared/services/types/VendorService';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.preferredVendor;

/** Enough placeholder cards to fill a phone, so the wait has the page's shape. */
const PLACEHOLDER_COUNT = 4;
/** Height of a vendor card, used only to reserve its space while one loads. */
const CARD_HEIGHT = 88;

type Props = NativeStackScreenProps<CustomerStackParamList, 'PreferredVendor'>;

/**
 * The customer's answer.
 *
 * Three states, not two: "not yet chosen" is different from "chose nobody", and
 * collapsing them into a nullable vendor id is what would let an unanswered
 * screen submit as though open dispatch had been asked for.
 */
type Choice = { kind: 'none' } | { kind: 'open' } | { kind: 'vendor'; vendorId: string };

/** What occupies one row: a real vendor, or a placeholder standing in for one. */
type Row =
  | { kind: 'vendor'; key: string; vendor: EligibleVendor }
  | { kind: 'placeholder'; key: string };

export function PreferredVendorScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { showToast } = useToast();
  const { categoryId, subCategoryId } = route.params;

  const { draft, clearDraft } = useRequestDraft();
  const vendors = useEligibleVendors(categoryId, subCategoryId);
  const submission = useCreateRequest(categoryId, subCategoryId);

  const [choice, setChoice] = useState<Choice>({ kind: 'none' });
  const [hasTriedToSubmit, setHasTriedToSubmit] = useState(false);

  const { data, isLoading, error, retry } = vendors;

  /*
    Nothing to send means nothing to do here.

    Only the details screen navigates here, and it always leaves a draft behind,
    so this is a wiring failure rather than a state a customer can reach. Going
    back is the honest response: better than a Continue button that silently
    does nothing, and better than a crash for something recoverable.
  */
  useEffect(() => {
    if (!draft) {
      navigation.goBack();
    }
  }, [draft, navigation]);

  const chooseVendor = useCallback((vendorId: string) => {
    // Replacing the whole choice is what makes this single-select: there is one
    // value, so selecting anything deselects everything else by construction
    // rather than by remembering to clear the others.
    setChoice({ kind: 'vendor', vendorId });
  }, []);

  const chooseOpen = useCallback(() => {
    setChoice({ kind: 'open' });
  }, []);

  const submit = useCallback(() => {
    setHasTriedToSubmit(true);

    if (choice.kind === 'none' || !draft || submission.isSubmitting) {
      return;
    }

    void (async () => {
      /*
        The identifier, or nothing at all.

        `undefined` rather than null, an empty string or a sentinel: the request
        contract treats the field's absence as open dispatch, which is what the
        backend needs to see to broadcast rather than to look up a vendor that
        does not exist.
      */
      const created = await submission.submit(
        draft.values,
        draft.imageUrls,
        choice.kind === 'vendor' ? choice.vendorId : undefined,
      );

      if (!created) {
        return;
      }

      /*
        The end of what is built.

        Section 19's confirmation summary and section 20's request screen are
        where a submitted request is supposed to land, and neither exists. Rather
        than invent one, this hands over the reference section 19 asks for and
        returns the customer to the top of the application — not back to the form
        they have just sent, which is the one place they must not end up.
      */
      clearDraft();
      showToast({
        message: `${CUSTOMER_COPY.request.referencePrefix} ${created.id}`,
        tone: 'success',
        icon: 'success',
      });
      navigation.popToTop();
    })();
  }, [choice, draft, submission, clearDraft, showToast, navigation]);

  const rows = useMemo<Row[]>(() => {
    if (isLoading) {
      return Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => ({
        kind: 'placeholder' as const,
        key: `placeholder-${index}`,
      }));
    }

    // In the backend's order, untouched. Section 18A.2: the order is the
    // recommendation.
    return (data ?? []).map(vendor => ({
      kind: 'vendor' as const,
      key: vendor.id,
      vendor,
    }));
  }, [data, isLoading]);

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<Row>) => {
      if (item.kind === 'placeholder') {
        return <Skeleton height={CARD_HEIGHT} radiusToken="lg" />;
      }

      return (
        <VendorOption
          vendor={item.vendor}
          selected={choice.kind === 'vendor' && choice.vendorId === item.vendor.id}
          onSelect={chooseVendor}
          testID={`vendor-${item.vendor.id}`}
        />
      );
    },
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
        Said once the customer has asked to continue, not before. A form that
        complains about an unanswered question the moment it opens is a form
        that starts by telling someone off.
      */}
      {hasTriedToSubmit && choice.kind === 'none' ? (
        <Text
          variant="caption"
          color="danger"
          accessibilityLiveRegion="polite"
          testID="preferred-vendor-required">
          {COPY.chooseFirst}
        </Text>
      ) : null}

      {/*
        No retry of its own. The failure below is the creation failing, and the
        button under it is what tries again — a second full-width action saying
        the same thing is the mistake the details screen already made once.
      */}
      {submission.error ? (
        <ErrorState
          error={submission.error}
          fullScreen={false}
          testID="preferred-vendor-submit-error"
        />
      ) : null}

      <PrimaryButton
        label={COPY.submit}
        onPress={submit}
        fullWidth
        isLoading={submission.isSubmitting}
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
        data={rows}
        keyExtractor={row => row.key}
        renderItem={renderRow}
        ListHeaderComponent={heading}
        /*
          Failure and emptiness are both "the list has nothing in it", so both
          live here rather than replacing the list — which would take the heading
          and, far worse, the footer with them, leaving a customer whose vendor
          list failed with no way to send a request section 18A.4 says must
          still be sendable.
        */
        ListEmptyComponent={
          error ? (
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
        /*
          Named in both states, and busy stated in both states — the lesson from
          the sub-categories list, where a region carrying a state but no label
          announced itself as "busy", and dropping the state once loaded did not
          clear it because the view is updated rather than remounted.
        */
        accessibilityLabel={isLoading ? COPY.loadingLabel : COPY.optionsLabel}
        accessibilityState={{ busy: isLoading }}
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
