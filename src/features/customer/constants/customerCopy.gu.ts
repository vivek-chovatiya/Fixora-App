/**
 * Customer copy — Gujarati. Translates `CUSTOMER_COPY_EN` in `customerCopy.ts`;
 * a key left out reads in English.
 *
 * Polite "તમે", everyday Gujarati, and the loanwords people already use in apps
 * (રિક્વેસ્ટ, પ્રોફેશનલ, કેટેગરી, ફોટો, સેવ, લોડ). "રિક્વેસ્ટ" is feminine
 * throughout ("મોકલાઈ ગઈ", "રદ થઈ"), to match the error sentence in
 * `shared/types/error.gu.ts` that `cancelRequest.refused` repeats word for word.
 * Placeholders (`{service}`, `{category}`, `{count}`) stay as they are; the
 * rating words come from `rating.gu.ts`, never written here a second time.
 *
 * ⚠️ Some values are fragments the code joins in a fixed order, so they are
 * worded for that order, not as sentences: `requestStatus.stepComplete` /
 * `stepCurrent` follow a step title (hence the leading comma),
 * `review.vendorPrefix` and `requestSubmitted.dispatchDirected` come before a
 * name (hence the colon), `addressBook.removeMessage` before an address,
 * `confirmation.photoCountMany` / `photoUnavailable` after a number, and
 * `createRequest.otherDraftSameCategory` / `home.resumeFallbackService` are
 * dropped into `{service}`. Change one only after reading where it is joined.
 *
 * ⚠️ The same honesty as the English: a preference is "બુકિંગ તરીકે નહીં",
 * Fixora "ચુકવણી પ્રોસેસ કરતું નથી", a cancel "પાછું ફેરવી શકાશે નહીં". Nothing here
 * may promise a visit, a call or a notified professional the app cannot see.
 */

import type { LocaleTable } from '@/core/i18n';
import type { CUSTOMER_COPY_EN } from '@/features/customer/constants/customerCopy';
import { RATING_COPY_GU } from '@/shared/presentation/rating.gu';

