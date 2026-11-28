/**
 * Notifications copy — Hindi. Translates `NOTIFICATIONS_COPY_EN` in
 * `notificationsCopy.ts`; a key left out reads in English.
 *
 * Wording: polite "आप", everyday Hindi, and the words the rest of the app
 * already uses — "नोटिफ़िकेशन" (as in the customer copy and the permission
 * screen), "रिक्वेस्ट", "लोड", "रीफ़्रेश नहीं हो सका", "वापस". "नोटिफ़िकेशन" is
 * masculine throughout ("डिलीट हो गया", "मार्क नहीं हुआ").
 *
 * Left in English on purpose: `bell.overflow` ("9+") and `bell.atLeast`
 * ("3+") are drawn on the badge and are not words.
 *
 * ⚠️ Shared by both roles, like the English: nothing here may speak to only a
 * customer or only a vendor.
 *
 * ⚠️ Some values are joined by code, so they are worded for the joined form:
 * - `inbox.unreadSpoken` is said first, before the notification's own title,
 *   and the code puts a full stop after it — so it ends with no "।";
 * - `markAllFailed`, `markFailed`, `clearAllFailed` and `deleteFailed` come
 *   before the failure's own message, so each is a whole sentence of its own;
 * - `inbox.deleteAction` is both the swipe's red panel and TalkBack's action
 *   name, so the two say the same word.
 *
 * The notifications themselves — their titles and messages — are the backend's
 * words, sent in English, and are not here.
 */

import type { LocaleTable } from '@/core/i18n';
import type { NOTIFICATIONS_COPY_EN } from '@/features/notifications/constants/notificationsCopy';

export const NOTIFICATIONS_COPY_HI: LocaleTable<typeof NOTIFICATIONS_COPY_EN> = {
  bell: {
    label: 'नोटिफ़िकेशन',
    unreadSpoken: (count: number) => `नोटिफ़िकेशन, ${count} बिना पढ़े`,
    unreadAtLeastSpoken: (count: number) => `नोटिफ़िकेशन, कम से कम ${count} बिना पढ़े`,
    hint: 'आपके नोटिफ़िकेशन खोलता है',
  },

  inbox: {
    title: 'नोटिफ़िकेशन',
    subtitle: 'आपकी रिक्वेस्ट और आपके अकाउंट से जुड़े अपडेट।',
    back: 'वापस',

    loading: 'आपके नोटिफ़िकेशन लोड हो रहे हैं',
    failedTitle: 'हम आपके नोटिफ़िकेशन लोड नहीं कर सके',
    refreshFailedTitle: 'रीफ़्रेश नहीं हो सका',
    moreFailedTitle: 'हम और नोटिफ़िकेशन लोड नहीं कर सके',
    loadingMore: 'और नोटिफ़िकेशन लोड हो रहे हैं',

    emptyTitle: 'अभी कोई नोटिफ़िकेशन नहीं है',
    emptyMessage: 'आपकी रिक्वेस्ट के अपडेट यहाँ दिखेंगे।',

    unreadSpoken: 'बिना पढ़ा',
    openRequestHint: 'इस नोटिफ़िकेशन को पढ़ा हुआ मार्क करता है और रिक्वेस्ट खोलता है',
    openReadRequestHint: 'रिक्वेस्ट खोलता है',
    markReadHint: 'इस नोटिफ़िकेशन को पढ़ा हुआ मार्क करता है',

    menu: 'नोटिफ़िकेशन के विकल्प',
    menuHint: 'आपके सभी नोटिफ़िकेशन के विकल्प खोलता है',
    menuTitle: 'नोटिफ़िकेशन के विकल्प',
    menuCancel: 'रद्द करें',
    menuCancelHint: 'विकल्प बंद करता है',

    markAll: 'सभी को पढ़ा हुआ मार्क करें',
    markAllHint: 'हर नोटिफ़िकेशन को पढ़ा हुआ मार्क करता है',
    markedAll: 'सभी नोटिफ़िकेशन पढ़े हुए मार्क हो गए।',
    markAllFailed: 'आपके नोटिफ़िकेशन पढ़े हुए मार्क नहीं हुए।',
    markFailed: 'वह नोटिफ़िकेशन पढ़ा हुआ मार्क नहीं हुआ।',

    clearAll: 'सब हटाएँ',
    clearAllHint: 'हर नोटिफ़िकेशन हटाने से पहले पूछता है',
    clearTitle: 'सभी नोटिफ़िकेशन हटाएँ?',
    clearMessage: 'आपके इनबॉक्स से हर नोटिफ़िकेशन हट जाएगा। इसे वापस नहीं लाया जा सकता।',
    clearCancel: 'इन्हें रखें',
    clearCancelHint: 'आपके नोटिफ़िकेशन रखता है',
    clearConfirm: 'सब हटाएँ',
    clearConfirmHint: 'हर नोटिफ़िकेशन हटाता है',
    clearedAll: 'सभी नोटिफ़िकेशन हटा दिए गए।',
    clearAllFailed: 'आपके नोटिफ़िकेशन हटाए नहीं गए।',

    deleteAction: 'डिलीट करें',
    deleted: 'नोटिफ़िकेशन डिलीट हो गया।',
    deleteFailed: 'वह नोटिफ़िकेशन डिलीट नहीं हुआ।',
  },

  push: {
    fallback: 'आपके लिए एक नया नोटिफ़िकेशन है।',
  },
};
