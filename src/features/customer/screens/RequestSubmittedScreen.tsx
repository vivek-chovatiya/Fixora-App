/**
 * RequestSubmittedScreen
 *
 * The moment a request stops being the customer's problem (PROJECT_BIBLE.md
 * section 19).
 *
 * ⚠️ It confirms; it does not track. It says what was sent, hands over the
 * reference section 19 asks for, and offers two ways on: the request itself
 * (section 20), or Home. Everything it shows is something the customer already
 * told Fixora or the backend just told the app; nothing here is a status, an
 * estimate or a promise about when anybody will arrive.
 *
 * ⚠️ It claims nobody has been notified, and that is deliberate. Section 18A
 * puts dispatch on the backend, and this application has no way of knowing
 * whether a message reached a phone — so the wording says where the request was
 * pointed, never that anyone has seen it.
 *
 * ⚠️ There is nothing behind it. It is reached by `reset`, not `navigate`, so
 * the four screens that collected the request are gone by the time it renders.
 * A Back gesture goes home. That is the whole protection against sending the
 * same request twice: the form it was sent from no longer exists, so there is no
 * Submit button left to press.
 *
 * The reference and the address come from `RequestDraftContext`, which recorded
 * them in the same instant it destroyed the draft. They are not route params,
 * because an address in a route param is an address in a crash report.
 *
 * ⚠️ That record is a handoff and nothing more. Opening the request passes its
 * reference to request details, which reads the request back from
 * `RequestService` — the success screen is gone by then, and a record that only
 * existed while this screen did would not be a record.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RequestReference } from '@/features/customer/components/RequestReference';
import { CUSTOMER_COPY } from '@/features/customer/constants/customerCopy';
import { useEligibleVendors } from '@/features/customer/hooks/useEligibleVendors';
import { useRequestServiceContext } from '@/features/customer/hooks/useRequestServiceContext';
import { useRequestDraft } from '@/features/customer/state/RequestDraftContext';
import type { CustomerStackParamList } from '@/navigation/types';
import { Button, Card, Icon, PrimaryButton, Screen, Text } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const COPY = CUSTOMER_COPY.requestSubmitted;

/** Diameter of the success mark, in dp. Large enough to be the first thing read. */
const MARK_SIZE = 88;

type Props = NativeStackScreenProps<CustomerStackParamList, 'RequestSubmitted'>;

/** One line of the summary. Deliberately the same shape as the review screen's. */
function SummaryLine({
  icon,
  label,
  value,
  testID,
}: {
  icon: 'business' | 'team' | 'location' | 'requests';
  label: string;
  value: string;
  testID?: string;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="text"
      // One node, not three. Read separately a screen reader says "Going to",
      // then nothing for the glyph, then an address, as unrelated fragments.
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.line, { gap: theme.spacing.md }]}
      testID={testID}>
      <Icon name={icon} size="md" color="textTertiary" />
      <View style={[styles.grow, { gap: theme.spacing.xxs }]}>
        <Text variant="caption" color="textSecondary">
          {label}
        </Text>
        <Text variant="bodyStrong">{value}</Text>
      </View>
    </View>
  );
}

