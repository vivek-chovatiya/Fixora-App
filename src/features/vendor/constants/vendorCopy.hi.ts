/**
 * Vendor copy — Hindi. Translates `VENDOR_COPY_EN` in `vendorCopy.ts`; a key
 * left out reads in English. "Fixora", references, digits and symbols stay as
 * they are.
 *
 * Wording: polite "आप", everyday Hindi a small business owner speaks, and the
 * same loanwords as the customer's Hindi (`customerCopy.hi.ts`) — रिक्वेस्ट,
 * प्रोफ़ेशनल, कैटेगरी, फ़ोटो, सेव, रिव्यू, रिपोर्ट, टीम, बिज़नेस — so both sides of
 * the app call a thing by one name. "Customer" is ग्राहक (as on the auth
 * screens). Accept / Reject are "स्वीकार करें" / "मना करें", and a declined
 * request is "मना की गई" everywhere: chip, badge, card, report. Pending is
 * "पेंडिंग", the word a shop owner already uses. A team member is "ऐक्टिव" or
 * "डिसेबल" — not "चालू", which said of a person means something else.
 * Sentences that repeat an app error (`answer.taken`, `answer.notPending`,
 * `work.changed`) match `shared/types/error.hi.ts` word for word; "Paid" /
 * "Not paid yet" are `payment.hi.ts`'s "भुगतान हो गया" / "अभी भुगतान नहीं हुआ".
 *
 * Left out on purpose, so they stay as English draws them: symbols and joins
 * with no words in them — `dashboard.countAtLeast`, `reviews.breakdownPercent`,
 * `breakdownPercentWidest`, `contextSeparator`, `reviewerInitialMark`,
 * `reports.unavailable` ("—"), `reports.figureSpoken`, `workingHours.hours`,
 * `dayRange` and `summarySpoken`.
 *
 * ⚠️ Several values are fragments that code joins in a fixed English order, so
 * they are worded for the joined line, not on their own:
 * - `job.raisedLabel` / `completedLabel` / `rejectedLabel` come before a time
 *   ("भेजी गई: 2 घंटे पहले", "मना की गई: अभी-अभी"), so each ends with a colon;
 *   `requestDetails`'s keys of the same names are field labels and do not;
 * - `job.referencePrefix` comes before the reference ("रेफ़. REQ-1042");
 * - `requestDetails.photoCountMany` / `photoUnavailable` follow a number
 *   ("3 फ़ोटो जुड़ी हैं, 1 को दिखाया नहीं जा सका") — the customer's words;
 * - `dashboard.atLeastSpoken` wraps a whole spoken count ("कम से कम 400 रिक्वेस्ट
 *   आपके जवाब का इंतज़ार कर रही हैं") and also a bare figure (Today's requests);
 * - the shop photo states (`shopImages.uploading` … `notSaved`) are quoted
 *   inside `leaveMessage`, so a change to one is a change to both;
 * - the working-hours day names go into "{day} को …" sentences, so `long` is
 *   the plain name ("सोमवार").
 *
 * ⚠️ A spoken label that English starts with the button's words ("Accept …",
 * "Edit …", "Try again …") starts with the Hindi button's words too, followed
 * by a colon or comma, so voice control still finds the button by what it shows.
 *
 * ⚠️ Keep the English honesty: Fixora records a payment and never processes
 * one, a disabled member stays on the team, and stopping new requests leaves
 * accepted work alone. Nothing here may promise more.
 */

import type { LocaleTable } from '@/core/i18n';
import type { VENDOR_COPY_EN } from '@/features/vendor/constants/vendorCopy';

