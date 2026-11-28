/**
 * NotificationsScreen
 *
 * The signed-in account's notifications (PROJECT_BIBLE.md section 57, the
 * launch checklist's shared "Notifications"; section 80, "Notifications:
 * Basic"), opened from the bell on Customer Home or the Vendor Dashboard.
 *
 * ⚠️ One screen, two registrations. It is registered in the customer's stack
 * and, separately, in the vendor's, as `Notifications` in each, so neither
 * role's navigation holds anything of the other's (section 3). Whose
 * notifications they are is the session's; the route carries nothing.
 *
 * ⚠️ The inbox only. Push (phase5-contract.md section 6, owner-approved
 * 28/11/2026) is handled outside every screen, by `usePushNotifications` in
 * AppRoot: nothing here registers a device or asks for a permission. A push
 * that arrives while this is open reads the loaded pages again quietly
 * (`notificationSync`'s arrival signal). Email, SMS and WhatsApp stay Phase 2.
 *
 * ⚠️ A link opens a request in this role's own application, or nothing. Pressing
 * a notification marks it read and, when its link is one the app understands
 * (`parseNotificationLink`: `fixora://requests/<reference>`), opens that request
 * — the customer's `RequestDetails` or the vendor's `VendorRequestDetails`, by
 * reference only. Any other link, or none, marks it read and opens nothing,
 * silently. Which role is signed in decides the route, exactly as it decides
 * which application RootNavigator mounted; the notification's `type` decides
 * nothing.
 *
 * One list, and it owns the scrolling: the heading is its header. Newest
 * first, in the service's order; the next page loads as the end of the list
 * comes into reach. States, each in the list rather than instead of it (see
 * the lessons in docs/WORKING_NOTES.md): placeholders while the first page
 * loads; a failure with Try again when nothing could be shown (no pull over
 * it); section 48's calm empty state; a failed pull says so above the
 * notifications, which stay; a failed next page says so below them, with its
 * own Try again.
 *
 * ⚠️ What acts on the whole inbox is in the bar's menu (T133,
 * phase5-contract.md section 3, 28/11/2026): the three dots across from Back
 * open an `OptionsSheet` with "Mark all as read" and "Clear all". The menu is
 * there only over notifications — with none, or none that could be read, there
 * is nothing to act on — and in the bar, so it never moves the list. An option
 * that cannot apply is disabled rather than missing (nothing unread; either
 * change already in the air). "Clear all" removes every page, loaded or not,
 * so it asks first; the question is answered before anything is sent.
 *
 * ⚠️ One notification goes by swiping it left, or by its row's "Delete"
 * accessibility action (`NotificationCard`). Every change here is drawn at
 * once and put back if the service refuses it (`useNotifications`).
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuthSession } from '@/features/auth/hooks/useAuth';
import { NotificationCard } from '@/features/notifications/components/NotificationCard';
import { NotificationsMenuButton } from '@/features/notifications/components/NotificationsMenuButton';
import { parseNotificationLink } from '@/features/notifications/constants/notificationLinks';
import { NOTIFICATIONS_COPY } from '@/features/notifications/constants/notificationsCopy';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import type { CustomerStackParamList, VendorStackParamList } from '@/navigation/types';
import {
  BackButton,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Loader,
  OptionsSheet,
  Screen,
  Skeleton,
  Text,
  type OptionsSheetOption,
} from '@/shared/components';
import type { AppNotification } from '@/shared/services/types/NotificationService';
import { useTheme } from '@/shared/theme';

const COPY = NOTIFICATIONS_COPY.inbox;

/** Roughly a notification, so nothing jumps as the real ones arrive. */
const CARD_HEIGHT = 96;
/** Enough to fill a phone without pretending to know how many will come back. */
const PLACEHOLDER_COUNT = 5;

type CustomerProps = NativeStackScreenProps<CustomerStackParamList, 'Notifications'>;
type VendorProps = NativeStackScreenProps<VendorStackParamList, 'Notifications'>;

/** Registered in both stacks; which one it is in is the session's role. */
type Props = CustomerProps | VendorProps;

