/**
 * Customer copy — Hindi. Translates `CUSTOMER_COPY_EN` in `customerCopy.ts`; a
 * key left out reads in English. `{service}`, `{category}` and `{count}` stay as
 * they are; the stars' words come from `RATING_COPY_HI`, never written again here.
 *
 * Wording: polite "आप", everyday Hindi, and the loanwords people use in Indian
 * apps (रिक्वेस्ट, प्रोफ़ेशनल, कैटेगरी, फ़ोटो, सेव, रिव्यू). The buttons quoted inside
 * sentences ("आगे बढ़ें", "कोई पसंद नहीं", "मेरी रिक्वेस्ट") are the exact words
 * of those buttons and screens, so they must change together.
 *
 * ⚠️ Several values are fragments that code joins in a fixed English order, so
 * they are worded for the joined sentence, not on their own:
 * - `requestStatus.stepComplete` / `stepCurrent` follow a step title
 *   ("रिक्वेस्ट सबमिट हुई — यह चरण पूरा हो गया.");
 * - `confirmation.photoCountMany` / `photoUnavailable` follow a number
 *   ("3 फ़ोटो जुड़ी हैं, 1 को दिखाया नहीं जा सका") — the "को" form does not change
 *   with the count;
 * - `review.vendorPrefix`, `request.referencePrefix`, `addressBook.removeMessage`
 *   and `requestSubmitted.dispatchDirected` come before a name, a reference or
 *   an address, so each ends as a label ("प्रोफ़ेशनल:", "इन्हें भेजी गई:");
 * - `home.resumeFallbackService` and `createRequest.otherDraftSameCategory` are
 *   put into `{service}` of `otherDraftNotice` ("एक सेवा के लिए…",
 *   "किसी दूसरी … सेवा के लिए…"), and the first also stands alone on Home.
 *
 * ⚠️ Keep the English honesty: nothing here says a professional was told, that a
 * time is a booking, or that Fixora handles money. `cancelRequest.refused`
 * matches the app's error sentence word for word.
 */

import type { LocaleTable } from '@/core/i18n';
import type { CUSTOMER_COPY_EN } from '@/features/customer/constants/customerCopy';
import { RATING_COPY_HI } from '@/shared/presentation/rating.hi';

