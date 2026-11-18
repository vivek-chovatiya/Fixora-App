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
 */

export const NOTIFICATIONS_COPY = Object.freeze({
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

    markAll: 'Mark all as read',
    markAllHint: 'Marks every notification as read',
    /** After the service confirmed it. */
    markedAll: 'All notifications marked as read.',
    /** When only the newest could be marked; the list is read again to show which. */
    markedSome: 'Your newest notifications were marked as read. Some older ones may still be unread.',
    /** Said before the failure's own message; nothing was marked. */
    markAllFailed: 'Your notifications were not marked as read.',
    /** Said before the failure's own message; the notification is unread again. */
    markFailed: 'That notification was not marked as read.',
  }),
});