export const CUSTOMER_COPY_GU: LocaleTable<typeof CUSTOMER_COPY_EN> = {
  home: {
    greetingMorning: 'સુપ્રભાત',
    greetingAfternoon: 'શુભ બપોર',
    greetingEvening: 'શુભ સાંજ',

    greetingFallbackName: 'મિત્ર',

    prompt: 'તમારે કઈ સેવા જોઈએ છે?',
    promptSupport: 'એક કેટેગરી પસંદ કરો, અને અમે તમારી નજીકના પ્રોફેશનલ શોધીશું.',

    primaryAction: 'સેવાની રિક્વેસ્ટ કરો',
    primaryActionHint: 'સેવા કેટેગરીની યાદી ખોલે છે',

    categoriesTitle: 'સેવા કેટેગરી',
    categoriesAction: 'બધી જુઓ',
    categoriesActionHint: 'સેવા કેટેગરીની પૂરી યાદી ખોલે છે',
    categoriesEmptyTitle: 'હજી કોઈ સેવા ઉપલબ્ધ નથી',
    categoriesEmptyMessage: 'તમારા વિસ્તારમાં સેવાઓ ઉપલબ્ધ થતાં જ અહીં દેખાશે.',
    categoriesLoadingLabel: 'સેવા કેટેગરી લોડ થઈ રહી છે',

    recentTitle: 'તાજેતરની રિક્વેસ્ટ',
    recentLoadingLabel: 'તાજેતરની રિક્વેસ્ટ લોડ થઈ રહી છે',

    recentEmptyTitle: 'તમારી પાસે હજી કોઈ સેવા રિક્વેસ્ટ નથી.',
    recentEmptyMessage: 'તમારી રિક્વેસ્ટ અહીં દેખાશે, જેથી તમે એક નજરમાં તેની સ્થિતિ જોઈ શકો.',

    screenLabel: 'હોમ',

    staleTitle: 'રિફ્રેશ થઈ શક્યું નહીં',
    staleMessage: 'અહીં દેખાતી માહિતી કદાચ જૂની હોય.',
    staleRetry: 'ફરી પ્રયાસ કરો',
    staleRetryHint: 'તમારી સેવાઓ અને રિક્વેસ્ટ ફરી લોડ કરે છે',

    resumeTitle: 'તમારી રિક્વેસ્ટ ચાલુ રાખો',
    resumeMessage: 'જ્યાં છોડ્યું હતું ત્યાંથી આગળ વધો.',
    resumeAction: 'આગળ વધો',
    resumeHint: 'તમે શરૂ કરેલી રિક્વેસ્ટ ફરી ખોલે છે',
    resumeFallbackService: 'કોઈ સેવા',
  },

  categories: {
    title: 'બધી કેટેગરી',
    subtitle: 'તમને કેવી મદદ જોઈએ છે તે પસંદ કરો, આગળનું અમે સંભાળીશું.',

    itemHint: 'આ કેટેગરીની સેવાઓ બતાવે છે',

    emptyTitle: 'હજી કોઈ સેવા ઉપલબ્ધ નથી',
    emptyMessage:
      'તમારા વિસ્તારમાં સેવાઓ ઉપલબ્ધ થતાં જ અહીં દેખાશે. થોડા સમય પછી ફરી જોજો.',

    back: 'પાછા',
    backHint: 'પાછલી સ્ક્રીન પર લઈ જાય છે',

    loadingLabel: 'કેટેગરી લોડ થઈ રહી છે',

    staleTitle: 'રિફ્રેશ થઈ શક્યું નહીં',
    staleMessage: 'આ કેટેગરીની માહિતી કદાચ જૂની હોય.',
    staleRetry: 'ફરી પ્રયાસ કરો',
    staleRetryHint: 'કેટેગરી ફરી લોડ કરે છે',
  },

  subCategories: {
    fallbackTitle: 'સેવા પસંદ કરો',
    subtitle: 'તમારે જે કામ કરાવવું છે તે પસંદ કરો, પછી અમે વિગતો લઈશું.',

    itemHint: 'આ સેવા માટે રિક્વેસ્ટ શરૂ કરે છે',

    emptyTitle: 'અહીં હજી કંઈ ઉપલબ્ધ નથી',
    emptyMessage:
      'આ કેટેગરીમાં અત્યારે કોઈ સેવા ઉપલબ્ધ નથી. બીજી કેટેગરી અજમાવો, અથવા થોડા સમય પછી ફરી જોજો.',

    back: 'પાછા',
    backHint: 'પાછલી સ્ક્રીન પર લઈ જાય છે',

    loadingLabel: 'સેવાઓ લોડ થઈ રહી છે',
  },

  createRequest: {
    title: 'રિક્વેસ્ટની વિગતો',
    subtitle: 'શું કામ કરાવવું છે તે જણાવો. અમે તે એક પ્રોફેશનલ સુધી પહોંચાડીશું.',

    back: 'પાછા',
    backHint: 'સેવાઓની યાદી પર પાછા લઈ જાય છે',

    serviceTitle: 'સેવા',
    serviceFallback: 'પસંદ કરેલી સેવા',
    serviceUnavailable:
      'અમે સેવાનું નામ લોડ કરી શક્યા નહીં, પણ તમારી રિક્વેસ્ટ યોગ્ય લોકો સુધી પહોંચશે.',

    otherDraftNotice: '{service} માટેની તમારી એક રિક્વેસ્ટ અધૂરી છે.',
    otherDraftSameCategory: 'બીજી {category} સેવા',
    otherDraftConsequence:
      'આ રિક્વેસ્ટ ત્યારે જ સચવાશે જ્યારે તમે "આગળ વધો" દબાવશો, અને પછી તે પેલી રિક્વેસ્ટની જગ્યા લેશે.',

    priorityTitle: 'આ કેટલું જરૂરી છે?',
    prioritySupport: 'આનાથી અમને ખબર પડે છે કે કોઈને કેટલું જલદી શોધવું.',

    dateTitle: 'પસંદગીની તારીખ',
    timeTitle: 'પસંદગીનો સમય',
    scheduleSupport: 'વૈકલ્પિક. તમારી રિક્વેસ્ટ સાથે પસંદગી તરીકે મોકલાય છે, બુકિંગ તરીકે નહીં.',
    anyDate: 'કોઈ પસંદગી નથી',
    anyTime: 'કોઈ પસંદગી નથી',
    today: 'આજે',
    tomorrow: 'આવતીકાલે',
    dateHint: 'તમને અનુકૂળ દિવસ સેટ કરે છે',
    timeHint: 'તમને અનુકૂળ સમય સેટ કરે છે',

    photosTitle: 'ફોટા',
    photosSupport: 'વૈકલ્પિક. ઘણી વાર ફોટો શબ્દો કરતાં સમસ્યા વધુ સારી રીતે બતાવે છે.',
    photosCamera: 'કૅમેરા',
    photosGallery: 'ગૅલેરી',
    photosCameraHint: 'સમસ્યાનો ફોટો લેવા માટે કૅમેરા ખોલે છે',
    photosGalleryHint: 'તમારી ફોટો ગૅલેરી ખોલે છે',
    photoRemove: 'ફોટો કાઢી નાખો',
    photoRetry: 'ફરી અપલોડ કરો',
    photoUploading: 'અપલોડ થઈ રહ્યો છે',
    photoFailed: 'અપલોડ નિષ્ફળ',
    photoUploaded: 'અપલોડ થઈ ગયો',
    photosLimitReached: 'તમે વધુમાં વધુ {count} ફોટા ઉમેરી શકો છો.',
    cameraUnavailable:
      'અમે કૅમેરા ખોલી શક્યા નહીં. તેના બદલે તમે ગૅલેરીમાંથી ફોટો પસંદ કરી શકો છો.',
    photosBusy: 'તમારા ફોટા હજી અપલોડ થઈ રહ્યા છે.',
    photosUnresolved:
      'કેટલાક ફોટા અપલોડ થયા નથી. સબમિટ કરતાં પહેલાં તેને ફરી અપલોડ કરો અથવા કાઢી નાખો.',

    notesTitle: 'નોંધ',
    notesLabel: 'બીજું કંઈ જણાવવું છે?',
    notesPlaceholder: 'પંખો અવાજ કરે છે અને દસ મિનિટ પછી બંધ થઈ જાય છે.',
    notesSupport: 'વૈકલ્પિક.',

    priorityRequired: 'આ કેટલું જરૂરી છે તે પસંદ કરો.',
    dateInvalid: 'યાદીમાંથી તારીખ પસંદ કરો.',
    timeInvalid: 'યાદીમાંથી સમય પસંદ કરો.',
    notesTooLong: 'કૃપા કરીને આ {count} અક્ષરો કે તેથી ઓછામાં લખો.',

    submit: 'આગળ વધો',
    submitHint: 'પ્રોફેશનલ પસંદ કરવા આગળ લઈ જાય છે',

    loadingLabel: 'સેવાની વિગતો લોડ થઈ રહી છે',
  },

  serviceAddress: {
    title: 'અમે ક્યાં આવીએ?',
    subtitle: 'તમારા સુધી પહોંચવા માટે પ્રોફેશનલને સરનામું જોઈએ.',

    back: 'પાછા',
    backHint: 'રિક્વેસ્ટની વિગતો પર પાછા લઈ જાય છે',

    searchLabel: 'સેવાનું સરનામું',
    searchPlaceholder: 'શેરી, વિસ્તાર કે લૅન્ડમાર્ક',
    searchHint: 'ટાઇપ કરશો તેમ મળતાં સરનામાં બતાવે છે',

    useCurrentLocation: 'મારું હાલનું લોકેશન વાપરો',
    useCurrentLocationHint: 'તમારા ડિવાઇસના લોકેશન પરથી તમારું સરનામું શોધે છે',
    locating: 'તમારું લોકેશન શોધી રહ્યા છીએ',

    useSaved: 'સેવ કરેલું સરનામું વાપરો',
    useSavedHint: 'આ ભરવા માટે તમારાં સેવ કરેલાં સરનામાંમાંથી એક પસંદ કરવા દે છે',

    suggestionsLabel: 'મળતાં સરનામાં',
    suggestionHint: 'આને તમારા સેવાના સરનામા તરીકે પસંદ કરે છે',

    emptyTitle: 'સરનામું ટાઇપ કરવાનું શરૂ કરો',
    emptyMessage: 'અથવા ટાઇપ ન કરવું હોય તો તમારું હાલનું લોકેશન વાપરો.',

    noResultsTitle: 'કોઈ મળતું સરનામું નથી',
    noResultsMessage: 'અમને તે મળ્યું નહીં. તમે જે ટાઇપ કર્યું છે તે જ વાપરી શકો છો.',
    useTyped: 'મેં ટાઇપ કર્યું તે વાપરો',
    useTypedHint: 'તમે લખેલા લખાણને તમારા સેવાના સરનામા તરીકે સેટ કરે છે',

    searchErrorFallback:
      'અત્યારે સરનામું શોધવાની સુવિધા ઉપલબ્ધ નથી. તમે હજી પણ તમારું સરનામું ટાઇપ કરી શકો છો.',

    selectedLabel: 'સેવાનું સરનામું',
    change: 'બદલો',
    changeHint: 'આ સરનામું હટાવે છે જેથી તમે બીજું પસંદ કરી શકો',

    required: 'આગળ વધવા માટે સેવાનું સરનામું ઉમેરો.',
    tooShort: 'આ થોડું ટૂંકું લાગે છે. કોઈ તમને શોધી શકે એટલી વિગત ઉમેરો.',

    submit: 'આગળ વધો',
    submitHint: 'આ સરનામું સેવ કરે છે અને પ્રોફેશનલ પસંદ કરવા આગળ લઈ જાય છે',
  },

  chooseSavedAddress: {
    title: 'સેવ કરેલું સરનામું પસંદ કરો',
    subtitle: 'તે તમારું સેવાનું સરનામું ભરી દેશે. આગળ વધતાં પહેલાં તમે તેને હજી બદલી શકો છો.',

    back: 'પાછા',
    backHint: 'સેવાના સરનામા પર પાછા લઈ જાય છે',

    optionHint: 'આને તમારા સેવાના સરનામા તરીકે વાપરે છે',

    loadingLabel: 'તમારાં સેવ કરેલાં સરનામાં લોડ થઈ રહ્યાં છે',

    failedTitle: 'અમે તમારાં સેવ કરેલાં સરનામાં લોડ કરી શક્યા નહીં',
    emptyTitle: 'કોઈ સેવ કરેલું સરનામું નથી',
    emptyMessage: 'તમારું સરનામું ટાઇપ કરવા પાછા જાઓ, અથવા તમારું હાલનું લોકેશન વાપરો.',
  },

  location: {
    denied: 'લોકેશન ઍક્સેસ ઉપલબ્ધ નથી. તેના બદલે તમે તમારું સેવાનું સરનામું લખી શકો છો.',
    openSettings: 'સેટિંગ્સ ખોલો',
    openSettingsHint: 'સિસ્ટમ સેટિંગ્સમાં આ ઍપ ખોલે છે, જ્યાં લોકેશન ઍક્સેસ બદલી શકાય છે',

    unavailable: 'અમે તમારું લોકેશન મેળવી શક્યા નહીં. કૃપા કરીને તેના બદલે તમારું સરનામું ટાઇપ કરો.',
    unresolved: 'તમારા લોકેશન પરથી અમે સરનામું શોધી શક્યા નહીં. કૃપા કરીને તેને ટાઇપ કરો.',

    confirmPrompt: 'શું આ સાચું છે? આગળ વધતાં પહેલાં તમે તેમાં ફેરફાર કરી શકો છો.',
  },

  preferredVendor: {
    title: 'પ્રોફેશનલ પસંદ કરો',
    subtitle:
      'કોઈ ચોક્કસ વ્યક્તિ પસંદ કરો, અથવા અમને ઉપલબ્ધ પ્રોફેશનલને તમારી રિક્વેસ્ટ વિશે જણાવવા દો.',

    back: 'પાછા',
    backHint: 'સેવાના સરનામા પર પાછા લઈ જાય છે',

    vendorHint: 'તમારી રિક્વેસ્ટ આ પ્રોફેશનલને મોકલે છે',

    ratingUnit: 'સ્ટાર',
    reviewsUnit: 'રિવ્યૂ',

    noPreferenceTitle: 'કોઈ પસંદગી નથી',
    noPreferenceMessage: 'અમે ઉપલબ્ધ પ્રોફેશનલને તમારી રિક્વેસ્ટ વિશે જણાવીશું.',
    noPreferenceHint: 'તમારી રિક્વેસ્ટ કોઈ પણ ઉપલબ્ધ પ્રોફેશનલને મોકલે છે',

    chooseFirst: 'પ્રોફેશનલ પસંદ કરો, અથવા "કોઈ પસંદગી નથી" પસંદ કરો.',

    emptyTitle: 'અત્યારે યાદીમાં કોઈ પ્રોફેશનલ નથી',
    emptyMessage:
      'પ્રોફેશનલ ઉપલબ્ધ થતાં જ અમે તેમને તમારી રિક્વેસ્ટ વિશે જણાવીશું. આગળ વધવા માટે "કોઈ પસંદગી નથી" પસંદ કરો.',

    errorFallback: 'તમે હજી પણ "કોઈ પસંદગી નથી" સાથે આગળ વધી શકો છો.',

    vendorUnavailable:
      'તમે પહેલાં પસંદ કરેલા પ્રોફેશનલ હવે આ સેવા માટે ઉપલબ્ધ નથી, તેથી તમે બીજા પસંદ કરી શકો છો અથવા "કોઈ પસંદગી નથી" સાથે આગળ વધી શકો છો.',

    submit: 'આગળ વધો',
    submitHint: 'તમારી રિક્વેસ્ટ તપાસવા આગળ લઈ જાય છે',

    loadingLabel: 'પ્રોફેશનલ લોડ થઈ રહ્યા છે',
  },

  confirmation: {
    title: 'તમારી રિક્વેસ્ટ તપાસો',
    subtitle: 'મોકલતાં પહેલાં એક છેલ્લી નજર. તમે પાછા જઈને કંઈ પણ બદલી શકો છો.',

    back: 'પાછા',
    backHint: 'પ્રોફેશનલ પસંદ કરવા પાછા લઈ જાય છે',

    sectionService: 'સેવા',
    sectionDetails: 'રિક્વેસ્ટની વિગતો',
    sectionExtras: 'વધારાની માહિતી',
    sectionLocation: 'સેવાનું સ્થળ',
    sectionVendor: 'પ્રોફેશનલની પસંદગી',

    edit: 'ફેરફાર કરો',
    editDetails: 'રિક્વેસ્ટની વિગતોમાં ફેરફાર કરો',
    editDetailsHint: 'કેટલું જરૂરી છે અને પસંદગીના સમય પર પાછા લઈ જાય છે',
    editExtras: 'નોંધ અને ફોટામાં ફેરફાર કરો',
    editExtrasHint: 'નોંધ અને ફોટા પર પાછા લઈ જાય છે',
    editVendor: 'પ્રોફેશનલ બદલો',
    editVendorHint: 'પ્રોફેશનલ પસંદ કરવા પાછા લઈ જાય છે',
    editAddress: 'સેવાના સરનામામાં ફેરફાર કરો',
    editAddressHint: 'કામ ક્યાં કરવાનું છે તે પસંદ કરવા પાછા લઈ જાય છે',

    serviceLabel: 'સેવા',
    categoryLabel: 'કેટેગરી',
    serviceFallback: 'પસંદ કરેલી સેવા',
    priorityLabel: 'કેટલું જરૂરી',
    dateLabel: 'પસંદગીની તારીખ',
    timeLabel: 'પસંદગીનો સમય',
    photosLabel: 'ફોટા',
    photoCountOne: '1 ફોટો જોડેલો છે',
    photoCountMany: 'ફોટા જોડેલા છે',
    photoAlt: 'આ રિક્વેસ્ટ સાથે જોડેલો ફોટો',
    photoUnavailable: 'બતાવી શકાયા નહીં',
    notesLabel: 'નોંધ',
    extrasEmpty: 'કોઈ નોંધ કે ફોટો ઉમેર્યા નથી.',

    addressLabel: 'સેવાનું સરનામું',

    vendorLabel: 'પ્રોફેશનલ',
    vendorOpen: 'કોઈ પણ ઉપલબ્ધ પ્રોફેશનલ',
    vendorUnknown: 'તમે પસંદ કરેલા પ્રોફેશનલ',
    vendorCheckFailed:
      'મોકલતાં પહેલાં અમારે તપાસવું પડશે કે તમે પસંદ કરેલા પ્રોફેશનલ હજી ઉપલબ્ધ છે. ફરી પ્રયાસ કરો, અથવા પ્રોફેશનલ બદલો.',

    assurance: 'કોઈ પ્રોફેશનલ સ્વીકારે ત્યાં સુધી તમે તેને રદ કરી શકો છો.',

    submit: 'રિક્વેસ્ટ સબમિટ કરો',
    submitHint: 'તમારી રિક્વેસ્ટ મોકલે છે',
  },

  requestSubmitted: {
    title: 'રિક્વેસ્ટ મોકલાઈ ગઈ',
    subtitle: 'કોઈ પ્રોફેશનલ તેને હાથમાં લેશે ત્યારે અમે તમને નોટિફિકેશનમાં જણાવીશું.',

    announcement: 'તમારી રિક્વેસ્ટ મોકલાઈ ગઈ છે.',

    referenceLabel: 'રેફરન્સ',
    referenceHint: 'આ રિક્વેસ્ટ માટેનો તમારો રેફરન્સ. તે "મારી રિક્વેસ્ટ"માં પણ દેખાય છે.',
    copyReference: (reference: string) => `રેફરન્સ ${reference} કૉપિ કરો`,
    copied: 'કૉપિ થઈ ગયું',
    copyHint: 'રેફરન્સ ક્લિપબોર્ડ પર કૉપિ કરે છે',
    copyFailed: 'અમે તેને કૉપિ કરી શક્યા નહીં. તેના બદલે તમે તેને લખી લઈ શકો છો.',

    serviceLabel: 'સેવા',
    addressLabel: 'સેવાનું સ્થળ',

    dispatchDirected: 'આ પ્રોફેશનલને મોકલી:',
    dispatchOpen: 'ઉપલબ્ધ પ્રોફેશનલ માટે ખુલ્લી છે',
    dispatchDirectedUnknown: 'તમે પસંદ કરેલા પ્રોફેશનલને મોકલી',

    nextTitle: 'હવે આગળ શું થશે',
    nextMessage:
      'તમે તેને "મારી રિક્વેસ્ટ"માં જોઈ શકો છો, અને કોઈ પ્રોફેશનલ સ્વીકારે ત્યાં સુધી ત્યાંથી રદ કરી શકો છો.',

    viewRequest: 'રિક્વેસ્ટ જુઓ',
    viewRequestHint: 'આ રિક્વેસ્ટની વિગતો ખોલે છે',

    home: 'હોમ પર પાછા',
    homeHint: 'હોમ સ્ક્રીન પર પાછા લઈ જાય છે',
  },

  requestDetails: {
    title: 'તમારી રિક્વેસ્ટ',

    back: 'પાછા',
    backHint: 'પાછલી સ્ક્રીન પર લઈ જાય છે',

    loadingLabel: 'તમારી રિક્વેસ્ટ લોડ થઈ રહી છે',

    statusLabel: 'હાલની સ્થિતિ',
    sentLabel: 'મોકલ્યાનો સમય',

    sectionVendor: 'પ્રોફેશનલ',
    requestedLabel: 'પસંદ કરેલા',
    assignedLabel: 'સોંપાયેલા',

    notFoundTitle: 'અમને આ રિક્વેસ્ટ મળી નહીં',
    notFoundMessage: 'રેફરન્સ કદાચ જૂનો હોય. તમારી તાજેતરની રિક્વેસ્ટ હોમ સ્ક્રીન પર છે.',

    home: 'હોમ પર પાછા',
    homeHint: 'હોમ સ્ક્રીન પર પાછા લઈ જાય છે',
  },

  cancelRequest: {
    action: 'રિક્વેસ્ટ રદ કરો',
    actionHint: 'આ રિક્વેસ્ટ રદ કરતાં પહેલાં પૂછે છે',

    confirmTitle: 'આ રિક્વેસ્ટ રદ કરવી છે?',
    confirmMessage: 'પ્રોફેશનલ તેને હવે જોઈ શકશે નહીં. આ પાછું ફેરવી શકાશે નહીં.',
    keep: 'રિક્વેસ્ટ રાખો',
    keepHint: 'આ બંધ કરે છે અને તમારી રિક્વેસ્ટ જેમ છે તેમ રાખે છે',
    confirm: 'રિક્વેસ્ટ રદ કરો',
    confirmHint: 'આ રિક્વેસ્ટ રદ કરે છે',

    cancelled: 'રિક્વેસ્ટ રદ થઈ ગઈ.',
    refused: 'એક પ્રોફેશનલે આ રિક્વેસ્ટ પહેલેથી સ્વીકારી લીધી છે, તેથી તેને અહીં રદ કરી શકાતી નથી.',
    failed: 'તમારી રિક્વેસ્ટ રદ થઈ નથી.',
  },

  payment: {
    section: 'ચુકવણી',
    amountLabel: 'અંતિમ રકમ',
    statusLabel: 'ચુકવણીની સ્થિતિ',
    recorded: 'તમારા પ્રોફેશનલે નોંધ્યું છે. Fixora ચુકવણી પ્રોસેસ કરતું નથી.',
  },

  requestStatus: {
    submitted: {
      label: 'સબમિટ થઈ',
      title: 'રિક્વેસ્ટ સબમિટ થઈ',
      description: 'તમારી રિક્વેસ્ટ મળી ગઈ છે.',
    },
    searching: {
      label: 'શોધ ચાલુ છે',
      title: 'પ્રોફેશનલની શોધ ચાલુ છે',
      description: 'અમે તમારી રિક્વેસ્ટ માટે ઉપલબ્ધ પ્રોફેશનલ શોધી રહ્યા છીએ.',
    },
    awaiting_vendor: {
      label: 'જવાબની રાહ',
      title: 'પ્રોફેશનલના જવાબની રાહ',
      description: 'તમારી રિક્વેસ્ટ તમે પસંદ કરેલા પ્રોફેશનલના જવાબની રાહ જોઈ રહી છે.',
    },
    awaiting_professional: {
      label: 'પ્રોફેશનલની રાહ',
      title: 'પ્રોફેશનલની રાહ જોવાઈ રહી છે',
      description: 'તમારી રિક્વેસ્ટ કોઈ પ્રોફેશનલ તેને હાથમાં લે તેની રાહ જોઈ રહી છે.',
    },
    assigned: {
      label: 'સોંપાઈ ગઈ',
      title: 'પ્રોફેશનલને કામ સોંપાયું',
      description: 'તમારી રિક્વેસ્ટ એક પ્રોફેશનલને સોંપવામાં આવી છે.',
    },
    in_progress: {
      label: 'ચાલુ છે',
      title: 'સેવા ચાલુ છે',
      description: 'તમારી સેવાનું કામ ચાલુ છે.',
    },
    completed: {
      label: 'પૂર્ણ',
      title: 'સેવા પૂર્ણ થઈ',
      description: 'આ રિક્વેસ્ટ પૂર્ણ થઈ ગઈ છે.',
    },
    cancelled: {
      label: 'રદ થઈ',
      title: 'રિક્વેસ્ટ રદ થઈ',
      description: 'આ રિક્વેસ્ટ રદ કરવામાં આવી છે.',
    },
    rejected: {
      label: 'સ્વીકારાઈ નથી',
      title: 'રિક્વેસ્ટ સ્વીકારાઈ નથી',
      description: 'આ રિક્વેસ્ટ સ્વીકારવામાં આવી નથી.',
    },
    on_hold: {
      label: 'હોલ્ડ પર',
      title: 'રિક્વેસ્ટ હોલ્ડ પર છે',
      description: 'આ રિક્વેસ્ટ હાલ પૂરતી હોલ્ડ પર છે.',
    },
    unknown: {
      label: 'સ્થિતિ ઉપલબ્ધ નથી',
      title: 'રિક્વેસ્ટની સ્થિતિ ઉપલબ્ધ નથી',
      description: 'અત્યારે અમે તાજેતરની સ્થિતિ બતાવી શકતા નથી.',
    },

    summaryPrefix: 'રિક્વેસ્ટની સ્થિતિ',
    stepComplete: ', આ પગલું પૂર્ણ થયું',
    stepCurrent: ', આ હાલનું પગલું છે',
  },

  myRequests: {
    title: 'મારી રિક્વેસ્ટ',
    subtitle: 'તમે મોકલેલી બધી રિક્વેસ્ટ, નવી સૌથી પહેલાં.',

    loadingLabel: 'તમારી રિક્વેસ્ટ લોડ થઈ રહી છે',
    loadingMoreLabel: 'વધુ રિક્વેસ્ટ લોડ થઈ રહી છે',

    filtersLabel: 'રિક્વેસ્ટ બતાવો',
    filterAll: 'બધી',
    filterActive: 'ચાલુ',
    filterCompleted: 'પૂર્ણ',
    filterCancelled: 'રદ થયેલી',
    filterHint: 'ફક્ત આ રિક્વેસ્ટ બતાવે છે',

    showMore: 'વધુ રિક્વેસ્ટ બતાવો',
    showMoreHint: 'યાદીમાંની આગળની રિક્વેસ્ટ લોડ કરે છે',

    emptyActiveTitle: 'કોઈ ચાલુ રિક્વેસ્ટ નથી',
    emptyActiveMessage: 'જે રિક્વેસ્ટ હજી ચાલી રહી છે તે અહીં દેખાશે.',
    emptyCompletedTitle: 'કોઈ પૂર્ણ થયેલી રિક્વેસ્ટ નથી',
    emptyCompletedMessage: 'પૂર્ણ થયેલી રિક્વેસ્ટ અહીં દેખાશે.',
    emptyCancelledTitle: 'કોઈ રદ થયેલી રિક્વેસ્ટ નથી',
    emptyCancelledMessage: 'રદ થયેલી રિક્વેસ્ટ અહીં દેખાશે.',

    moreFailedTitle: 'અમે વધુ રિક્વેસ્ટ લોડ કરી શક્યા નહીં',
  },

  review: {
    title: 'તમારા અનુભવને રેટિંગ આપો',
    subtitle: 'આ રિક્વેસ્ટનું કામ કેવું રહ્યું તે અમને જણાવો.',

    back: 'પાછા',
    backHint: 'તમારી રિક્વેસ્ટ પર પાછા લઈ જાય છે',

    loadingLabel: 'આ રિક્વેસ્ટનો રિવ્યૂ લોડ થઈ રહ્યો છે',

    requestLabel: 'રિક્વેસ્ટ',
    vendorPrefix: 'પ્રોફેશનલ:',

    ratingTitle: 'તમારું રેટિંગ',
    ratingSupport: '1 થી 5 સ્ટારમાંથી પસંદ કરો.',
    ratingLabel: RATING_COPY_GU.label,
    ratingValue: RATING_COPY_GU.value,
    ratingNone: RATING_COPY_GU.none,
    ratingHint: RATING_COPY_GU.hint,
    ratingRequired: '1 થી 5 સ્ટારમાંથી રેટિંગ પસંદ કરો.',

    commentTitle: 'કૉમેન્ટ',
    commentLabel: 'બીજું કંઈ ઉમેરવું છે?',
    commentPlaceholder: 'કામ સારી રીતે થયું અને સમસ્યા ઉકેલાઈ ગઈ છે.',
    commentSupport: 'વૈકલ્પિક.',
    commentTooLong: 'કૃપા કરીને આ {count} અક્ષરો કે તેથી ઓછામાં લખો.',

    submit: 'રિવ્યૂ સબમિટ કરો',
    submitHint:
      'આ રિક્વેસ્ટ માટે તમારું રેટિંગ મોકલે છે. એક રિક્વેસ્ટનો રિવ્યૂ એક જ વાર આપી શકાય છે.',

    yourReviewTitle: 'તમારો રિવ્યૂ',
    submittedLabel: 'મોકલ્યાનો સમય',
    commentLabelReadOnly: 'કૉમેન્ટ',
    successTitle: 'રિવ્યૂ સબમિટ થઈ ગયો',
    successMessage:
      'આભાર. તમારો રિવ્યૂ આ રિક્વેસ્ટ સાથે સેવ થઈ ગયો છે અને તેમાં ફેરફાર કરી શકાશે નહીં.',

    unavailableTitle: 'આ રિક્વેસ્ટનો હજી રિવ્યૂ આપી શકાતો નથી',
    unavailableMessage: 'રિક્વેસ્ટનું કામ પૂર્ણ થયા પછી તમે તેને રેટિંગ આપી શકો છો.',

    notFoundTitle: 'અમને આ રિક્વેસ્ટ મળી નહીં',
    notFoundMessage: 'રેફરન્સ કદાચ જૂનો હોય.',

    backToRequest: 'રિક્વેસ્ટ પર પાછા',
    backToRequestHint: 'આ રિક્વેસ્ટની વિગતો પર પાછા લઈ જાય છે',

    detailsPrompt: 'આ રિક્વેસ્ટનું કામ પૂર્ણ થયું છે. તે કેવું રહ્યું તે અમને જણાવો.',
    detailsAction: 'તમારા અનુભવને રેટિંગ આપો',
    detailsActionHint: 'આ રિક્વેસ્ટનો રિવ્યૂ ખોલે છે',
    detailsFailedTitle: 'અમે તમારો રિવ્યૂ તપાસી શક્યા નહીં',
  },

  profile: {
    title: 'પ્રોફાઇલ',

    contactTitle: 'સંપર્કની વિગતો',
    phoneLabel: 'ફોન',
    emailLabel: 'ઇમેઇલ',

    logout: 'લૉગ આઉટ',
    logoutHint: 'આ ડિવાઇસ પર Fixora માંથી સાઇન આઉટ કરતાં પહેલાં પૂછે છે',

    logoutConfirmTitle: 'લૉગ આઉટ કરવું છે?',
    logoutConfirmMessage: 'તમારા એકાઉન્ટમાં જવા માટે તમારે ફરી સાઇન ઇન કરવું પડશે.',
    logoutCancel: 'રદ કરો',
    logoutCancelHint: 'તમને સાઇન ઇન રાખે છે',
    logoutConfirm: 'લૉગ આઉટ',
    logoutConfirmHint: 'તમને હમણાં સાઇન આઉટ કરે છે',

    logoutFailedTitle: 'અમે તમને લૉગ આઉટ કરી શક્યા નહીં',

    addresses: 'સરનામાં મેનેજ કરો',
    addressesHint: 'તમે સેવ કરેલાં સરનામાં ખોલે છે',

    edit: 'પ્રોફાઇલમાં ફેરફાર કરો',
    editHint: 'તમારા નામ અને ઇમેઇલ માટેનું ફોર્મ ખોલે છે',

    photoTitle: 'પ્રોફાઇલ ફોટો',
    photoCamera: 'ફોટો લો',
    photoGallery: 'ફોટો પસંદ કરો',
    photoRemove: 'ફોટો કાઢી નાખો',
    photoRemoveHint: 'તમારા એકાઉન્ટમાંથી ફોટો કાઢી નાખે છે',
    photoUploading: 'તમારો ફોટો સેવ થઈ રહ્યો છે…',
    photoProgress: (percent: number) => `અપલોડ થઈ રહ્યું છે… ${percent}%`,
    photoFailedTitle: 'અમે તમારો ફોટો સેવ કરી શક્યા નહીં',
    photoRetry: 'ફરી પ્રયાસ કરો',
    photoDiscard: 'છોડી દો',
    photoDiscardHint: 'તમે પસંદ કરેલો ફોટો હટાવી દે છે',
  },

  editProfile: {
    title: 'પ્રોફાઇલમાં ફેરફાર કરો',
    subtitle: 'તમારી રિક્વેસ્ટ પર તમારું નામ અને ઇમેઇલ કેવી રીતે દેખાય તે બદલો.',

    firstNameLabel: 'પહેલું નામ',
    firstNamePlaceholder: 'તમારું પહેલું નામ',
    lastNameLabel: 'અટક',
    lastNamePlaceholder: 'વૈકલ્પિક',
    emailLabel: 'ઇમેઇલ',
    emailPlaceholder: 'વૈકલ્પિક',
    emailHelp: 'અમે આનો ઉપયોગ રસીદો અને અપડેટ્સ માટે કરીએ છીએ. તેને દૂર કરવા માટે ખાલી રાખો.',

    phoneLabel: 'ફોન',
    phoneHelp: 'તમે આ નંબરથી સાઇન ઇન કરો છો, તેથી તેને અહીં બદલી શકાતો નથી.',

    save: 'સેવ કરો',
    saveHint: 'તમારી વિગતો સેવ કરે છે અને તમારી પ્રોફાઇલ પર પાછા લઈ જાય છે',
    saving: 'સેવ થઈ રહ્યું છે…',
    saveFailedTitle: 'અમે તમારી પ્રોફાઇલ સેવ કરી શક્યા નહીં',

    firstNameRequired: 'પહેલું નામ જરૂરી છે.',
    nameTooLong: 'કૃપા કરીને આ {count} અક્ષરો કે તેથી ઓછામાં લખો.',

    discardTitle: 'ફેરફારો છોડી દેવા છે?',
    discardMessage: 'તમારા ફેરફારો હજી સેવ થયા નથી.',
    discardKeep: 'ફેરફાર ચાલુ રાખો',
    discardKeepHint: 'ફોર્મ પર પાછા લઈ જાય છે',
    discardConfirm: 'છોડી દો',
    discardConfirmHint: 'સેવ કર્યા વગર બહાર નીકળે છે',
  },

  addressBook: {
    title: 'સેવ કરેલાં સરનામાં',
    subtitle: 'આગલી વખતે સેવાની રિક્વેસ્ટ કરો ત્યારે ફરી વાપરી શકાય એવાં સરનામાં.',

    defaultBadge: 'ડિફૉલ્ટ',
    defaultSpoken: 'ડિફૉલ્ટ સરનામું',

    add: 'સરનામું ઉમેરો',
    addHint: 'તમારા એકાઉન્ટમાં નવું સરનામું સેવ કરે છે',
    edit: 'ફેરફાર કરો',
    editHint: 'ફેરફાર કરો',
    remove: 'કાઢી નાખો',
    removeHint: 'કાઢી નાખો',
    setDefault: 'ડિફૉલ્ટ બનાવો',
    setDefaultHint: 'આ સરનામું ડિફૉલ્ટ તરીકે વાપરે છે',

    emptyTitle: 'હજી કોઈ સરનામું સેવ કર્યું નથી',
    emptyMessage: 'અહીં સરનામું સેવ કરો, આગલી વખતે સેવાની રિક્વેસ્ટ કરો ત્યારે તે તૈયાર હશે.',

    loading: 'તમારાં સરનામાં લોડ થઈ રહ્યાં છે',
    failedTitle: 'અમે તમારાં સરનામાં લોડ કરી શક્યા નહીં',
    searchFailedTitle: 'અમે સરનામાં શોધી શક્યા નહીં',
    changeFailedTitle: 'અમે તે ફેરફાર સેવ કરી શક્યા નહીં',

    removeTitle: 'આ સરનામું કાઢી નાખવું છે?',
    removeMessage: 'આ સરનામું કાઢી નાખવામાં આવશે:',
    removeCancel: 'રદ કરો',
    removeCancelHint: 'સરનામું રાખે છે',
    removeConfirm: 'કાઢી નાખો',
    removeConfirmHint: 'સરનામું હમણાં કાઢી નાખે છે',

    addTitle: 'સરનામું ઉમેરો',
    addSubtitle: 'તમે સેવ કરવા માંગો છો તે સરનામું શોધો.',
    editTitle: 'સરનામામાં ફેરફાર કરો',
    editSubtitle: 'આ સરનામું ક્યાંનું છે તે બદલો.',

    save: 'સેવ કરો',
    saveHint: 'આ સરનામું સેવ કરે છે અને તમારાં સરનામાં પર પાછા લઈ જાય છે',
    saving: 'સેવ થઈ રહ્યું છે…',
    saveFailedTitle: 'અમે આ સરનામું સેવ કરી શક્યા નહીં',

    discardTitle: 'ફેરફારો છોડી દેવા છે?',
    discardMessage: 'આ સરનામું હજી સેવ થયું નથી.',
    discardKeep: 'ફેરફાર ચાલુ રાખો',
    discardKeepHint: 'ફોર્મ પર પાછા લઈ જાય છે',
    discardConfirm: 'છોડી દો',
    discardConfirmHint: 'સેવ કર્યા વગર બહાર નીકળે છે',
  },

  request: {
    vendorPending: 'હજી કોઈ વેન્ડર સોંપાયા નથી',

    referencePrefix: 'રેફરન્સ',

    statusLabel: 'સ્થિતિ',
    priorityLabel: 'પ્રાથમિકતા',

    openHint: 'આ રિક્વેસ્ટની વિગતો ખોલે છે',
  },
};