export const VENDOR_COPY_HI: LocaleTable<typeof VENDOR_COPY_EN> = {
  gate: {
    loading: 'आपकी बिज़नेस प्रोफ़ाइल लोड हो रही है',
    failedTitle: 'हम आपकी बिज़नेस प्रोफ़ाइल लोड नहीं कर सके',
  },

  profileForm: {
    setupTitle: 'अपना बिज़नेस सेट अप करें',
    setupSubtitle:
      'ग्राहकों को बताएँ कि आप कौन हैं और क्या काम करते हैं। यह सब आप बाद में भी बदल सकते हैं।',
    editTitle: 'बिज़नेस प्रोफ़ाइल बदलें',
    editSubtitle: 'सेव करते ही बदलाव ग्राहकों को दिखने लगते हैं।',
    back: 'प्रोफ़ाइल पर वापस',

    photoSection: 'बिज़नेस की फ़ोटो',
    photoSupport: 'वैकल्पिक। आपकी दुकान का सामने का हिस्सा, आपकी गाड़ी या आपका लोगो।',
    photoCamera: 'फ़ोटो लें',
    photoGallery: 'फ़ोटो चुनें',
    photoAddCameraSpoken: 'कैमरे से प्रोफ़ाइल फ़ोटो जोड़ें',
    photoAddGallerySpoken: 'अपनी फ़ोटो में से प्रोफ़ाइल फ़ोटो जोड़ें',
    photoReplaceCameraSpoken: 'कैमरे से प्रोफ़ाइल फ़ोटो बदलें',
    photoReplaceGallerySpoken: 'अपनी फ़ोटो में से प्रोफ़ाइल फ़ोटो बदलें',
    photoRemove: 'फ़ोटो हटाएँ',
    photoRemoveSpoken: 'प्रोफ़ाइल फ़ोटो हटाएँ',
    photoUploading: 'आपकी फ़ोटो अपलोड हो रही है…',
    photoProgress: (percent: number) => `अपलोड हो रहा है… ${percent}%`,
    photoFailedTitle: 'आपकी फ़ोटो अपलोड नहीं हुई',
    photoRetry: 'फिर से कोशिश करें',
    photoDiscard: 'छोड़ें',
    photoDiscardHint: 'जो फ़ोटो अपलोड नहीं हुई, उसे छोड़ देता है',
    photoSpoken: 'बिज़नेस की फ़ोटो',

    businessSection: 'आपका बिज़नेस',
    businessNameLabel: 'बिज़नेस का नाम',
    businessNamePlaceholder: 'जैसे कुमार इलेक्ट्रिकल्स',
    descriptionLabel: 'विवरण',
    descriptionPlaceholder: 'आप क्या काम करते हैं, कब से कर रहे हैं, आप किस बात के लिए जाने जाते हैं',
    descriptionHelper: 'वैकल्पिक',

    servicesSection: 'आपकी सेवाएँ',
    categoriesLabel: 'सेवा की कैटेगरी',

    areaSection: 'आप कहाँ काम करते हैं',
    areaLabel: 'सेवा का इलाका',
    areaPlaceholder: 'जैसे कोरमंगला, HSR लेआउट और इंदिरानगर',
    areaHelper: 'वैकल्पिक। वे इलाके या शहर, जहाँ आप काम लेते हैं।',

    contactSection: 'संपर्क',
    contactSupport: 'आपके अकाउंट से। ग्राहक इन्हीं पर आपसे संपर्क करते हैं।',
    ownerLabel: 'मालिक',
    phoneLabel: 'फ़ोन',
    emailLabel: 'ईमेल',

    saveSetup: 'सेटअप पूरा करें',
    saveEdit: 'प्रोफ़ाइल सेव करें',
    saving: 'सेव हो रहा है…',
    saveHint: 'आपकी बिज़नेस प्रोफ़ाइल सेव करता है',
    saveFailedTitle: 'आपकी प्रोफ़ाइल सेव नहीं हुई',
    fixErrors: 'हाइलाइट किए गए फ़ील्ड जाँचें।',

    signOut: 'साइन आउट',
    signOutHint: 'सेटअप पूरा किए बिना साइन आउट करता है',

    discardTitle: 'बदलाव छोड़ें?',
    discardMessage: 'बिज़नेस प्रोफ़ाइल में किए गए आपके बदलाव सेव नहीं हुए हैं।',
    discardKeep: 'बदलाव जारी रखें',
    discardKeepHint: 'फ़ॉर्म पर वापस ले जाता है',
    discardConfirm: 'छोड़ें',
    discardConfirmHint: 'सेव किए बिना बाहर निकलता है',
  },

  validation: {
    businessNameRequired: 'अपने बिज़नेस का नाम डालें।',
    businessNameTooLong: (max: number) => `बिज़नेस का नाम ${max} अक्षरों या उससे कम का होना चाहिए।`,
    descriptionTooLong: (max: number) => `विवरण ${max} अक्षरों या उससे कम का होना चाहिए।`,
    areaTooLong: (max: number) => `सेवा का इलाका ${max} अक्षरों या उससे कम का होना चाहिए।`,
    categoriesRequired: 'आप जो सेवाएँ देते हैं, उनमें से कम से कम एक चुनें।',

    memberNameRequired: 'उनका नाम डालें।',
    memberNameTooLong: (max: number) => `नाम ${max} अक्षरों या उससे कम का होना चाहिए।`,
    memberRoleTooLong: (max: number) => `रोल ${max} अक्षरों या उससे कम का होना चाहिए।`,

    amountRequired: 'अंतिम राशि डालें।',
    amountFormat: 'राशि सिर्फ़ अंकों में डालें, जैसे 1250 या 1250.50।',
    amountTooSmall: 'अंतिम राशि 0 से ज़्यादा होनी चाहिए।',
    amountTooLarge: (max: string) => `अंतिम राशि ${max} या उससे कम होनी चाहिए।`,
    paymentStatusRequired: 'चुनें कि ग्राहक ने भुगतान किया है या नहीं।',
    paymentMethodRequired: 'चुनें कि ग्राहक ने कैसे भुगतान किया।',
    completionNotesTooLong: (max: number) => `नोट्स ${max} अक्षरों या उससे कम के होने चाहिए।`,
  },

  dashboard: {
    greetingMorning: 'सुप्रभात',
    greetingAfternoon: 'शुभ दोपहर',
    greetingEvening: 'शुभ संध्या',
    greetingFallbackName: 'स्वागत है',

    businessServicesLabel: 'सेवाएँ',
    businessAreaLabel: 'सेवा का इलाका',
    businessHint: 'आपकी बिज़नेस प्रोफ़ाइल खोलता है',

    overviewTitle: 'एक नज़र में',
    pendingLabel: 'पेंडिंग',
    activeLabel: 'चालू',
    completedLabel: 'पूरी हुई',
    pendingSpoken: (count: number) =>
      count === 1
        ? '1 रिक्वेस्ट आपके जवाब का इंतज़ार कर रही है'
        : `${count} रिक्वेस्ट आपके जवाब का इंतज़ार कर रही हैं`,
    activeSpoken: (count: number) => (count === 1 ? '1 काम चल रहा है' : `${count} काम चल रहे हैं`),
    completedSpoken: (count: number) => (count === 1 ? '1 काम पूरा हुआ' : `${count} काम पूरे हुए`),
    atLeastSpoken: (spoken: string) => `कम से कम ${spoken}`,

    loading: 'आपका डैशबोर्ड लोड हो रहा है',
    failedTitle: 'हम आपका डैशबोर्ड लोड नहीं कर सके',

    pendingTitle: 'नई रिक्वेस्ट',
    pendingEmptyTitle: 'कोई नई रिक्वेस्ट नहीं',
    pendingEmptyMessage: 'नई सेवा रिक्वेस्ट यहाँ दिखेंगी।',

    activeTitle: 'चालू काम',
    activeEmptyTitle: 'कोई चालू काम नहीं',
    activeEmptyMessage: 'आप जो रिक्वेस्ट स्वीकार करेंगे, वे काम चलने तक यहाँ दिखेंगी।',

    completedTitle: 'हाल में पूरे हुए',
    completedEmptyTitle: 'अभी तक कोई काम पूरा नहीं हुआ',
    completedEmptyMessage: 'आप जो काम पूरा करेंगे, वह यहाँ दिखेगा।',

    seeAll: 'सभी देखें',
    seeAllPendingSpoken: 'सभी देखें: नई रिक्वेस्ट',
    seeAllActiveSpoken: 'सभी देखें: चालू काम',
    seeAllCompletedSpoken: 'सभी देखें: पूरे हुए काम',
    seeAllHint: 'आपकी रिक्वेस्ट खोलता है',

    todayLabel: 'आज की रिक्वेस्ट',
    todaySpoken: (value: string) => `आज की रिक्वेस्ट, ${value}`,
    todayLoading: 'आज की रिक्वेस्ट लोड हो रही हैं',
    todayFailedTitle: 'हम आज की रिक्वेस्ट लोड नहीं कर सके',
    todayRetrySpoken: 'फिर से कोशिश करें, आज की रिक्वेस्ट लोड करने के लिए',
    todayRetryHint: 'आज की रिक्वेस्ट फिर से लोड करता है',

    ratingHint: 'आपके रिव्यू खोलता है',
    ratingLoading: 'आपकी रेटिंग लोड हो रही है',
    ratingFailedTitle: 'हम आपकी रेटिंग लोड नहीं कर सके',
    ratingRetrySpoken: 'फिर से कोशिश करें, आपकी रेटिंग लोड करने के लिए',
    ratingRetryHint: 'आपकी रेटिंग फिर से लोड करता है',
    figureRetry: 'फिर से कोशिश करें',

    staleTitle: 'रीफ़्रेश नहीं हो सका',
    staleMessage: 'आपके डैशबोर्ड की जानकारी पुरानी हो सकती है।',
    staleRetry: 'फिर से कोशिश करें',
    staleRetryHint: 'आपका डैशबोर्ड फिर से लोड करता है',
  },

  job: {
    referencePrefix: 'रेफ़.',
    statusLabel: 'स्थिति',
    customerLabel: 'ग्राहक',
    areaLabel: 'इलाका',
    priorityLabel: 'प्राथमिकता',
    raisedLabel: 'भेजी गई:',
    completedLabel: 'पूरी हुई:',
    rejectedLabel: 'मना की गई:',
    justNow: 'अभी-अभी',

    statusDirected: 'सीधी रिक्वेस्ट',
    statusBroadcast: 'खुली रिक्वेस्ट',
    statusNew: 'नई',
    statusAccepted: 'स्वीकार की गई',
    statusInProgress: 'काम जारी',
    statusCompleted: 'पूरी हुई',
    statusRejected: 'मना की गई',
    statusCancelled: 'रद्द',
    statusUnknown: 'स्थिति उपलब्ध नहीं',

    openHint: 'यह रिक्वेस्ट खोलता है',
  },

  requests: {
    title: 'रिक्वेस्ट',
    subtitle: 'आपके जवाब का इंतज़ार करता, चलता हुआ और पूरा हुआ काम।',

    filtersLabel: 'रिक्वेस्ट दिखाएँ',
    filterHint: 'ये रिक्वेस्ट दिखाता है',
    filterAll: 'सभी',
    filterPending: 'पेंडिंग',
    filterActive: 'चालू',
    filterCompleted: 'पूरी हुई',
    filterRejected: 'मना की गई',

    groupPending: 'पेंडिंग',
    groupActive: 'चालू',
    groupCompleted: 'पूरी हुई',
    groupSpoken: (group: string, count: number) =>
      count === 1 ? `${group}, 1 रिक्वेस्ट` : `${group}, ${count} रिक्वेस्ट`,

    loadingLabel: 'आपकी रिक्वेस्ट लोड हो रही हैं',
    failedTitle: 'हम आपकी रिक्वेस्ट लोड नहीं कर सके',

    emptyAllTitle: 'अभी तक कोई रिक्वेस्ट नहीं',
    emptyAllMessage: 'नई सेवा रिक्वेस्ट यहाँ दिखेंगी।',
    emptyPendingTitle: 'कोई पेंडिंग रिक्वेस्ट नहीं',
    emptyPendingMessage: 'जिन रिक्वेस्ट को आपके जवाब का इंतज़ार है, वे यहाँ दिखेंगी।',
    emptyActiveTitle: 'कोई चालू काम नहीं',
    emptyActiveMessage: 'आप जो रिक्वेस्ट स्वीकार करेंगे, वे काम चलने तक यहाँ दिखेंगी।',
    emptyCompletedTitle: 'अभी तक कोई पूरी हुई रिक्वेस्ट नहीं',
    emptyCompletedMessage: 'आप जो काम पूरा करेंगे, वह यहाँ दिखेगा।',
    emptyRejectedTitle: 'कोई मना की गई रिक्वेस्ट नहीं',
    emptyRejectedMessage: 'आपने अभी तक कोई रिक्वेस्ट मना नहीं की है।',

    staleTitle: 'रीफ़्रेश नहीं हो सका',
    staleMessage: 'ये रिक्वेस्ट पुरानी हो सकती हैं।',
    staleRetry: 'फिर से कोशिश करें',
    staleRetryHint: 'आपकी रिक्वेस्ट फिर से लोड करता है',
  },

  answer: {
    accept: 'स्वीकार करें',
    reject: 'मना करें',
    acceptSpoken: (service: string, reference?: string) =>
      reference ? `स्वीकार करें: ${service}, ${reference}` : `स्वीकार करें: ${service}`,
    rejectSpoken: (service: string, reference?: string) =>
      reference ? `मना करें: ${service}, ${reference}` : `मना करें: ${service}`,
    acceptHint: 'यह काम ले लेता है',
    rejectHint: 'इस रिक्वेस्ट को मना करने से पहले पूछता है',

    section: 'आपका जवाब',
    promptDirected:
      'ग्राहक ने आपको चुना है। काम लेने के लिए स्वीकार करें, या अगर आप यह नहीं कर सकते तो मना करें।',
    promptBroadcast:
      'दूसरे प्रोफ़ेशनल भी यह रिक्वेस्ट देख सकते हैं। जो इसे पहले स्वीकार करेगा, काम उसे मिलेगा।',
    prompt: 'काम लेने के लिए स्वीकार करें, या अगर आप यह नहीं कर सकते तो मना करें।',

    rejectTitle: 'रिक्वेस्ट मना करें?',
    rejectMessage: 'इसके बाद आप इसे नहीं ले पाएँगे। यह आपकी "मना की गई" सूची में रहेगी।',
    rejectCancel: 'रद्द करें',
    rejectCancelHint: 'रिक्वेस्ट को रहने देता है',
    rejectConfirm: 'मना करें',
    rejectConfirmHint: 'इस रिक्वेस्ट को मना करता है',

    accepted: 'रिक्वेस्ट स्वीकार हो गई। अब यह आपके चालू काम में है।',
    rejected: 'रिक्वेस्ट मना कर दी गई।',
    taken: 'यह रिक्वेस्ट अब उपलब्ध नहीं है। किसी दूसरे प्रोफ़ेशनल ने इसे पहले स्वीकार कर लिया।',
    notPending: 'यह रिक्वेस्ट अब जवाब का इंतज़ार नहीं कर रही है।',
    unavailable: 'यह रिक्वेस्ट अब उपलब्ध नहीं है।',
    acceptFailed: 'रिक्वेस्ट स्वीकार नहीं हुई।',
    rejectFailed: 'रिक्वेस्ट मना नहीं हुई।',
  },

  work: {
    start: 'काम शुरू करें',
    complete: 'पूरा हुआ मार्क करें',
    startSpoken: (service: string, reference?: string) =>
      reference ? `काम शुरू करें: ${service}, ${reference}` : `काम शुरू करें: ${service}`,
    completeSpoken: (service: string, reference?: string) =>
      reference ? `पूरा हुआ मार्क करें: ${service}, ${reference}` : `पूरा हुआ मार्क करें: ${service}`,
    startHint: 'इस काम को "काम जारी" मार्क करता है',
    completeHint: 'अंतिम राशि और भुगतान दर्ज करने का फ़ॉर्म खोलता है',

    section: 'आपका काम',
    promptStart: 'काम शुरू करते समय "काम शुरू करें" दबाएँ।',
    promptComplete:
      'काम हो जाने पर इसे पूरा हुआ मार्क करें। आप अंतिम राशि और भुगतान दर्ज करेंगे।',

    completeTitle: 'यह काम पूरा करें?',
    completeMessage:
      'इससे रिक्वेस्ट पूरी हुई मार्क हो जाएगी और भुगतान की जानकारी सेव हो जाएगी। यह बदलाव वापस नहीं लिया जा सकता।',
    completeCancel: 'रद्द करें',
    completeCancelHint: 'काम को जारी रहने देता है',
    completeConfirm: 'पूरा करें',
    completeConfirmHint: 'इस काम को पूरा हुआ मार्क करता है',

    started: 'काम शुरू हो गया। अब यह काम जारी है।',
    completed: 'काम पूरा हो गया। अब यह आपके पूरे हुए काम में है।',
    changed: 'इस काम में पहले ही बदलाव हो चुका है। इसकी ताज़ा स्थिति दिखाई जा रही है।',
    startFailed: 'काम शुरू नहीं हुआ।',
    completeFailed: 'काम पूरा हुआ मार्क नहीं हुआ।',

    paymentRecorded: 'भुगतान दर्ज हो गया। अब यह काम "भुगतान हो गया" मार्क है।',
    recordPaymentFailed: 'भुगतान दर्ज नहीं हुआ।',
  },

  completeForm: {
    title: 'काम पूरा करें',
    subtitle:
      'दर्ज करें कि काम कितने का हुआ और ग्राहक ने आपको भुगतान किया है या नहीं। Fixora भुगतान प्रोसेस नहीं करता।',
    back: 'वापस',

    amountLabel: 'अंतिम राशि',
    amountPlaceholder: 'जैसे 1250',
    amountHelper: 'काम की कुल राशि। पैसे के लिए पॉइंट लगाएँ, जैसे 1250.50।',

    statusLabel: 'भुगतान की स्थिति',
    statusHint: 'तय करता है कि ग्राहक ने भुगतान किया है या नहीं',

    methodLabel: 'भुगतान का तरीका',
    methodHint: 'तय करता है कि ग्राहक ने कैसे भुगतान किया',
    methodsLoading: 'भुगतान के तरीके लोड हो रहे हैं',
    methodsFailed: 'भुगतान के तरीके लोड नहीं हुए।',
    methodsNone: 'अभी भुगतान का कोई तरीका उपलब्ध नहीं है।',
    methodsRetry: 'फिर से कोशिश करें',
    methodsRetryHint: 'भुगतान के तरीके फिर से लोड करता है',

    notesLabel: 'काम पूरा होने के नोट्स',
    notesPlaceholder: 'क्या काम हुआ, कौन-से पार्ट लगे, इस काम के बारे में याद रखने वाली कोई बात',
    notesHelper: 'वैकल्पिक',

    submit: 'काम पूरा करें',
    submitHint: 'इस काम को पूरा हुआ मार्क करने से पहले पूछता है',
    fixErrors: 'हाइलाइट किए गए फ़ील्ड जाँचें।',

    discardTitle: 'काम पूरा करना छोड़ें?',
    discardMessage: 'आपकी डाली हुई राशि और भुगतान की जानकारी सेव नहीं हुई है।',
    discardKeep: 'बदलाव जारी रखें',
    discardKeepHint: 'फ़ॉर्म पर वापस ले जाता है',
    discardConfirm: 'छोड़ें',
    discardConfirmHint: 'काम पूरा किए बिना बाहर निकलता है',
  },

  payment: {
    section: 'भुगतान',
    amountLabel: 'अंतिम राशि',
    statusLabel: 'भुगतान की स्थिति',
    notesLabel: 'काम पूरा होने के नोट्स',
    recorded: 'यह आपने दर्ज किया है। Fixora भुगतान प्रोसेस नहीं करता।',

    recordPayment: 'भुगतान दर्ज करें',
    recordPaymentHint: 'ग्राहक ने कैसे भुगतान किया, यह दर्ज करने का फ़ॉर्म खोलता है',
  },

  recordPaymentForm: {
    title: 'भुगतान दर्ज करें',
    subtitle:
      'दर्ज करें कि ग्राहक ने इस काम के लिए आपको कैसे भुगतान किया। "भुगतान हो गया" मार्क होने के बाद इसे बदला नहीं जा सकता। Fixora भुगतान प्रोसेस नहीं करता।',
    back: 'वापस',

    submit: 'भुगतान दर्ज करें',
    submitHint: 'इस काम को "भुगतान हो गया" मार्क करने से पहले पूछता है',
    fixErrors: 'हाइलाइट किए गए फ़ील्ड जाँचें।',

    confirmTitle: (method: string) => `${method} से भुगतान हुआ मार्क करें?`,
    confirmTitlePlain: 'इस काम को "भुगतान हो गया" मार्क करें?',
    confirmMessage: 'इसे बाद में बदला नहीं जा सकता।',
    confirmCancel: 'रद्द करें',
    confirmCancelHint: 'भुगतान को "अभी भुगतान नहीं हुआ" ही रहने देता है',
    confirmConfirm: 'भुगतान हुआ मार्क करें',
    confirmConfirmHint: 'इस काम को "भुगतान हो गया" दर्ज करता है',

    discardTitle: 'यह भुगतान छोड़ें?',
    discardMessage: 'आपका चुना हुआ भुगतान का तरीका सेव नहीं हुआ है।',
    discardKeep: 'बदलाव जारी रखें',
    discardKeepHint: 'फ़ॉर्म पर वापस ले जाता है',
    discardConfirm: 'छोड़ें',
    discardConfirmHint: 'भुगतान दर्ज किए बिना बाहर निकलता है',
  },

  requestDetails: {
    back: 'वापस',
    loading: 'यह रिक्वेस्ट लोड हो रही है',
    failedTitle: 'हम यह रिक्वेस्ट लोड नहीं कर सके',
    notFoundTitle: 'यह रिक्वेस्ट उपलब्ध नहीं है',
    notFoundMessage: 'हो सकता है किसी और ने इसे ले लिया हो, या यह अब आपके लिए खुली न हो।',

    requestSection: 'रिक्वेस्ट',
    referenceLabel: 'रेफ़रेंस',
    copyReference: (reference: string) => `रेफ़रेंस ${reference} कॉपी करें`,
    copyReferenceHint: 'रेफ़रेंस को क्लिपबोर्ड पर कॉपी करता है',
    copied: 'कॉपी हो गया',
    copyFailed: 'हम रेफ़रेंस कॉपी नहीं कर सके। आप इसे लिखकर रख सकते हैं।',
    categoryLabel: 'कैटेगरी',
    serviceLabel: 'सेवा',
    statusLabel: 'स्थिति',
    priorityLabel: 'प्राथमिकता',
    raisedLabel: 'भेजी गई',
    completedLabel: 'पूरी हुई',
    rejectedLabel: 'मना की गई',

    originLabel: 'यह आप तक कैसे पहुँची',
    originDirected: 'ग्राहक ने इस रिक्वेस्ट के लिए आपको चुना है।',
    originBroadcast: 'यह सेवा देने वाले हर प्रोफ़ेशनल को भेजी गई है।',

    preferredDateLabel: 'पसंदीदा तारीख़',
    preferredTimeLabel: 'पसंदीदा समय',
    today: 'आज',
    tomorrow: 'कल',

    customerSection: 'ग्राहक',
    customerLabel: 'नाम',
    phoneLabel: 'फ़ोन',

    locationSection: 'जगह',
    localityLabel: 'इलाका',
    addressLabel: 'पता',
    withheldNote: 'स्वीकार करने के बाद आपको ग्राहक का नाम, फ़ोन नंबर और पूरा पता दिखाया जाता है।',

    photosLabel: 'फ़ोटो',
    photoCountOne: '1 फ़ोटो जुड़ी है',
    photoCountMany: 'फ़ोटो जुड़ी हैं',
    photoUnavailable: 'को दिखाया नहीं जा सका',

    descriptionSection: 'ग्राहक ने क्या बताया',
    descriptionMissing: 'ग्राहक ने कोई विवरण नहीं जोड़ा।',
  },

  reviews: {
    title: 'रिव्यू',
    subtitle: 'ग्राहकों ने आपके काम के बारे में क्या कहा।',
    back: 'वापस',

    summaryTitle: 'कुल रेटिंग',
    count: (count: number) => (count === 1 ? '1 रिव्यू' : `${count} रिव्यू`),
    summarySpoken: (average: string, max: number, count: number) =>
      `रेटिंग ${max} में से ${average}, ${count === 1 ? '1 रिव्यू' : `${count} रिव्यू`} के आधार पर।`,

    breakdownRowSpoken: (stars: number, percent: number, count: number) =>
      `${stars} स्टार, ${percent} प्रतिशत, ${count} रिव्यू`,

    fromSpoken: (name: string) => `${name} का रिव्यू`,
    anonymousSpoken: 'ग्राहक का रिव्यू',
    commentSpoken: 'कमेंट',

    figureLabel: 'रेटिंग',
    figureNone: 'अभी कोई रिव्यू नहीं',
    figureNoneSpoken: 'रेटिंग, अभी कोई रिव्यू नहीं',
    figureCountOnlySpoken: (count: string) => `रेटिंग, ${count}`,

    loading: 'आपके रिव्यू लोड हो रहे हैं',
    failedTitle: 'हम आपके रिव्यू लोड नहीं कर सके',

    emptyTitle: 'अभी कोई रिव्यू नहीं',
    emptyMessage: 'जब ग्राहक आपके पूरे हुए काम का रिव्यू करेंगे, तो उनके रिव्यू यहाँ दिखेंगे।',

    staleTitle: 'रीफ़्रेश नहीं हो सका',
    staleMessage: 'ये रिव्यू पुराने हो सकते हैं।',
    staleRetry: 'फिर से कोशिश करें',
    staleRetryHint: 'आपके रिव्यू फिर से लोड करता है',
  },

  reports: {
    title: 'रिपोर्ट',
    subtitle: 'आपके चुने हुए समय के लिए आपकी रिक्वेस्ट और रेटिंग।',
    back: 'प्रोफ़ाइल पर वापस',

    periodsLabel: 'रिपोर्ट का समय',
    periodHint: 'इस समय के आँकड़े दिखाता है',
    periodToday: 'आज',
    periodWeek: 'इस हफ़्ते',
    periodMonth: 'इस महीने',

    total: 'कुल रिक्वेस्ट',
    completed: 'पूरी हुई',
    rejected: 'मना की गई',
    cancelled: 'रद्द',
    totalSpoken: 'कुल रिक्वेस्ट',
    completedSpoken: 'पूरी हुई रिक्वेस्ट',
    rejectedSpoken: 'मना की गई रिक्वेस्ट',
    cancelledSpoken: 'रद्द हुई रिक्वेस्ट',
    unavailableSpoken: 'उपलब्ध नहीं',

    rating: 'औसत रेटिंग',
    ratingCount: (count: number) => (count === 1 ? '1 रेटिंग के आधार पर' : `${count} रेटिंग के आधार पर`),
    ratingSpoken: (average: string, max: number, count: number) =>
      `औसत रेटिंग ${max} में से ${average}, ${count === 1 ? '1 रेटिंग' : `${count} रेटिंग`} के आधार पर`,
    noRatings: 'अभी कोई रेटिंग नहीं',
    noRatingsSpoken: 'औसत रेटिंग, अभी कोई रेटिंग नहीं',

    noRequests: 'इस समय में अभी तक कोई रिक्वेस्ट नहीं आई।',

    loading: 'आपकी रिपोर्ट लोड हो रही है',
    failedTitle: 'हम आपकी रिपोर्ट लोड नहीं कर सके',

    staleTitle: 'रीफ़्रेश नहीं हो सका',
    staleMessage: 'ये आँकड़े पुराने हो सकते हैं।',
    staleRetry: 'फिर से कोशिश करें',
    staleRetryHint: 'यह रिपोर्ट फिर से लोड करता है',
  },

  team: {
    title: 'टीम',
    subtitle: 'वे लोग जो आपके साथ काम करते हैं।',

    add: 'टीम मेंबर जोड़ें',
    addHint: 'किसी को आपकी टीम में जोड़ने का फ़ॉर्म खोलता है',

    loading: 'आपकी टीम लोड हो रही है',
    failedTitle: 'हम आपकी टीम लोड नहीं कर सके',

    emptyTitle: 'अभी कोई टीम मेंबर नहीं',
    emptyMessage: 'आपने अभी तक कोई टीम मेंबर नहीं जोड़ा है।',

    phoneLabel: 'फ़ोन',
    memberSpoken: (name: string, role?: string, phone?: string) => {
      const who = role ? `${name}, ${role}` : name;
      return phone ? `${who}। फ़ोन ${phone}` : who;
    },

    statusActive: 'ऐक्टिव',
    statusDisabled: 'डिसेबल',
    statusUnknown: 'स्थिति उपलब्ध नहीं',
    memberWithStatusSpoken: (details: string, status: string) => `${details}। ${status}`,

    edit: 'बदलें',
    editSpoken: (name: string) => `बदलें: ${name}`,
    editHint: 'इस टीम मेंबर की जानकारी बदलने के लिए खोलता है',
    remove: 'हटाएँ',
    removeSpoken: (name: string) => `हटाएँ: ${name}`,
    removeHint: 'इस टीम मेंबर को हटाने से पहले पूछता है',

    removeTitle: 'टीम मेंबर हटाएँ?',
    removeMessage: (name: string) => `${name} को आपकी टीम से हटा दिया जाएगा।`,
    removeCancel: 'रद्द करें',
    removeCancelHint: 'इस टीम मेंबर को रहने देता है',
    removeConfirm: 'हटाएँ',
    removeConfirmHint: 'इस टीम मेंबर को आपकी टीम से हटाता है',

    removed: 'टीम मेंबर हटा दिया गया।',
    removeFailed: 'टीम मेंबर नहीं हटा।',

    staleTitle: 'रीफ़्रेश नहीं हो सका',
    staleMessage: 'आपकी टीम की जानकारी पुरानी हो सकती है।',
    staleRetry: 'फिर से कोशिश करें',
    staleRetryHint: 'आपकी टीम फिर से लोड करता है',
  },

  teamForm: {
    addTitle: 'टीम मेंबर जोड़ें',
    addSubtitle: 'उनकी जानकारी एक जगह रखें। टीम मेंबर Fixora में साइन इन नहीं करते।',
    editTitle: 'टीम मेंबर की जानकारी बदलें',
    editSubtitle: 'उनकी जानकारी बदलें, फिर सेव करें।',
    back: 'टीम पर वापस',

    nameLabel: 'नाम',
    namePlaceholder: 'उनका पूरा नाम',
    roleLabel: 'रोल',
    rolePlaceholder: 'जैसे सीनियर टेक्नीशियन',
    roleHelper: 'वैकल्पिक',
    phoneLabel: 'फ़ोन नंबर',
    phonePlaceholder: 'उनका फ़ोन नंबर',
    phoneHelper: 'वैकल्पिक',

    photoSection: 'फ़ोटो',
    photoSupport: 'वैकल्पिक। उनके चेहरे की साफ़ फ़ोटो।',
    photoAdd: 'फ़ोटो जोड़ें',
    photoChange: 'फ़ोटो बदलें',
    photoOptionsHint: 'फ़ोटो के विकल्प खोलता है',
    photoSheetTitle: 'उनकी फ़ोटो',
    photoGallery: 'गैलरी से चुनें',
    photoGalleryHint: 'एक फ़ोटो चुनने के लिए आपकी फ़ोटो खोलता है',
    photoCamera: 'फ़ोटो लें',
    photoCameraHint: 'कैमरा खोलता है',
    photoRemove: 'फ़ोटो हटाएँ',
    photoRemoveHint: 'इस फ़ॉर्म से उनकी फ़ोटो हटाता है। बदलाव रखने के लिए सेव करें।',
    photoCancel: 'रद्द करें',
    photoCancelHint: 'फ़ोटो के विकल्प बंद करता है',
    photoUploading: 'फ़ोटो अपलोड हो रही है…',
    photoProgress: (percent: number) => `अपलोड हो रहा है… ${percent}%`,
    photoFailedTitle: 'फ़ोटो अपलोड नहीं हुई',
    photoRetry: 'फिर से कोशिश करें',
    photoDiscard: 'छोड़ें',
    photoDiscardHint: 'जो फ़ोटो अपलोड नहीं हुई, उसे छोड़ देता है',

    saveAdd: 'टीम मेंबर जोड़ें',
    saveEdit: 'बदलाव सेव करें',
    saving: 'सेव हो रहा है…',
    saveAddHint: 'इस व्यक्ति को आपकी टीम में जोड़ता है',
    saveEditHint: 'इस टीम मेंबर की जानकारी सेव करता है',
    saveFailedTitle: 'टीम मेंबर सेव नहीं हुआ',
    fixErrors: 'हाइलाइट किए गए फ़ील्ड जाँचें।',

    added: 'टीम मेंबर जोड़ दिया गया।',
    saved: 'टीम मेंबर की जानकारी अपडेट हो गई।',

    loading: 'इस टीम मेंबर की जानकारी लोड हो रही है',
    failedTitle: 'हम इस टीम मेंबर की जानकारी लोड नहीं कर सके',
    notFoundTitle: 'यह टीम मेंबर अब आपकी टीम में नहीं है',
    notFoundMessage:
      'हो सकता है उन्हें हटा दिया गया हो। अपनी टीम की ताज़ा जानकारी देखने के लिए वापस जाएँ।',

    discardTitle: 'बदलाव छोड़ें?',
    discardMessage: 'इस टीम मेंबर में किए गए आपके बदलाव सेव नहीं हुए हैं।',
    discardKeep: 'बदलाव जारी रखें',
    discardKeepHint: 'फ़ॉर्म पर वापस ले जाता है',
    discardConfirm: 'छोड़ें',
    discardConfirmHint: 'सेव किए बिना बाहर निकलता है',

    statusSection: 'स्थिति',
    statusActiveMessage:
      'जो अभी आपके साथ काम नहीं कर रहे, उन्हें डिसेबल करें। वे आपकी टीम में बने रहेंगे, और आप उन्हें फिर से ऐक्टिव कर सकते हैं।',
    statusDisabledMessage:
      'यह टीम मेंबर डिसेबल मार्क है। जब तक आप उन्हें फिर से ऐक्टिव नहीं करते, वे आपकी टीम में बने रहेंगे।',
    statusUnknownMessage:
      'उनकी मौजूदा स्थिति यहाँ नहीं दिखाई जा सकती। आप फिर भी उन्हें डिसेबल कर सकते हैं — वे आपकी टीम में डिसेबल मार्क होकर बने रहेंगे।',
    disable: 'मेंबर को डिसेबल करें',
    disableHint: 'इस टीम मेंबर को डिसेबल मार्क करने से पहले पूछता है',
    enable: 'मेंबर को ऐक्टिव करें',
    enableHint: 'इस टीम मेंबर को फिर से ऐक्टिव मार्क करता है',

    disableTitle: (name: string) => `${name} को डिसेबल करें?`,
    disableMessage: 'वे आपकी टीम में डिसेबल मार्क होकर बने रहेंगे। आप उन्हें फिर से ऐक्टिव कर सकते हैं।',
    disableCancel: 'रद्द करें',
    disableCancelHint: 'उनकी स्थिति बदले बिना बंद करता है',
    disableConfirm: 'डिसेबल करें',
    disableConfirmHint: 'इस टीम मेंबर को डिसेबल मार्क करता है',

    disabled: 'टीम मेंबर डिसेबल हो गया।',
    enabled: 'टीम मेंबर ऐक्टिव हो गया।',
    disableFailed: 'टीम मेंबर डिसेबल नहीं हुआ।',
    enableFailed: 'टीम मेंबर ऐक्टिव नहीं हुआ।',
  },

  shopImages: {
    title: 'दुकान की फ़ोटो',
    subtitle: 'आपकी दुकान, गाड़ी या काम की फ़ोटो। हर बदलाव उसी समय सेव हो जाता है।',
    back: 'प्रोफ़ाइल पर वापस',

    count: (count: number, max: number) => `${max} में से ${count} फ़ोटो`,
    emptyCount: (max: number) => `अभी कोई फ़ोटो नहीं। आप ज़्यादा से ज़्यादा ${max} जोड़ सकते हैं।`,

    loading: 'आपकी दुकान की फ़ोटो लोड हो रही हैं',
    failedTitle: 'हम आपकी दुकान की फ़ोटो लोड नहीं कर सके',

    photoSpoken: (position: number, total: number) => `दुकान की फ़ोटो, ${total} में से ${position}`,

    takePhoto: 'फ़ोटो लें',
    choosePhoto: 'फ़ोटो चुनें',
    takePhotoSpoken: (remaining: number) =>
      remaining === 1
        ? 'फ़ोटो लें, कैमरे से। 1 और फ़ोटो जोड़ी जा सकती है।'
        : `फ़ोटो लें, कैमरे से। ${remaining} और फ़ोटो जोड़ी जा सकती हैं।`,
    choosePhotoSpoken: (remaining: number) =>
      remaining === 1
        ? 'फ़ोटो चुनें, अपनी गैलरी से। 1 और फ़ोटो जोड़ी जा सकती है।'
        : `फ़ोटो चुनें, अपनी गैलरी से। ${remaining} और फ़ोटो जोड़ी जा सकती हैं।`,

    uploading: 'अपलोड हो रही है',
    uploadFailed: 'अपलोड नहीं हुई',
    waiting: 'सेव होने का इंतज़ार',
    saving: 'सेव हो रही है',
    removing: 'हटाई जा रही है',
    notSaved: 'सेव नहीं हुई',
    tryAgain: 'फिर से कोशिश करें',
    tryAgainSpoken: (position: number, total: number, state: string) =>
      `फिर से कोशिश करें, दुकान की फ़ोटो ${total} में से ${position}, ${state}`,
    tryAgainHint: 'यह फ़ोटो फिर से भेजता है',
    removeSpoken: (position: number, total: number) =>
      `दुकान की फ़ोटो ${total} में से ${position} हटाएँ`,
    removeHint: 'इस फ़ोटो को आपकी दुकान की फ़ोटो से हटाने से पहले पूछता है',
    discardHint: 'इस फ़ोटो को सेव किए बिना हटा देता है',

    removeTitle: 'यह फ़ोटो हटाएँ?',
    removeMessage: 'इसे आपकी दुकान की फ़ोटो से हटा दिया जाएगा।',
    removeCancel: 'रद्द करें',
    removeCancelHint: 'इस फ़ोटो को रहने देता है',
    removeConfirm: 'हटाएँ',
    removeConfirmHint: 'इस फ़ोटो को आपकी दुकान की फ़ोटो से हटाता है',

    added: 'दुकान की फ़ोटो सेव हो गई।',
    removed: 'दुकान की फ़ोटो हटा दी गई।',
    saveFailed: 'फ़ोटो सेव नहीं हुई।',
    removeFailed: 'फ़ोटो नहीं हटी।',

    limitReached: (max: number) => `आप ज़्यादा से ज़्यादा ${max} दुकान की फ़ोटो जोड़ सकते हैं।`,
    unusable: 'यह फ़ोटो इस्तेमाल नहीं की जा सकती। कृपया कोई दूसरी चुनें।',
    cameraUnavailable: 'हम कैमरा नहीं खोल सके। आप इसके बजाय गैलरी से फ़ोटो चुन सकते हैं।',

    staleTitle: 'रीफ़्रेश नहीं हो सका',
    staleMessage: 'आपकी दुकान की फ़ोटो पुरानी हो सकती हैं।',
    staleRetry: 'फिर से कोशिश करें',
    staleRetryHint: 'आपकी दुकान की फ़ोटो फिर से लोड करता है',

    leaveTitle: 'फ़ोटो सेव होने से पहले जाएँ?',
    leaveMessage: ({
      alsoSending,
      mayBeSaved,
      alsoRemoving,
    }: {
      alsoSending: boolean;
      mayBeSaved: boolean;
      alsoRemoving: boolean;
    }) =>
      (mayBeSaved
        ? '"अपलोड हो रही है" या "अपलोड नहीं हुई" वाली फ़ोटो आपकी दुकान की फ़ोटो में नहीं जुड़ेंगी, ' +
          'और "सेव होने का इंतज़ार" या "सेव नहीं हुई" वाली फ़ोटो शायद न जुड़ें। जिस फ़ोटो की पिछली ' +
          'सेव का कोई जवाब नहीं आया, वह शायद सेव हो चुकी हो; बाद में अपनी दुकान की फ़ोटो देख लें।'
        : '"अपलोड हो रही है", "सेव होने का इंतज़ार", "अपलोड नहीं हुई" या "सेव नहीं हुई" वाली फ़ोटो ' +
          'आपकी दुकान की फ़ोटो में नहीं जुड़ेंगी।') +
      (alsoSending
        ? ' "सेव हो रही है" वाली फ़ोटो का सेव पूरा होगा, और अगर वह सेव नहीं हुई तो हम आपको बताएँगे।'
        : '') +
      (alsoRemoving
        ? ' "हटाई जा रही है" वाली फ़ोटो फिर भी हटा दी जाएगी, और अगर वह नहीं हटी तो हम आपको बताएँगे।'
        : ''),
    leaveStay: 'रुकें',
    leaveStayHint: 'आपकी दुकान की फ़ोटो पर वापस ले जाता है',
    leaveConfirm: 'जाएँ',
    leaveConfirmHint: 'जो फ़ोटो सेव नहीं हुईं, उनके बिना बाहर निकलता है',
  },

  availability: {
    section: 'उपलब्धता',
    acceptingLabel: 'नई रिक्वेस्ट ले रहे हैं',
    acceptingOn: 'ग्राहक आपको चुन सकते हैं और आपको नई रिक्वेस्ट मिलती हैं।',
    acceptingOff: 'आपको नई रिक्वेस्ट नहीं मिलेंगी। आपके स्वीकार किए हुए काम पर इसका असर नहीं पड़ता।',
    acceptingSpoken: (explanation: string) => `नई रिक्वेस्ट ले रहे हैं। ${explanation}`,
    turnOffHint: 'नई रिक्वेस्ट रोकने से पहले पूछता है',
    turnOnHint: 'नई रिक्वेस्ट फिर से चालू करता है',

    stopTitle: 'नई रिक्वेस्ट रोकें?',
    stopMessage:
      'जब तक आप इसे फिर से चालू नहीं करते, ग्राहक आपको नहीं चुन पाएँगे और आपको नई रिक्वेस्ट नहीं मिलेंगी। आपके स्वीकार किए हुए काम पर इसका असर नहीं पड़ता।',
    stopCancel: 'रद्द करें',
    stopCancelHint: 'नई रिक्वेस्ट चालू रखता है',
    stopConfirm: 'रोकें',
    stopConfirmHint: 'जब तक आप फिर से चालू न करें, नई रिक्वेस्ट रोक देता है',

    turnedOn: 'आप फिर से नई रिक्वेस्ट ले रहे हैं।',
    turnedOff: 'आपने नई रिक्वेस्ट रोक दी हैं।',
    turnOnFailed: 'नई रिक्वेस्ट चालू नहीं हुईं।',
    turnOffFailed: 'नई रिक्वेस्ट नहीं रुकीं।',

    hoursLabel: 'काम के घंटे',
    hoursEmpty: 'अभी नहीं जोड़े गए',
    hoursEdit: 'काम के घंटे बदलें',
    hoursEditHint: 'दिन और समय बदलने के लिए आपके काम के घंटे खोलता है',

    noticeTitle: 'आप अभी नई रिक्वेस्ट नहीं ले रहे हैं।',
    noticeTurnOn: 'चालू करें',
    noticeTurnOnSpoken: 'चालू करें: नई रिक्वेस्ट',
    noticeTurnOnHint: 'आपको फिर से नई रिक्वेस्ट भेजना शुरू करता है',
  },

  workingHours: {
    title: 'काम के घंटे',
    subtitle: 'वे दिन और समय जब आप आम तौर पर काम करते हैं। सेव करने तक कुछ नहीं बदलता।',
    back: 'प्रोफ़ाइल पर वापस',

    days: {
      MON: { short: 'सोम', long: 'सोमवार' },
      TUE: { short: 'मंगल', long: 'मंगलवार' },
      WED: { short: 'बुध', long: 'बुधवार' },
      THU: { short: 'गुरु', long: 'गुरुवार' },
      FRI: { short: 'शुक्र', long: 'शुक्रवार' },
      SAT: { short: 'शनि', long: 'शनिवार' },
      SUN: { short: 'रवि', long: 'रविवार' },
    },
    unknownDay: 'दिन',

    closed: 'बंद',
    open: 'खुला',
    openSpoken: 'खुला',
    hoursSpoken: (opens: string, closes: string) => `${opens} से ${closes} तक`,
    dayRangeSpoken: (first: string, last: string) => `${first} से ${last} तक`,
    closedSpoken: 'बंद',

    dayOpenSpoken: (day: string, hours: string) => `${day}, खुला, ${hours}`,
    dayClosedSpoken: (day: string) => `${day}, बंद`,
    dayCloseHint: (day: string) => `${day} को बंद मार्क करता है`,
    dayOpenHint: (day: string) => `${day} को खुला मार्क करता है`,

    opensLabel: 'खुलने का समय',
    closesLabel: 'बंद होने का समय',
    opensSpoken: (day: string, time: string) => `${day} को खुलने का समय, ${time}`,
    closesSpoken: (day: string, time: string) => `${day} को बंद होने का समय, ${time}`,
    timeHint: 'चुनने के लिए समय की सूची खोलता है',

    opensTitle: (day: string) => `${day} को खुलने का समय`,
    closesTitle: (day: string) => `${day} को बंद होने का समय`,
    timesLabel: 'समय',
    chooseCancel: 'रद्द करें',
    chooseCancelHint: 'समय बदले बिना सूची बंद करता है',

    closesBeforeOpens: 'बंद होने का समय खुलने के समय के बाद होना चाहिए।',

    copyMonday: 'सोमवार का समय बाकी कामकाजी दिनों में कॉपी करें',
    copyMondayHint: 'मंगलवार से शुक्रवार तक सोमवार जैसा ही समय लगाता है',
    copiedMonday: 'मंगलवार से शुक्रवार तक अब सोमवार जैसा ही समय है।',

    save: 'बदलाव सेव करें',
    saving: 'सेव हो रहा है…',
    saveHint: 'आपके काम के घंटे सेव करता है',
    saveFailedTitle: 'आपके काम के घंटे सेव नहीं हुए',
    fixErrors: 'हाइलाइट किए गए दिन जाँचें।',
    saved: 'काम के घंटे सेव हो गए।',

    discardTitle: 'बदलाव छोड़ें?',
    discardMessage: 'काम के घंटों में किए गए आपके बदलाव सेव नहीं हुए हैं।',
    discardKeep: 'बदलाव जारी रखें',
    discardKeepHint: 'आपके काम के घंटों पर वापस ले जाता है',
    discardConfirm: 'छोड़ें',
    discardConfirmHint: 'सेव किए बिना बाहर निकलता है',
  },

  profile: {
    title: 'प्रोफ़ाइल',
    businessSection: 'बिज़नेस',
    descriptionLabel: 'बिज़नेस के बारे में',
    categoriesLabel: 'सेवाएँ',
    areaLabel: 'सेवा का इलाका',
    notProvided: 'अभी नहीं जोड़ा गया',
    categoriesFailed: 'सेवाओं के नाम लोड नहीं हो सके',
    contactSection: 'संपर्क',
    ownerLabel: 'मालिक',
    phoneLabel: 'फ़ोन',
    emailLabel: 'ईमेल',
    edit: 'बिज़नेस प्रोफ़ाइल बदलें',
    editHint: 'बिज़नेस प्रोफ़ाइल का फ़ॉर्म खोलता है',
    reviews: 'ग्राहकों के रिव्यू',
    reviewsHint: 'ग्राहकों ने आपके काम के बारे में जो रिव्यू लिखे, वे खोलता है',
    reviewsWithRating: (rating: string) => `ग्राहकों के रिव्यू। ${rating}`,
    reports: 'रिपोर्ट',
    reportsHint: 'आज, इस हफ़्ते या इस महीने के आपकी रिक्वेस्ट और रेटिंग के आँकड़े खोलता है',
    team: 'टीम मैनेज करें',
    teamHint: 'आपकी टीम खोलता है',
    shopImagesSection: 'दुकान की फ़ोटो',
    shopImagesEmpty: 'अभी दुकान की कोई फ़ोटो नहीं',
    shopImages: 'दुकान की फ़ोटो मैनेज करें',
    shopImagesHint: 'फ़ोटो जोड़ने या हटाने के लिए आपकी दुकान की फ़ोटो खोलता है',
    logout: 'लॉग आउट',
    logoutHint: 'आपको साइन आउट करने से पहले पूछता है',
    logoutFailedTitle: 'हम आपको लॉग आउट नहीं कर सके',
    logoutConfirmTitle: 'लॉग आउट करें?',
    logoutConfirmMessage: 'जब आप फिर से साइन इन करेंगे, तब तक आपकी बिज़नेस प्रोफ़ाइल सेव रहेगी।',
    logoutCancel: 'रद्द करें',
    logoutCancelHint: 'आपको साइन इन रखता है',
    logoutConfirm: 'लॉग आउट',
    logoutConfirmHint: 'आपको Fixora से साइन आउट करता है',
  },
};
