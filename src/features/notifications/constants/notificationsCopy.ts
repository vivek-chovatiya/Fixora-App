/**
 * Notifications copy
 *
 * Every string the notification bell and the inbox show, in one place, for the
 * reasons `CUSTOMER_COPY` gives: copy is revised by people who do not read JSX,
 * and one file is what multi-language translates later.
 *
 * ⚠️ Shared by both roles. The inbox is one screen registered in each role's
 * own stack (PROJECT_BIBLE.md section 3), so nothing here may speak to only a
 * customer or only a vendor — "your requests" is true of both.
 *
 * ⚠️ The notifications themselves are not here. Their titles and bodies are the
 * backend's words, drawn as sent; nothing in this file names a notification
 * type, and nothing here may name a service category (section 11).
 *
 * In English, Hindi and Gujarati since Phase 5 (28/11/2026, phase5-contract.md
 * section 7): `NOTIFICATIONS_COPY_EN` is the source, `notificationsCopy.hi.ts`
 * and `notificationsCopy.gu.ts` translate it, and `NOTIFICATIONS_COPY` answers
 * in the current language, key by key, falling back to English (`core/i18n`).
 *
 * ⚠️ Read it in render. A string taken from `NOTIFICATIONS_COPY` while a module
 * loads keeps the language of that moment; a section (`NOTIFICATIONS_COPY.inbox`)
 * may be held anywhere.
 */

import { localized } from '@/core/i18n';
import { NOTIFICATIONS_COPY_GU } from '@/features/notifications/constants/notificationsCopy.gu';
import { NOTIFICATIONS_COPY_HI } from '@/features/notifications/constants/notificationsCopy.hi';

export const NOTIFICATIONS_COPY_EN = Object.freeze({
  /** The bell at the top of Customer Home and the Vendor Dashboard. */
  bell: Object.freeze({
    /** Spoken when nothing is unread, or the count could not be read. */
    label: 'Notifications',
    /**
     * Spoken with the exact count, whatever the badge shows: "9+" is a drawing
     * limit, not something to read out.
     */
    unreadSpoken: (count: number) => `Notifications, ${count} unread`,
    /** When the inbox was too long to count whole: a floor, never a figure that may be wrong. */
    unreadAtLeastSpoken: (count: number) => `Notifications, at least ${count} unread`,
    hint: 'Opens your notifications',
    /** Drawn instead of a number above nine, so the badge never outgrows the bell. */
    overflow: '9+',
    /** A floor drawn as one: "3+" is at least three. */
    atLeast: (count: number) => `${count}+`,
  }),

  inbox: Object.freeze({
    title: 'Notifications',
    subtitle: 'Updates on your requests and your account.',
    /** The screen is reached from Home or the Dashboard, so "Back" names neither. */
    back: 'Back',

    loading: 'Loading your notifications',
    failedTitle: 'We could not load your notifications',
    /** A pull that failed over notifications that are still on screen. */
    refreshFailedTitle: 'Could not refresh',
    moreFailedTitle: 'We could not load more notifications',
    loadingMore: 'Loading more notifications',

    /** Section 48's calm empty state: nothing is wrong, nothing has happened yet. */
    emptyTitle: 'No notifications yet',
    emptyMessage: 'Updates about your requests will appear here.',

    /** Said first on an unread notification, so its state is heard before its words. */
    unreadSpoken: 'Unread',
    openRequestHint: 'Marks this notification as read and opens the request',
    openReadRequestHint: 'Opens the request',
    markReadHint: 'Marks this notification as read',

    /**
     * The menu in the screen's top corner (T133, 28/11/2026): what can be done
     * to the whole inbox. The button is a glyph, so its spoken name says what
     * it opens.
     */
    menu: 'Notification options',
    menuHint: 'Opens options for all your notifications',
    menuTitle: 'Notification options',
    menuCancel: 'Cancel',
    menuCancelHint: 'Closes the options',

    markAll: 'Mark all as read',
    markAllHint: 'Marks every notification as read',
    /** After the service confirmed it. */
    markedAll: 'All notifications marked as read.',
    /** Said before the failure's own message; every row is as it was again. */
    markAllFailed: 'Your notifications were not marked as read.',
    /** Said before the failure's own message; the notification is unread again. */
    markFailed: 'That notification was not marked as read.',

    /** Clears the whole inbox, every page of it — so it asks first. */
    clearAll: 'Clear all',
    clearAllHint: 'Asks before removing every notification',
    clearTitle: 'Clear all notifications?',
    clearMessage: 'Every notification will be removed from your inbox. This cannot be undone.',
    clearCancel: 'Keep them',
    clearCancelHint: 'Keeps your notifications',
    clearConfirm: 'Clear all',
    clearConfirmHint: 'Removes every notification',
    /** After the service confirmed it. */
    clearedAll: 'All notifications cleared.',
    /** Said before the failure's own message; every notification is back. */
    clearAllFailed: 'Your notifications were not cleared.',

    /**
     * One notification, by swiping it left — or, for a screen reader, the
     * row's "Delete" action, since a swipe is not something TalkBack can do.
     * The word on the swipe's red panel is the same word.
     */
    deleteAction: 'Delete',
    /** After the service confirmed it. */
    deleted: 'Notification deleted.',
    /** Said before the failure's own message; the notification is back in its place. */
    deleteFailed: 'That notification was not deleted.',
  }),

  /**
   * A push notification that arrives while the app is in front
   * (phase5-contract.md section 6.3). The toast shows the notification's own
   * title and message, as sent; this is only for one that came with neither.
   */
  push: Object.freeze({
    fallback: 'You have a new notification.',
  }),
});

export const NOTIFICATIONS_COPY = localized({
  en: NOTIFICATIONS_COPY_EN,
  hi: NOTIFICATIONS_COPY_HI,
  gu: NOTIFICATIONS_COPY_GU,
});
