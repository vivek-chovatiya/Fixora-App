/**
 * Notifications copy — Gujarati. Translates `NOTIFICATIONS_COPY_EN` in
 * `notificationsCopy.ts` (phase5-contract.md section 7); a key left out reads in
 * English. A native speaker should review this table before release.
 *
 * Shared by both roles, as the English is: nothing here speaks to only a
 * customer or only a vendor. "નોટિફિકેશન" is the loanword the customer copy
 * already uses, neuter ("તમારાં નોટિફિકેશન", "કાઢી નાખ્યું"); "read" is
 * "વાંચેલું". The notifications themselves are the backend's words and stay as
 * sent — they are not in this file.
 *
 * Deliberately absent, so they read as the English: `bell.overflow` ("9+") and
 * `bell.atLeast` ("3+"), which hold no words.
 *
 * ⚠️ Every key must mirror `NOTIFICATIONS_COPY_EN`: the same nesting, and each
 * function with the English arguments (`tsc` and
 * `__tests__/i18n/translationKeys.test.ts` refuse anything else). The word on
 * the swipe's red panel and the screen reader's row action are one key,
 * `inbox.deleteAction`, so they cannot drift apart.
 */

import type { LocaleTable } from '@/core/i18n';
import type { NOTIFICATIONS_COPY_EN } from '@/features/notifications/constants/notificationsCopy';

const TITLE = 'નોટિફિકેશન';
const OPTIONS = 'નોટિફિકેશનના વિકલ્પો';
const CLEAR_ALL = 'બધાં સાફ કરો';

export const NOTIFICATIONS_COPY_GU: LocaleTable<typeof NOTIFICATIONS_COPY_EN> = {
  bell: {
    label: TITLE,
    unreadSpoken: (count: number) => `નોટિફિકેશન, ${count} વાંચ્યા વગરનાં`,
    unreadAtLeastSpoken: (count: number) => `નોટિફિકેશન, ઓછામાં ઓછાં ${count} વાંચ્યા વગરનાં`,
    hint: 'તમારાં નોટિફિકેશન ખોલે છે',
  },

  inbox: {
    title: TITLE,
    subtitle: 'તમારી રિક્વેસ્ટ અને તમારા એકાઉન્ટ વિશેની અપડેટ્સ.',
    back: 'પાછા',

    loading: 'તમારાં નોટિફિકેશન લોડ થઈ રહ્યાં છે',
    failedTitle: 'અમે તમારાં નોટિફિકેશન લોડ કરી શક્યા નહીં',
    refreshFailedTitle: 'રિફ્રેશ થઈ શક્યું નહીં',
    moreFailedTitle: 'અમે વધુ નોટિફિકેશન લોડ કરી શક્યા નહીં',
    loadingMore: 'વધુ નોટિફિકેશન લોડ થઈ રહ્યાં છે',

    emptyTitle: 'હજી કોઈ નોટિફિકેશન નથી',
    emptyMessage: 'તમારી રિક્વેસ્ટ વિશેની અપડેટ્સ અહીં દેખાશે.',

    unreadSpoken: 'વાંચ્યું નથી',
    openRequestHint: 'આ નોટિફિકેશનને વાંચેલું માર્ક કરે છે અને રિક્વેસ્ટ ખોલે છે',
    openReadRequestHint: 'રિક્વેસ્ટ ખોલે છે',
    markReadHint: 'આ નોટિફિકેશનને વાંચેલું માર્ક કરે છે',

    menu: OPTIONS,
    menuHint: 'તમારાં બધાં નોટિફિકેશન માટેના વિકલ્પો ખોલે છે',
    menuTitle: OPTIONS,
    menuCancel: 'રદ કરો',
    menuCancelHint: 'વિકલ્પો બંધ કરે છે',

    markAll: 'બધાં વાંચેલાં માર્ક કરો',
    markAllHint: 'દરેક નોટિફિકેશનને વાંચેલું માર્ક કરે છે',
    markedAll: 'બધાં નોટિફિકેશન વાંચેલાં માર્ક થઈ ગયાં.',
    markAllFailed: 'તમારાં નોટિફિકેશન વાંચેલાં માર્ક થયાં નથી.',
    markFailed: 'તે નોટિફિકેશન વાંચેલું માર્ક થયું નથી.',

    clearAll: CLEAR_ALL,
    clearAllHint: 'દરેક નોટિફિકેશન કાઢતાં પહેલાં પૂછે છે',
    clearTitle: 'બધાં નોટિફિકેશન સાફ કરવાં છે?',
    clearMessage:
      'તમારા ઇનબૉક્સમાંથી દરેક નોટિફિકેશન કાઢી નાખવામાં આવશે. આ પાછું ફેરવી શકાશે નહીં.',
    clearCancel: 'નોટિફિકેશન રાખો',
    clearCancelHint: 'તમારાં નોટિફિકેશન રાખે છે',
    clearConfirm: CLEAR_ALL,
    clearConfirmHint: 'દરેક નોટિફિકેશન કાઢી નાખે છે',
    clearedAll: 'બધાં નોટિફિકેશન સાફ થઈ ગયાં.',
    clearAllFailed: 'તમારાં નોટિફિકેશન સાફ થયાં નથી.',

    deleteAction: 'કાઢી નાખો',
    deleted: 'નોટિફિકેશન કાઢી નાખ્યું.',
    deleteFailed: 'તે નોટિફિકેશન કાઢી શકાયું નથી.',
  },

  push: {
    fallback: 'તમારા માટે એક નવું નોટિફિકેશન છે.',
  },
};