/** One identity for "nothing to list", so the list is not handed a new array every render. */
const NO_NOTIFICATIONS: readonly AppNotification[] = Object.freeze([]);

export function NotificationsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { role } = useAuthSession();
  const {
    notifications,
    error,
    failedDuring,
    isLoading,
    isRefreshing,
    isLoadingMore,
    loadMore,
    refresh,
    retry,
    markAsRead,
    canMarkAll,
    markAllAsRead,
    remove,
    canClearAll,
    clearAll,
    isBusy,
  } = useNotifications();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  /*
    A request, by reference, in this role's own application — the same choice
    RootNavigator makes between the two. The casts are the price of one screen
    in two stacks: each branch names only a route its own stack has.
  */
  const openRequest = useCallback(
    (requestId: string) => {
      if (role === 'vendor') {
        (navigation as VendorProps['navigation']).navigate('VendorRequestDetails', { requestId });
      } else if (role === 'customer') {
        (navigation as CustomerProps['navigation']).navigate('RequestDetails', { requestId });
      }
    },
    [navigation, role],
  );

  // The list as last drawn, so `open` stays one function however often it changes.
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;

  /*
    Read first, then open: the row is marked at once and the call goes out
    while the request opens, so nothing waits on it. A notification already
    read is not marked again.
  */
  const open = useCallback(
    (notificationId: string) => {
      const notification = notificationsRef.current.find(item => item.id === notificationId);
      if (!notification) {
        return;
      }

      if (!notification.read) {
        // Not awaited, and never rejects: a failure is the hook's own toast and the row unread again.
        markAsRead(notification.id);
      }

      const target = parseNotificationLink(notification.deepLink);
      if (target) {
        openRequest(target.requestId);
      }
    },
    [markAsRead, openRequest],
  );

  const removeOne = useCallback(
    (notificationId: string) => {
      // Not awaited, and never rejects: a failure is the hook's own toast and the row back.
      remove(notificationId);
    },
    [remove],
  );

  const openMenu = useCallback(() => setIsMenuOpen(true), []);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  const keepAll = useCallback(() => setIsConfirmingClear(false), []);
  const confirmClear = useCallback(() => {
    // Closed at once: the list empties as it is answered, and comes back if it fails.
    setIsConfirmingClear(false);
    clearAll();
  }, [clearAll]);

  const menuOptions = useMemo<OptionsSheetOption[]>(
    () => [
      {
        key: 'mark-all',
        label: COPY.markAll,
        hint: COPY.markAllHint,
        icon: 'markAllRead',
        disabled: !canMarkAll || isBusy,
        // Not awaited, and never rejects: either outcome is the hook's own toast.
        onSelect: () => {
          markAllAsRead();
        },
      },
      {
        key: 'clear-all',
        label: COPY.clearAll,
        hint: COPY.clearAllHint,
        icon: 'remove',
        tone: 'danger',
        disabled: !canClearAll || isBusy,
        onSelect: () => setIsConfirmingClear(true),
      },
    ],
    [canMarkAll, canClearAll, isBusy, markAllAsRead],
  );

  // Nothing listed while the first page loads: the placeholders are the loading
  // region's, in the empty slot below, not lines of the list.
  const listed = isLoading ? NO_NOTIFICATIONS : notifications;

  const renderNotification = useCallback(
    ({ item }: ListRenderItemInfo<AppNotification>) => (
      <NotificationCard
        notification={item}
        onPress={open}
        onDelete={removeOne}
        testID={`notification-${item.id}`}
      />
    ),
    [open, removeOne],
  );

  const hasNotifications = notifications.length > 0;

  const bar = (
    <View
      style={[styles.bar, { paddingHorizontal: theme.spacing.sm, height: theme.hitSlop.minTarget }]}>
      <BackButton
        onPress={navigation.goBack}
        accessibilityLabel={COPY.back}
        testID="notifications-back"
      />
      {/* Only over notifications: with none there is nothing for it to act on. */}
      {hasNotifications && !isLoading ? (
        <NotificationsMenuButton onPress={openMenu} testID="notifications-menu" />
      ) : null}
    </View>
  );

  const heading = (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="hero" accessibilityRole="header" testID="notifications-heading">
          {COPY.title}
        </Text>
        <Text variant="subtitle" color="textSecondary">
          {COPY.subtitle}
        </Text>
      </View>

      {/* Where the pull was: a refresh that failed, over notifications that are still here. */}
      {error && failedDuring === 'refresh' && hasNotifications ? (
        <ErrorState
          error={error}
          title={COPY.refreshFailedTitle}
          onRetry={retry}
          fullScreen={false}
          testID="notifications-refresh-error"
        />
      ) : null}
    </View>
  );

  /*
    Nothing to list: the wait while the first page is read, a failure when
    nothing could be, otherwise section 48's empty state — so "no
    notifications" is never drawn over a read that may find some.

    ⚠️ The wait is a region of its own: named for it and busy, with a `key`, so
    it is replaced — never updated into what follows. The list used to carry
    the label and the busy state itself, stated on every render because a prop
    that becomes undefined is not unset on a view updated in place (Sub
    Categories, found on device) — and loaded, the labelled list was a TalkBack
    stop of its own ("Your notifications") under a heading that had just said
    as much. Now the list carries neither, ever. Not fixed by giving the list a
    key per state: that would remount the heading inside it and drop TalkBack's
    focus from it when the page lands.
  */
  const nothing = isLoading ? (
    <View
      key="loading"
      style={{ gap: theme.spacing.md }}
      accessibilityLabel={COPY.loading}
      accessibilityState={{ busy: true }}
      testID="notifications-loading">
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
      testID="notifications-error"
    />
  ) : (
    <EmptyState
      title={COPY.emptyTitle}
      message={COPY.emptyMessage}
      icon="notifications"
      fullScreen={false}
      testID="notifications-empty"
    />
  );

  /* Where the scroll was: the next page arriving, or the next page that did not. */
  let footer: React.ReactElement | null = null;
  if (hasNotifications && !isLoading) {
    if (isLoadingMore) {
      footer = <Loader label={COPY.loadingMore} />;
    } else if (error && failedDuring === 'more') {
      footer = (
        <ErrorState
          error={error}
          title={COPY.moreFailedTitle}
          onRetry={retry}
          fullScreen={false}
          testID="notifications-more-error"
        />
      );
    }
  }

  // Not offered over a failure with nothing behind it: the retry is right
  // there, and a pull would be a second, hidden one.
  const canRefresh = !(error && !hasNotifications);

  return (
    <Screen padded={false} header={bar} testID="notifications">
      <FlatList
        data={listed}
        keyExtractor={notification => notification.id}
        renderItem={renderNotification}
        ListHeaderComponent={heading}
        ListEmptyComponent={nothing}
        ListFooterComponent={footer}
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.screenPadding,
            gap: theme.spacing.md,
            paddingBottom: theme.spacing.xxxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        // A failure is retried with its own Try again, never by scrolling past it.
        onEndReached={loadMore}
        onRefresh={canRefresh ? refresh : undefined}
        refreshing={canRefresh ? isRefreshing : false}
        testID="notifications-list"
      />

      <OptionsSheet
        visible={isMenuOpen}
        title={COPY.menuTitle}
        options={menuOptions}
        onClose={closeMenu}
        cancelLabel={COPY.menuCancel}
        cancelHint={COPY.menuCancelHint}
        testID="notifications-menu-sheet"
      />

      <ConfirmDialog
        visible={isConfirmingClear}
        title={COPY.clearTitle}
        message={COPY.clearMessage}
        cancelLabel={COPY.clearCancel}
        cancelHint={COPY.clearCancelHint}
        confirmLabel={COPY.clearConfirm}
        confirmHint={COPY.clearConfirmHint}
        onCancel={keepAll}
        onConfirm={confirmClear}
        testID="notifications-clear-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    // Back at the start, the menu at the end, both centred in the bar's height.
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    // So the empty and error states can centre in the space under the heading.
    flexGrow: 1,
  },
});