export const CUSTOMER_COPY_HI: LocaleTable<typeof CUSTOMER_COPY_EN> = {
  home: {
    greetingMorning: 'सुप्रभात',
    greetingAfternoon: 'शुभ दोपहर',
    greetingEvening: 'शुभ संध्या',
    greetingFallbackName: 'स्वागत है',

    prompt: 'आपको कौन-सी सेवा चाहिए?',
    promptSupport: 'कैटेगरी चुनें और हम आपके पास का कोई प्रोफ़ेशनल ढूँढेंगे।',

    primaryAction: 'सेवा की रिक्वेस्ट करें',
    primaryActionHint: 'सेवा की कैटेगरी की सूची खोलता है',

    categoriesTitle: 'सेवा की कैटेगरी',
    categoriesAction: 'सभी देखें',
    categoriesActionHint: 'सेवा की कैटेगरी की पूरी सूची खोलता है',
    categoriesEmptyTitle: 'अभी कोई सेवा उपलब्ध नहीं है',
    categoriesEmptyMessage: 'आपके इलाके में सेवाएँ उपलब्ध होते ही यहाँ दिखेंगी।',
    categoriesLoadingLabel: 'सेवा की कैटेगरी लोड हो रही हैं',

    recentTitle: 'हाल की रिक्वेस्ट',
    recentLoadingLabel: 'हाल की रिक्वेस्ट लोड हो रही हैं',

    recentEmptyTitle: 'आपकी अभी तक कोई सेवा रिक्वेस्ट नहीं है।',
    recentEmptyMessage: 'आपकी रिक्वेस्ट यहाँ दिखेंगी, ताकि आप एक नज़र में उनकी स्थिति देख सकें।',

    screenLabel: 'होम',

    staleTitle: 'रीफ़्रेश नहीं हो सका',
    staleMessage: 'यहाँ दिख रही जानकारी पुरानी हो सकती है।',
    staleRetry: 'फिर से कोशिश करें',
    staleRetryHint: 'आपकी सेवाएँ और रिक्वेस्ट फिर से लोड करता है',

    resumeTitle: 'अपनी रिक्वेस्ट जारी रखें',
    resumeMessage: 'जहाँ छोड़ा था, वहीं से शुरू करें।',
    resumeAction: 'आगे बढ़ें',
    resumeHint: 'आपकी शुरू की हुई रिक्वेस्ट फिर से खोलता है',
    resumeFallbackService: 'एक सेवा',
  },

  categories: {
    title: 'सभी कैटेगरी',
    subtitle: 'आपको जैसी मदद चाहिए, वह चुनें, आगे हम संभाल लेंगे।',

    itemHint: 'इस कैटेगरी की सेवाएँ दिखाता है',

    emptyTitle: 'अभी कोई सेवा उपलब्ध नहीं है',
    emptyMessage:
      'आपके इलाके में सेवाएँ उपलब्ध होते ही यहाँ दिखेंगी। कृपया थोड़ी देर बाद फिर देखें।',

    back: 'वापस',
    backHint: 'पिछली स्क्रीन पर वापस ले जाता है',

    loadingLabel: 'कैटेगरी लोड हो रही हैं',

    staleTitle: 'रीफ़्रेश नहीं हो सका',
    staleMessage: 'ये कैटेगरी पुरानी हो सकती हैं।',
    staleRetry: 'फिर से कोशिश करें',
    staleRetryHint: 'कैटेगरी फिर से लोड करता है',
  },

  subCategories: {
    fallbackTitle: 'सेवा चुनें',
    subtitle: 'जो काम करवाना है, उसे चुनें। उसके बाद हम बाकी जानकारी लेंगे।',

    itemHint: 'इस सेवा के लिए रिक्वेस्ट शुरू करता है',

    emptyTitle: 'यहाँ अभी कुछ उपलब्ध नहीं है',
    emptyMessage:
      'इस कैटेगरी में अभी कोई सेवा उपलब्ध नहीं है। कोई दूसरी कैटेगरी आज़माएँ, या थोड़ी देर बाद फिर देखें।',

    back: 'वापस',
    backHint: 'पिछली स्क्रीन पर वापस ले जाता है',

    loadingLabel: 'सेवाएँ लोड हो रही हैं',
  },

  createRequest: {
    title: 'रिक्वेस्ट की जानकारी',
    subtitle: 'बताएँ कि क्या काम करवाना है। हम इसे किसी प्रोफ़ेशनल तक पहुँचाएँगे।',

    back: 'वापस',
    backHint: 'सेवाओं की सूची पर वापस ले जाता है',

    serviceTitle: 'सेवा',
    serviceFallback: 'चुनी गई सेवा',
    serviceUnavailable:
      'हम सेवा का नाम लोड नहीं कर सके, लेकिन आपकी रिक्वेस्ट फिर भी सही लोगों तक पहुँचेगी।',

    otherDraftNotice: '{service} के लिए आपकी रिक्वेस्ट अधूरी है।',
    otherDraftSameCategory: 'किसी दूसरी {category} सेवा',
    otherDraftConsequence:
      'यह रिक्वेस्ट तभी रखी जाएगी जब आप "आगे बढ़ें" दबाएँगे, और तब यह उस रिक्वेस्ट की जगह ले लेगी।',

    priorityTitle: 'यह कितना ज़रूरी है?',
    prioritySupport: 'इससे हमें यह तय करने में मदद मिलती है कि किसी को कितनी जल्दी ढूँढना है।',

    dateTitle: 'पसंदीदा तारीख़',
    timeTitle: 'पसंदीदा समय',
    scheduleSupport:
      'वैकल्पिक। यह आपकी रिक्वेस्ट के साथ आपकी पसंद के रूप में भेजा जाता है, बुकिंग के रूप में नहीं।',
    anyDate: 'कोई पसंद नहीं',
    anyTime: 'कोई पसंद नहीं',
    today: 'आज',
    tomorrow: 'कल',
    dateHint: 'आपकी पसंद का दिन चुनता है',
    timeHint: 'आपकी पसंद का समय चुनता है',

    photosTitle: 'फ़ोटो',
    photosSupport: 'वैकल्पिक। अक्सर एक फ़ोटो शब्दों से बेहतर समस्या दिखा देती है।',
    photosCamera: 'कैमरा',
    photosGallery: 'गैलरी',
    photosCameraHint: 'समस्या की फ़ोटो लेने के लिए कैमरा खोलता है',
    photosGalleryHint: 'आपकी फ़ोटो गैलरी खोलता है',
    photoRemove: 'फ़ोटो हटाएँ',
    photoRetry: 'फिर से अपलोड करें',
    photoUploading: 'अपलोड हो रही है',
    photoFailed: 'अपलोड नहीं हुई',
    photoUploaded: 'अपलोड हो गई',
    photosLimitReached: 'आप ज़्यादा से ज़्यादा {count} फ़ोटो जोड़ सकते हैं।',
    cameraUnavailable: 'हम कैमरा नहीं खोल सके। आप इसके बजाय गैलरी से फ़ोटो चुन सकते हैं।',
    photosBusy: 'आपकी फ़ोटो अभी अपलोड हो रही हैं।',
    photosUnresolved:
      'कुछ फ़ोटो अपलोड नहीं हुईं। सबमिट करने से पहले उन्हें फिर से अपलोड करें या हटा दें।',

    notesTitle: 'नोट्स',
    notesLabel: 'और कुछ जो हमें जानना चाहिए?',
    notesPlaceholder: 'पंखा आवाज़ करता है और दस मिनट बाद बंद हो जाता है।',
    notesSupport: 'वैकल्पिक।',

    priorityRequired: 'चुनें कि यह कितना ज़रूरी है।',
    dateInvalid: 'सूची में से एक तारीख़ चुनें।',
    timeInvalid: 'सूची में से एक समय चुनें।',
    notesTooLong: 'कृपया इसे {count} अक्षरों या उससे कम में लिखें।',

    submit: 'आगे बढ़ें',
    submitHint: 'प्रोफ़ेशनल चुनने के चरण पर ले जाता है',

    loadingLabel: 'सेवा की जानकारी लोड हो रही है',
  },

  serviceAddress: {
    title: 'हमें कहाँ आना है?',
    subtitle: 'प्रोफ़ेशनल को आप तक पहुँचने के लिए पता चाहिए।',

    back: 'वापस',
    backHint: 'रिक्वेस्ट की जानकारी पर वापस ले जाता है',

    searchLabel: 'सेवा का पता',
    searchPlaceholder: 'गली, इलाका या लैंडमार्क',
    searchHint: 'टाइप करने पर मिलते-जुलते पते दिखाता है',

    useCurrentLocation: 'मेरी मौजूदा लोकेशन इस्तेमाल करें',
    useCurrentLocationHint: 'आपके डिवाइस की लोकेशन से आपका पता ढूँढता है',
    locating: 'आपकी लोकेशन ढूँढी जा रही है',

    useSaved: 'सेव किया हुआ पता इस्तेमाल करें',
    useSavedHint: 'आपके सेव किए हुए पते खोलता है, ताकि आप एक चुनकर इसे भर सकें',

    suggestionsLabel: 'मिलते-जुलते पते',
    suggestionHint: 'इसे आपके सेवा के पते के रूप में चुनता है',

    emptyTitle: 'पता टाइप करना शुरू करें',
    emptyMessage: 'या अगर टाइप नहीं करना चाहते, तो अपनी मौजूदा लोकेशन इस्तेमाल करें।',

    noResultsTitle: 'कोई मिलता-जुलता पता नहीं मिला',
    noResultsMessage: 'हमें यह पता नहीं मिला। आपने जो टाइप किया है, आप वही इस्तेमाल कर सकते हैं।',
    useTyped: 'जो टाइप किया, वही इस्तेमाल करें',
    useTypedHint: 'आपने जो लिखा है, उसे आपका सेवा का पता बनाता है',

    searchErrorFallback:
      'पता खोजने की सुविधा अभी उपलब्ध नहीं है। आप फिर भी अपना पता टाइप कर सकते हैं।',

    selectedLabel: 'सेवा का पता',
    change: 'बदलें',
    changeHint: 'यह पता हटाता है, ताकि आप दूसरा चुन सकें',

    required: 'आगे बढ़ने के लिए सेवा का पता डालें।',
    tooShort: 'यह थोड़ा छोटा लग रहा है। इतना लिखें कि कोई आप तक पहुँच सके।',

    submit: 'आगे बढ़ें',
    submitHint: 'यह पता सेव करता है और प्रोफ़ेशनल चुनने के चरण पर ले जाता है',
  },

  chooseSavedAddress: {
    title: 'सेव किया हुआ पता चुनें',
    subtitle: 'इससे आपका सेवा का पता भर जाएगा। आगे बढ़ने से पहले आप इसे बदल भी सकते हैं।',

    back: 'वापस',
    backHint: 'सेवा के पते पर वापस ले जाता है',

    optionHint: 'इसे आपके सेवा के पते के रूप में इस्तेमाल करता है',

    loadingLabel: 'आपके सेव किए हुए पते लोड हो रहे हैं',

    failedTitle: 'हम आपके सेव किए हुए पते लोड नहीं कर सके',
    emptyTitle: 'कोई सेव किया हुआ पता नहीं',
    emptyMessage: 'पता टाइप करने के लिए वापस जाएँ, या अपनी मौजूदा लोकेशन इस्तेमाल करें।',
  },

  location: {
    denied: 'लोकेशन ऐक्सेस उपलब्ध नहीं है। आप इसके बजाय सेवा का पता लिख सकते हैं।',
    openSettings: 'सेटिंग्स खोलें',
    openSettingsHint: 'सिस्टम सेटिंग्स में यह ऐप खोलता है, जहाँ लोकेशन ऐक्सेस बदला जा सकता है',

    unavailable: 'हम आपकी लोकेशन नहीं ढूँढ सके। कृपया इसके बजाय अपना पता टाइप करें।',
    unresolved: 'हम आपकी लोकेशन से पता नहीं निकाल सके। कृपया इसे टाइप करें।',

    confirmPrompt: 'क्या यह सही है? आगे बढ़ने से पहले आप इसे बदल सकते हैं।',
  },

  preferredVendor: {
    title: 'प्रोफ़ेशनल चुनें',
    subtitle:
      'किसी खास प्रोफ़ेशनल को चुनें, या हमें आपकी रिक्वेस्ट के बारे में उपलब्ध प्रोफ़ेशनलों को बताने दें।',

    back: 'वापस',
    backHint: 'सेवा के पते पर वापस ले जाता है',

    vendorHint: 'आपकी रिक्वेस्ट इस प्रोफ़ेशनल को भेजता है',

    ratingUnit: 'स्टार',
    reviewsUnit: 'रिव्यू',

    noPreferenceTitle: 'कोई पसंद नहीं',
    noPreferenceMessage: 'हम उपलब्ध प्रोफ़ेशनलों को आपकी रिक्वेस्ट के बारे में बताएँगे।',
    noPreferenceHint: 'आपकी रिक्वेस्ट किसी भी उपलब्ध प्रोफ़ेशनल को भेजता है',

    chooseFirst: 'कोई प्रोफ़ेशनल चुनें, या "कोई पसंद नहीं" चुनें।',

    emptyTitle: 'अभी सूची में कोई प्रोफ़ेशनल नहीं है',
    emptyMessage:
      'प्रोफ़ेशनल उपलब्ध होते ही हम उन्हें आपकी रिक्वेस्ट के बारे में बताएँगे। आगे बढ़ने के लिए "कोई पसंद नहीं" चुनें।',

    errorFallback: 'आप फिर भी "कोई पसंद नहीं" के साथ आगे बढ़ सकते हैं।',

    vendorUnavailable:
      'आपने पहले जिस प्रोफ़ेशनल को चुना था, वे अभी इस सेवा के लिए उपलब्ध नहीं हैं, इसलिए आप किसी दूसरे को चुन सकते हैं या "कोई पसंद नहीं" के साथ आगे बढ़ सकते हैं।',

    submit: 'आगे बढ़ें',
    submitHint: 'आपकी रिक्वेस्ट जाँचने के चरण पर ले जाता है',

    loadingLabel: 'प्रोफ़ेशनल लोड हो रहे हैं',
  },

  confirmation: {
    title: 'अपनी रिक्वेस्ट जाँचें',
    subtitle: 'भेजने से पहले एक आख़िरी बार देख लें। आप वापस जाकर कुछ भी बदल सकते हैं।',

    back: 'वापस',
    backHint: 'प्रोफ़ेशनल चुनने के चरण पर वापस ले जाता है',

    sectionService: 'सेवा',
    sectionDetails: 'रिक्वेस्ट की जानकारी',
    sectionExtras: 'अतिरिक्त जानकारी',
    sectionLocation: 'सेवा की जगह',
    sectionVendor: 'प्रोफ़ेशनल की पसंद',

    edit: 'बदलें',
    editDetails: 'रिक्वेस्ट की जानकारी बदलें',
    editDetailsHint: 'यह कितना ज़रूरी है और पसंदीदा समय बदलने के लिए वापस ले जाता है',
    editExtras: 'नोट्स और फ़ोटो बदलें',
    editExtrasHint: 'नोट्स और फ़ोटो पर वापस ले जाता है',
    editVendor: 'प्रोफ़ेशनल बदलें',
    editVendorHint: 'प्रोफ़ेशनल चुनने के चरण पर वापस ले जाता है',
    editAddress: 'सेवा का पता बदलें',
    editAddressHint: 'काम की जगह चुनने के चरण पर वापस ले जाता है',

    serviceLabel: 'सेवा',
    categoryLabel: 'कैटेगरी',
    serviceFallback: 'चुनी गई सेवा',
    priorityLabel: 'कितना ज़रूरी',
    dateLabel: 'पसंदीदा तारीख़',
    timeLabel: 'पसंदीदा समय',
    photosLabel: 'फ़ोटो',
    photoCountOne: '1 फ़ोटो जुड़ी है',
    photoCountMany: 'फ़ोटो जुड़ी हैं',
    photoAlt: 'इस रिक्वेस्ट के साथ जुड़ी फ़ोटो',
    photoUnavailable: 'को दिखाया नहीं जा सका',
    notesLabel: 'नोट्स',
    extrasEmpty: 'कोई नोट्स या फ़ोटो नहीं जोड़े गए।',

    addressLabel: 'सेवा का पता',

    vendorLabel: 'प्रोफ़ेशनल',
    vendorOpen: 'कोई भी उपलब्ध प्रोफ़ेशनल',
    vendorUnknown: 'आपके चुने हुए प्रोफ़ेशनल',
    vendorCheckFailed:
      'भेजने से पहले हमें यह जाँचना होगा कि आपके चुने हुए प्रोफ़ेशनल अभी भी उपलब्ध हैं। फिर से कोशिश करें, या प्रोफ़ेशनल बदलें।',

    assurance: 'जब तक कोई प्रोफ़ेशनल इसे स्वीकार नहीं करते, आप इसे रद्द कर सकते हैं।',

    submit: 'रिक्वेस्ट सबमिट करें',
    submitHint: 'आपकी रिक्वेस्ट भेजता है',
  },

  requestSubmitted: {
    title: 'रिक्वेस्ट भेज दी गई',
    subtitle: 'जब कोई प्रोफ़ेशनल इसे लेंगे, हम आपको नोटिफ़िकेशन में बताएँगे।',

    announcement: 'आपकी रिक्वेस्ट भेज दी गई है।',

    referenceLabel: 'रेफ़रेंस',
    referenceHint: 'इस रिक्वेस्ट के लिए आपका रेफ़रेंस। यह "मेरी रिक्वेस्ट" में भी दिखता है।',
    copyReference: (reference: string) => `रेफ़रेंस ${reference} कॉपी करें`,
    copied: 'कॉपी हो गया',
    copyHint: 'रेफ़रेंस को क्लिपबोर्ड पर कॉपी करता है',
    copyFailed: 'हम इसे कॉपी नहीं कर सके। आप इसे लिखकर रख सकते हैं।',

    serviceLabel: 'सेवा',
    addressLabel: 'सेवा का पता',

    dispatchDirected: 'इन्हें भेजी गई:',
    dispatchOpen: 'उपलब्ध प्रोफ़ेशनलों के लिए खुली है',
    dispatchDirectedUnknown: 'आपके चुने हुए प्रोफ़ेशनल को भेजी गई',

    nextTitle: 'आगे क्या होगा',
    nextMessage:
      'आप इसे "मेरी रिक्वेस्ट" में देख सकते हैं, और जब तक कोई प्रोफ़ेशनल इसे स्वीकार नहीं करते, वहीं से इसे रद्द भी कर सकते हैं।',

    viewRequest: 'रिक्वेस्ट देखें',
    viewRequestHint: 'इस रिक्वेस्ट की जानकारी खोलता है',

    home: 'होम पर वापस जाएँ',
    homeHint: 'होम स्क्रीन पर वापस ले जाता है',
  },

  requestDetails: {
    title: 'आपकी रिक्वेस्ट',

    back: 'वापस',
    backHint: 'पिछली स्क्रीन पर वापस ले जाता है',

    loadingLabel: 'आपकी रिक्वेस्ट लोड हो रही है',

    statusLabel: 'मौजूदा स्थिति',
    sentLabel: 'भेजी गई',

    sectionVendor: 'प्रोफ़ेशनल',
    requestedLabel: 'आपकी पसंद',
    assignedLabel: 'असाइन किया गया',

    notFoundTitle: 'हमें यह रिक्वेस्ट नहीं मिली',
    notFoundMessage: 'रेफ़रेंस पुराना हो सकता है। आपकी हाल की रिक्वेस्ट होम स्क्रीन पर हैं।',

    home: 'होम पर वापस जाएँ',
    homeHint: 'होम स्क्रीन पर वापस ले जाता है',
  },

  cancelRequest: {
    action: 'रिक्वेस्ट रद्द करें',
    actionHint: 'इस रिक्वेस्ट को रद्द करने से पहले पूछता है',

    confirmTitle: 'यह रिक्वेस्ट रद्द करें?',
    confirmMessage: 'प्रोफ़ेशनल इसे अब नहीं देख पाएँगे। यह बदलाव वापस नहीं लिया जा सकता।',
    keep: 'रिक्वेस्ट रखें',
    keepHint: 'इसे बंद करता है और आपकी रिक्वेस्ट को जैसी है वैसी ही रहने देता है',
    confirm: 'रिक्वेस्ट रद्द करें',
    confirmHint: 'इस रिक्वेस्ट को रद्द करता है',

    cancelled: 'रिक्वेस्ट रद्द कर दी गई।',
    refused: 'एक प्रोफ़ेशनल यह रिक्वेस्ट पहले ही स्वीकार कर चुके हैं, इसलिए इसे यहाँ रद्द नहीं किया जा सकता।',
    failed: 'आपकी रिक्वेस्ट रद्द नहीं हुई।',
  },

  payment: {
    section: 'भुगतान',
    amountLabel: 'अंतिम राशि',
    statusLabel: 'भुगतान की स्थिति',
    recorded: 'यह आपके प्रोफ़ेशनल ने दर्ज किया है। Fixora भुगतान प्रोसेस नहीं करता।',
  },

  requestStatus: {
    submitted: {
      label: 'सबमिट हुई',
      title: 'रिक्वेस्ट सबमिट हुई',
      description: 'आपकी रिक्वेस्ट मिल गई है।',
    },
    searching: {
      label: 'खोज जारी',
      title: 'प्रोफ़ेशनल की खोज जारी',
      description: 'हम आपकी रिक्वेस्ट के लिए एक उपलब्ध प्रोफ़ेशनल ढूँढ रहे हैं।',
    },
    awaiting_vendor: {
      label: 'जवाब का इंतज़ार',
      title: 'प्रोफ़ेशनल के जवाब का इंतज़ार',
      description: 'आपकी रिक्वेस्ट आपके चुने हुए प्रोफ़ेशनल के जवाब का इंतज़ार कर रही है।',
    },
    awaiting_professional: {
      label: 'प्रोफ़ेशनल का इंतज़ार',
      title: 'प्रोफ़ेशनल का इंतज़ार',
      description: 'आपकी रिक्वेस्ट इंतज़ार कर रही है कि कोई प्रोफ़ेशनल इसे ले।',
    },
    assigned: {
      label: 'असाइन हुई',
      title: 'प्रोफ़ेशनल असाइन किया गया',
      description: 'आपकी रिक्वेस्ट एक प्रोफ़ेशनल को असाइन कर दी गई है।',
    },
    in_progress: {
      label: 'काम जारी',
      title: 'सेवा का काम जारी',
      description: 'आपकी सेवा का काम चल रहा है।',
    },
    completed: {
      label: 'पूरी हुई',
      title: 'सेवा पूरी हुई',
      description: 'यह रिक्वेस्ट पूरी हो गई है।',
    },
    cancelled: {
      label: 'रद्द',
      title: 'रिक्वेस्ट रद्द हुई',
      description: 'यह रिक्वेस्ट रद्द कर दी गई है।',
    },
    rejected: {
      label: 'स्वीकार नहीं हुई',
      title: 'रिक्वेस्ट स्वीकार नहीं हुई',
      description: 'यह रिक्वेस्ट स्वीकार नहीं की गई।',
    },
    on_hold: {
      label: 'होल्ड पर',
      title: 'रिक्वेस्ट होल्ड पर है',
      description: 'यह रिक्वेस्ट फ़िलहाल होल्ड पर है।',
    },
    unknown: {
      label: 'स्थिति उपलब्ध नहीं',
      title: 'रिक्वेस्ट की स्थिति उपलब्ध नहीं',
      description: 'हम अभी ताज़ा स्थिति नहीं दिखा पा रहे हैं।',
    },

    summaryPrefix: 'रिक्वेस्ट की स्थिति',
    stepComplete: '— यह चरण पूरा हो गया',
    stepCurrent: '— यह चरण अभी चल रहा है',
  },

  myRequests: {
    title: 'मेरी रिक्वेस्ट',
    subtitle: 'आपकी भेजी हुई सभी रिक्वेस्ट, सबसे नई पहले।',

    loadingLabel: 'आपकी रिक्वेस्ट लोड हो रही हैं',
    loadingMoreLabel: 'और रिक्वेस्ट लोड हो रही हैं',

    filtersLabel: 'रिक्वेस्ट दिखाएँ',
    filterAll: 'सभी',
    filterActive: 'चालू',
    filterCompleted: 'पूरी हुई',
    filterCancelled: 'रद्द',
    filterHint: 'सिर्फ़ ये रिक्वेस्ट दिखाता है',

    showMore: 'और रिक्वेस्ट दिखाएँ',
    showMoreHint: 'सूची में अगली रिक्वेस्ट लोड करता है',

    emptyActiveTitle: 'कोई चालू रिक्वेस्ट नहीं',
    emptyActiveMessage: 'जिन रिक्वेस्ट पर अभी काम चल रहा है, वे यहाँ दिखेंगी।',
    emptyCompletedTitle: 'कोई पूरी हुई रिक्वेस्ट नहीं',
    emptyCompletedMessage: 'जो रिक्वेस्ट पूरी हो चुकी हैं, वे यहाँ दिखेंगी।',
    emptyCancelledTitle: 'कोई रद्द रिक्वेस्ट नहीं',
    emptyCancelledMessage: 'जो रिक्वेस्ट रद्द की गई हैं, वे यहाँ दिखेंगी।',

    moreFailedTitle: 'हम और रिक्वेस्ट लोड नहीं कर सके',
  },

  review: {
    title: 'अपना अनुभव रेट करें',
    subtitle: 'हमें बताएँ कि इस रिक्वेस्ट का काम कैसा रहा।',

    back: 'वापस',
    backHint: 'आपकी रिक्वेस्ट पर वापस ले जाता है',

    loadingLabel: 'इस रिक्वेस्ट का रिव्यू लोड हो रहा है',

    requestLabel: 'रिक्वेस्ट',
    vendorPrefix: 'प्रोफ़ेशनल:',

    ratingTitle: 'आपकी रेटिंग',
    ratingSupport: '1 से 5 स्टार में से चुनें।',
    ratingLabel: RATING_COPY_HI.label,
    ratingValue: RATING_COPY_HI.value,
    ratingNone: RATING_COPY_HI.none,
    ratingHint: RATING_COPY_HI.hint,
    ratingRequired: '1 से 5 स्टार के बीच रेटिंग चुनें।',

    commentTitle: 'कमेंट',
    commentLabel: 'क्या आप कुछ और जोड़ना चाहेंगे?',
    commentPlaceholder: 'काम अच्छे से हुआ और समस्या ठीक हो गई।',
    commentSupport: 'वैकल्पिक।',
    commentTooLong: 'कृपया इसे {count} अक्षरों या उससे कम में लिखें।',

    submit: 'रिव्यू सबमिट करें',
    submitHint:
      'इस रिक्वेस्ट के लिए आपकी रेटिंग भेजता है। एक रिक्वेस्ट का रिव्यू एक ही बार किया जा सकता है।',

    yourReviewTitle: 'आपका रिव्यू',
    submittedLabel: 'भेजा गया',
    commentLabelReadOnly: 'कमेंट',
    successTitle: 'रिव्यू सबमिट हो गया',
    successMessage:
      'धन्यवाद। आपका रिव्यू इस रिक्वेस्ट के साथ सेव हो गया है और इसे बदला नहीं जा सकता।',

    unavailableTitle: 'इस रिक्वेस्ट का अभी रिव्यू नहीं किया जा सकता',
    unavailableMessage: 'काम पूरा होने के बाद आप रिक्वेस्ट को रेट कर सकते हैं।',

    notFoundTitle: 'हमें यह रिक्वेस्ट नहीं मिली',
    notFoundMessage: 'रेफ़रेंस पुराना हो सकता है।',

    backToRequest: 'रिक्वेस्ट पर वापस जाएँ',
    backToRequestHint: 'इस रिक्वेस्ट की जानकारी पर वापस ले जाता है',

    detailsPrompt: 'इस रिक्वेस्ट का काम पूरा हो गया है। हमें बताएँ कि यह कैसा रहा।',
    detailsAction: 'अपना अनुभव रेट करें',
    detailsActionHint: 'इस रिक्वेस्ट का रिव्यू खोलता है',
    detailsFailedTitle: 'हम आपका रिव्यू जाँच नहीं सके',
  },

  profile: {
    title: 'प्रोफ़ाइल',

    contactTitle: 'संपर्क जानकारी',
    phoneLabel: 'फ़ोन',
    emailLabel: 'ईमेल',

    logout: 'लॉग आउट',
    logoutHint: 'इस डिवाइस पर Fixora से साइन आउट करने से पहले पूछता है',

    logoutConfirmTitle: 'लॉग आउट करें?',
    logoutConfirmMessage: 'अपने अकाउंट में जाने के लिए आपको फिर से साइन इन करना होगा।',
    logoutCancel: 'रद्द करें',
    logoutCancelHint: 'आपको साइन इन रखता है',
    logoutConfirm: 'लॉग आउट',
    logoutConfirmHint: 'आपको अभी साइन आउट करता है',

    logoutFailedTitle: 'हम आपको लॉग आउट नहीं कर सके',

    addresses: 'पते मैनेज करें',
    addressesHint: 'आपके सेव किए हुए पते खोलता है',

    edit: 'प्रोफ़ाइल बदलें',
    editHint: 'आपके नाम और ईमेल के लिए फ़ॉर्म खोलता है',

    photoTitle: 'प्रोफ़ाइल फ़ोटो',
    photoCamera: 'फ़ोटो लें',
    photoGallery: 'फ़ोटो चुनें',
    photoRemove: 'फ़ोटो हटाएँ',
    photoRemoveHint: 'आपके अकाउंट से फ़ोटो हटाता है',
    photoUploading: 'आपकी फ़ोटो सेव हो रही है…',
    photoProgress: (percent: number) => `अपलोड हो रहा है… ${percent}%`,
    photoFailedTitle: 'हम आपकी फ़ोटो सेव नहीं कर सके',
    photoRetry: 'फिर से कोशिश करें',
    photoDiscard: 'छोड़ें',
    photoDiscardHint: 'आपकी चुनी हुई फ़ोटो छोड़ देता है',
  },

  editProfile: {
    title: 'प्रोफ़ाइल बदलें',
    subtitle: 'बदलें कि आपकी रिक्वेस्ट पर आपका नाम और ईमेल कैसे दिखें।',

    firstNameLabel: 'पहला नाम',
    firstNamePlaceholder: 'आपका पहला नाम',
    lastNameLabel: 'सरनेम',
    lastNamePlaceholder: 'वैकल्पिक',
    emailLabel: 'ईमेल',
    emailPlaceholder: 'वैकल्पिक',
    emailHelp: 'हम इसका इस्तेमाल रसीदों और अपडेट के लिए करते हैं। इसे हटाने के लिए खाली छोड़ दें।',

    phoneLabel: 'फ़ोन',
    phoneHelp: 'आप इसी नंबर से साइन इन करते हैं, इसलिए इसे यहाँ नहीं बदला जा सकता।',

    save: 'सेव करें',
    saveHint: 'आपकी जानकारी सेव करता है और आपकी प्रोफ़ाइल पर वापस ले जाता है',
    saving: 'सेव हो रहा है…',
    saveFailedTitle: 'हम आपकी प्रोफ़ाइल सेव नहीं कर सके',

    firstNameRequired: 'पहला नाम ज़रूरी है।',
    nameTooLong: 'कृपया इसे {count} अक्षरों या उससे कम में लिखें।',

    discardTitle: 'बदलाव छोड़ें?',
    discardMessage: 'आपके बदलाव अभी सेव नहीं हुए हैं।',
    discardKeep: 'बदलाव जारी रखें',
    discardKeepHint: 'फ़ॉर्म पर वापस ले जाता है',
    discardConfirm: 'छोड़ें',
    discardConfirmHint: 'सेव किए बिना बाहर निकलता है',
  },

  addressBook: {
    title: 'सेव किए हुए पते',
    subtitle: 'ये पते आप अगली बार सेवा की रिक्वेस्ट करते समय फिर से इस्तेमाल कर सकते हैं।',

    defaultBadge: 'डिफ़ॉल्ट',
    defaultSpoken: 'डिफ़ॉल्ट पता',

    add: 'पता जोड़ें',
    addHint: 'आपके अकाउंट में नया पता सेव करता है',
    edit: 'बदलें',
    editHint: 'बदलें',
    remove: 'हटाएँ',
    removeHint: 'हटाएँ',
    setDefault: 'डिफ़ॉल्ट बनाएँ',
    setDefaultHint: 'इस पते को डिफ़ॉल्ट बनाता है',

    emptyTitle: 'अभी कोई सेव किया हुआ पता नहीं',
    emptyMessage: 'यहाँ पता सेव करें, ताकि अगली बार सेवा की रिक्वेस्ट करते समय यह तैयार रहे।',

    loading: 'आपके पते लोड हो रहे हैं',
    failedTitle: 'हम आपके पते लोड नहीं कर सके',
    searchFailedTitle: 'हम पते नहीं खोज सके',
    changeFailedTitle: 'हम यह बदलाव सेव नहीं कर सके',

    removeTitle: 'यह पता हटाएँ?',
    removeMessage: 'यह पता हटा दिया जाएगा:',
    removeCancel: 'रद्द करें',
    removeCancelHint: 'पते को रहने देता है',
    removeConfirm: 'हटाएँ',
    removeConfirmHint: 'पता अभी हटाता है',

    addTitle: 'पता जोड़ें',
    addSubtitle: 'वह पता खोजें जिसे आप सेव करना चाहते हैं।',
    editTitle: 'पता बदलें',
    editSubtitle: 'बदलें कि यह पता कहाँ का है।',

    save: 'सेव करें',
    saveHint: 'यह पता सेव करता है और आपके पतों पर वापस ले जाता है',
    saving: 'सेव हो रहा है…',
    saveFailedTitle: 'हम यह पता सेव नहीं कर सके',

    discardTitle: 'बदलाव छोड़ें?',
    discardMessage: 'यह पता अभी सेव नहीं हुआ है।',
    discardKeep: 'बदलाव जारी रखें',
    discardKeepHint: 'फ़ॉर्म पर वापस ले जाता है',
    discardConfirm: 'छोड़ें',
    discardConfirmHint: 'सेव किए बिना बाहर निकलता है',
  },

  request: {
    vendorPending: 'अभी कोई वेंडर असाइन नहीं हुआ',

    referencePrefix: 'रेफ़.',

    statusLabel: 'स्थिति',
    priorityLabel: 'प्राथमिकता',

    openHint: 'इस रिक्वेस्ट की जानकारी खोलता है',
  },
};