export function RequestSubmittedScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { categoryId, subCategoryId } = route.params;

  const { submitted } = useRequestDraft();
  const service = useRequestServiceContext(categoryId, subCategoryId);
  const vendors = useEligibleVendors(categoryId, subCategoryId);

  /*
    Nothing to confirm means there is nothing to be here for.

    Reachable in exactly one way that matters: the app was reopened while this
    screen was the last thing on screen, and the outcome — which is memory-only
    on purpose — did not survive. Home is the honest destination; a success
    screen for a request nobody can name is worse than no screen at all.
  */
  useEffect(() => {
    if (!submitted) {
      navigation.replace('CustomerTabs', { screen: 'Home' });
    }
  }, [submitted, navigation]);

  /*
    Named from the list the customer chose from.

    A name is display data, so it is resolved rather than carried: the outcome
    holds an identifier, and this asks the catalogue what it is called. If the
    lookup has not finished or the professional has since gone, the line still
    says which dispatch applies — which is the part that must never be ambiguous.
  */
  const dispatchLine = useMemo(() => {
    if (submitted?.vendor.kind !== 'vendor') {
      return COPY.dispatchOpen;
    }

    const { vendorId } = submitted.vendor;
    const name = vendors.data?.find(vendor => vendor.id === vendorId)?.name;

    return name ? `${COPY.dispatchDirected} ${name}` : COPY.dispatchDirectedUnknown;
  }, [submitted?.vendor, vendors.data]);

  /*
    The request itself, in place of this screen.

    `replace` rather than a push: this screen is a moment, and Back from the
    request should reach Home rather than return to "Request sent" a second
    time. Only the reference travels — request details reads everything else
    from the service, so it shows the request the backend has rather than the
    one this screen remembers.
  */
  const viewRequest = useCallback(() => {
    if (!submitted?.reference) {
      return;
    }

    navigation.replace('RequestDetails', { requestId: submitted.reference });
  }, [submitted, navigation]);

  /*
    Home, and the stack ends here.

    `popToTop` rather than a push: the tabs are the only thing underneath by the
    time this renders, so this returns to them instead of adding a fifth screen
    nobody can leave.
  */
  const goHome = useCallback(() => {
    navigation.popToTop();
  }, [navigation]);

  if (!submitted) {
    // The effect above is already on its way out. Drawing a confirmation of
    // nothing for one frame would be a flash of a screen that means nothing.
    return null;
  }

  return (
    <Screen
      scrollable
      contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl }}
      testID="customer-request-submitted">
      {/*
        No back control in the header, and none needed: there is nothing behind
        this screen. Drawing one would be a control that goes home pretending to
        be a control that goes back.
      */}
      <View style={[styles.hero, { gap: theme.spacing.md, paddingTop: theme.spacing.xxl }]}>
        <View
          style={[
            styles.mark,
            {
              // Tinted rather than filled. A solid green disc at this size is a
              // dialog's idea of success; the tint lets the glyph carry it.
              backgroundColor: theme.colors.successSubtle,
              borderRadius: theme.radius.full,
            },
          ]}>
          {/*
            Shape as well as colour, which section 46 requires — a tick reads as
            a tick in greyscale, and a green circle does not.
          */}
          <Icon name="success" size="xxl" color="success" />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text
            variant="hero"
            align="center"
            accessibilityRole="header"
            // Announced when the screen arrives, so somebody not looking at it
            // is told the request went rather than left to guess.
            accessibilityLiveRegion="polite"
            accessibilityLabel={COPY.announcement}
            testID="request-submitted-heading">
            {COPY.title}
          </Text>
          <Text variant="subtitle" color="textSecondary" align="center">
            {COPY.subtitle}
          </Text>
        </View>
      </View>

      {/*
        Only when the backend gave one.

        ⚠️ Never generated here. If `createRequest` returns no reference, this
        block is simply absent — a number invented by the app is a number a
        customer might quote to somebody who has never heard of it.
      */}
      {submitted.reference ? (
        <Card bordered shadow="sm" style={{ padding: theme.spacing.lg }}>
          <RequestReference
            reference={submitted.reference}
            testID="request-submitted-reference"
          />
        </Card>
      ) : null}

      <Card bordered shadow="sm" style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <SummaryLine
          icon="requests"
          label={COPY.serviceLabel}
          // Falls back to the category, then to nothing at all rather than to
          // the word "undefined": a name that did not load is a caption, and a
          // request for a service whose name is missing is still that request.
          value={service.subCategoryName ?? service.categoryName ?? CUSTOMER_COPY.confirmation.serviceFallback}
          testID="request-submitted-service"
        />

        <SummaryLine
          icon="location"
          label={COPY.addressLabel}
          value={submitted.address.formattedAddress}
          testID="request-submitted-address"
        />

        {/*
          The dispatch outcome, stated whichever way it went — the one line a
          customer must never be unsure about. It carries no label, because
          "Sent to Sharma Electricals" and "Open to available professionals" are
          both already sentences.
        */}
        <View
          accessible
          accessibilityRole="text"
          /*
            Said explicitly, not composed from the children.

            Left to compose its own name, this node picked up the icon font's
            private-use character and announced it before the words — seen on
            device as a content description beginning with an unspeakable glyph.
            The sentence is already complete on its own.
          */
          accessibilityLabel={dispatchLine}
          style={[styles.line, { gap: theme.spacing.md }]}
          testID="request-submitted-dispatch">
          <Icon
            name={submitted.vendor.kind === 'vendor' ? 'business' : 'team'}
            size="md"
            color="textTertiary"
          />
          <Text variant="bodyStrong" style={styles.grow}>
            {dispatchLine}
          </Text>
        </View>
      </Card>

      <View style={[styles.next, { gap: theme.spacing.sm }]}>
        <Icon name="info" size="sm" color="textTertiary" />
        <View style={[styles.grow, { gap: theme.spacing.xxs }]}>
          <Text variant="label" color="textSecondary">
            {COPY.nextTitle}
          </Text>
          <Text variant="caption" color="textSecondary">
            {COPY.nextMessage}
          </Text>
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {/*
          Leads when there is a request to open, because looking at what was
          just sent is the natural next thing; without a reference there is
          nothing to look up, so Home is the only action and takes the lead.
        */}
        {submitted.reference ? (
          <PrimaryButton
            label={COPY.viewRequest}
            onPress={viewRequest}
            fullWidth
            accessibilityHint={COPY.viewRequestHint}
          />
        ) : null}

        <Button
          label={COPY.home}
          variant={submitted.reference ? 'secondary' : 'primary'}
          onPress={goHome}
          fullWidth
          accessibilityHint={COPY.homeHint}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    flexDirection: 'row',
    // Top rather than centre: a wrapped address beside a single glyph reads as
    // lopsided when the glyph floats to the middle of the block.
    alignItems: 'flex-start',
  },
  next: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  grow: {
    // Takes the slack, so a long address wraps inside the card instead of
    // pushing the row wider than it.
    flex: 1,
  },
});
