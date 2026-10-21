/**
 * VendorTeamScreen
 *
 * The vendor's team (PROJECT_BIBLE.md section 39, Phase 3E-7): everybody on it,
 * a way to add somebody, and Edit and Remove on each. It is the Team tab
 * (section 43), replacing that tab's placeholder, and Profile's "Manage team"
 * opens it (owner decision, 2026-10-08) — one list, one place.
 *
 * ⚠️ A list the vendor keeps, nothing more. Nobody on it is assigned work
 * (section 40), signs in (section 7A.3) or is scheduled, paid or tracked. A
 * disabled member (section 39) shows a badge on their card and keeps their
 * place in the list; disabling and enabling are done on the edit form, and
 * this list shows the change when it reads again on the way back.
 *
 * ⚠️ Removing asks first, and changes nothing until the service says so. The
 * dialog stays open and busy while the removal is sent (it cannot be dismissed
 * mid-way, so nobody wonders whether it happened), closes when the service
 * answers, and the hook says the outcome. The list then shows the team the
 * service answered with — the service's refresh, not a guess. A failure leaves
 * the member where they were; their Remove is the retry.
 *
 * ⚠️ Read again on the way back in, not on the way in. Adding and editing are
 * their own screen and this tab stays mounted underneath, so without it a new
 * member would not appear until the app was reopened; the first focus is
 * skipped because the query has just read on mount (`ManageAddressesScreen`'s
 * rule, 3D-9). It is a refresh — the team stays on screen — and only once there
 * is a team: over a failure, the failure's own Try again is the way.
 *
 * One list, and it owns the scrolling: the heading, Add and any notice are its
 * header. Placeholders fill it while the first read runs; a failed first read
 * puts the failure and its retry where the team would be; nobody yet is
 * section 48's sentence with its action, "Add team member" — which is then the
 * only Add on screen, so there are never two buttons doing one thing.
 */

import React, { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { TeamMemberCard } from '@/features/vendor/components/TeamMemberCard';
import { VENDOR_COPY } from '@/features/vendor/constants/vendorCopy';
import { useVendorTeam } from '@/features/vendor/hooks/useVendorTeam';
import type { VendorStackParamList, VendorTabParamList } from '@/navigation/types';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PrimaryButton,
  Screen,
  Skeleton,
  StaleNotice,
  Text,
} from '@/shared/components';
import type { TeamMember } from '@/shared/services/types/VendorTeamService';
import { useTheme } from '@/shared/theme';

const COPY = VENDOR_COPY.team;

/** Roughly a card, so nothing jumps as the real ones arrive. */
const CARD_HEIGHT = 152;
/** Enough to fill a phone without pretending to know how many will come back. */
const PLACEHOLDER_COUNT = 3;

/** The tab bar clears the home indicator itself. */
const TOP_EDGE_ONLY = ['top'] as const;

type Props = CompositeScreenProps<
  BottomTabScreenProps<VendorTabParamList, 'Team'>,
  NativeStackScreenProps<VendorStackParamList>
>;

/** One identity for "nothing to list", so the list is not handed a new array every render. */
const NO_MEMBERS: readonly TeamMember[] = Object.freeze([]);

export function VendorTeamScreen({ navigation }: Props) {
  const theme = useTheme();
  const {
    members,
    isLoading,
    error,
    retry,
    refresh,
    isRefreshing,
    isStale,
    staleError,
    remove,
    removingId,
  } = useVendorTeam();

  /**
   * The member whose removal is being confirmed, as they were when asked about —
   * so the dialog still names them in the moment after they have gone.
   */
  const [confirming, setConfirming] = useState<TeamMember | null>(null);
  const membersRef = useRef(members);
  membersRef.current = members;

  // Read again on the way back in — but not on the way in, and not over a failure.
  const hasTeam = useRef(false);
  hasTeam.current = members !== undefined;
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedBefore.current) {
        focusedBefore.current = true;
        return;
      }
      if (hasTeam.current) {
        refresh();
      }
    }, [refresh]),
  );

  // Ids only: the form reads the member itself.
  const add = useCallback(() => navigation.navigate('EditTeamMember', {}), [navigation]);
  const edit = useCallback(
    (memberId: string) => navigation.navigate('EditTeamMember', { memberId }),
    [navigation],
  );

  const askRemove = useCallback(
    (memberId: string) =>
      setConfirming(membersRef.current?.find(member => member.id === memberId) ?? null),
    [],
  );
  const cancelRemove = useCallback(() => setConfirming(null), []);
  const confirmRemove = useCallback(() => {
    if (confirming === null) {
      return;
    }
    remove(confirming.id).then(outcome => {
      // A second press while the first is in the air is not an answer; the first one closes it.
      if (outcome !== 'ignored') {
        setConfirming(null);
      }
    });
  }, [confirming, remove]);

  // Nothing listed while the first read runs: the placeholders are the loading
  // region's, in the empty slot below, not lines of the list.
  const listed = isLoading ? NO_MEMBERS : (members ?? NO_MEMBERS);

  const isRemoving = removingId !== null;

  const renderMember = useCallback(
    ({ item }: ListRenderItemInfo<TeamMember>) => (
      <TeamMemberCard
        member={item}
        onEdit={edit}
        onRemove={askRemove}
        isRemoving={removingId === item.id}
        disabled={isRemoving}
        testID={`team-member-${item.id}`}
      />
    ),
    [askRemove, edit, isRemoving, removingId],
  );

  const hasMembers = members !== undefined && members.length > 0;

  const heading = (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header" testID="vendor-team-heading">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      {/* Over a team; an empty team carries its own Add, and a failure has nothing to add to. */}
      {!isLoading && hasMembers ? (
        <PrimaryButton
          label={COPY.add}
          icon="add"
          onPress={add}
          disabled={isRemoving}
          fullWidth
          accessibilityHint={COPY.addHint}
        />
      ) : null}

      {isStale ? (
        <StaleNotice
          title={COPY.staleTitle}
          message={COPY.staleMessage}
          error={staleError}
          retryLabel={COPY.staleRetry}
          retryHint={COPY.staleRetryHint}
          // A refresh, not a retry: the team stays where it is while it reloads.
          onRetry={refresh}
          isRetrying={isRefreshing}
          testID="vendor-team-stale"
        />
      ) : null}
    </View>
  );

  /*
    Nothing to list: the wait while the first read runs, a failure when it could
    not be made, section 48's empty team once a read has said so — and nothing
    at all in the moment between, so "nobody yet" is never shown for a team that
    has not been read.

    ⚠️ The wait is a region of its own: named for it and busy, with a `key`, so
    it is replaced — never updated into what follows. The list used to carry
    the label and the busy state itself, stated on every render because a prop
    that becomes undefined is not unset on a view updated in place (Sub
    Categories, found on device) — and loaded, the labelled list was a TalkBack
    stop of its own ("Your team") under a heading that had just said as much.
    Now the list carries neither, ever. Not fixed by giving the list a key per
    state: that would remount the heading inside it and drop TalkBack's focus
    from it when the team lands.
  */
  const nothing = isLoading ? (
    <View
      key="loading"
      style={{ gap: theme.spacing.md }}
      accessibilityLabel={COPY.loading}
      accessibilityState={{ busy: true }}
      testID="vendor-team-loading">
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
      testID="vendor-team-error"
    />
  ) : members !== undefined ? (
    <EmptyState
      title={COPY.emptyTitle}
      message={COPY.emptyMessage}
      icon="team"
      actionLabel={COPY.add}
      onAction={add}
      fullScreen={false}
      testID="vendor-team-empty"
    />
  ) : null;

  // Not offered over a failure with nothing behind it: the retry is right there.
  const canRefresh = !error;

  return (
    <Screen padded={false} edges={TOP_EDGE_ONLY} testID="vendor-team">
      <FlatList
        data={listed}
        keyExtractor={member => member.id}
        renderItem={renderMember}
        ListHeaderComponent={heading}
        ListEmptyComponent={nothing}
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.screenPadding,
            gap: theme.spacing.md,
            paddingBottom: theme.spacing.xxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onRefresh={canRefresh ? refresh : undefined}
        refreshing={canRefresh ? isRefreshing : false}
        // Draws again when a removal starts or ends, so every card's buttons follow it.
        extraData={removingId}
        testID="vendor-team-list"
      />

      <ConfirmDialog
        visible={confirming !== null}
        title={COPY.removeTitle}
        message={confirming ? COPY.removeMessage(confirming.name) : undefined}
        cancelLabel={COPY.removeCancel}
        cancelHint={COPY.removeCancelHint}
        confirmLabel={COPY.removeConfirm}
        confirmHint={COPY.removeConfirmHint}
        onCancel={cancelRemove}
        onConfirm={confirmRemove}
        isConfirming={confirming !== null && removingId === confirming.id}
        testID="vendor-team-remove-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    // So the empty and error states can centre in the space under the heading.
    flexGrow: 1,
  },
});
