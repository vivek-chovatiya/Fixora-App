/**
 * Vendor copy — Gujarati. Translates `VENDOR_COPY_EN` in `vendorCopy.ts`
 * (phase5-contract.md section 7); a key left out reads in English.
 *
 * Written for a small business owner in Gujarat: polite "તમે", everyday words,
 * and the same loanwords the customer and auth tables use (રિક્વેસ્ટ,
 * પ્રોફેશનલ, બિઝનેસ, પ્રોફાઇલ, ફોટો, સેવ, લોડ, રિવ્યૂ, રેટિંગ, ટીમ). "રિક્વેસ્ટ" is
 * feminine throughout, "કામ" (a job) neuter. Accept / Reject are "સ્વીકારો" /
 * "નકારો", and the Rejected list, badge and report figure all say "નકારેલી", so a
 * chip and the cards under it agree. `answer.taken`, `answer.notPending` and
 * `work.changed` repeat `shared/types/error.gu.ts` word for word, as the English
 * pairs do. A native speaker should review this table before release.
 *
 * Deliberately absent, so they read as the English: the values with no words in
 * them — `dashboard.countAtLeast`, `reviews.breakdownPercent`,
 * `breakdownPercentWidest`, `contextSeparator`, `reviewerInitialMark`,
 * `reports.figureSpoken`, `reports.unavailable`, `team.memberWithStatusSpoken`,
 * `workingHours.hours`, `dayRange` and `summarySpoken`.
 *
 * ⚠️ Every key must mirror `VENDOR_COPY_EN`: the same nesting, and each function
 * with the English arguments in the English order (`tsc` and
 * `__tests__/i18n/translationKeys.test.ts` refuse anything else). "Fixora",
 * `REQ-…` references, ₹ amounts and numbers stay as they are.
 *
 * ⚠️ Some values are fragments the code joins in a fixed order, so they are
 * worded for that order: `job.raisedLabel` / `completedLabel` / `rejectedLabel`
 * come before a relative time ("મળી 2 કલાક પહેલાં"), `job.areaLabel` before a
 * colon, `requestDetails.photoCountMany` / `photoUnavailable` after a number, and
 * `dashboard.atLeastSpoken` wraps a whole spoken phrase. A spoken label for a
 * button starts with the button's own words ("સ્વીકારો: …", "ફરી પ્રયાસ કરો: …"),
 * so voice control still finds it. The shop-image state words are quoted inside
 * `shopImages.leaveMessage`; change one and change the other.
 */

import type { LocaleTable } from '@/core/i18n';
import type { VENDOR_COPY_EN } from '@/features/vendor/constants/vendorCopy';

const BACK = 'પાછા';
const BACK_TO_PROFILE = 'પ્રોફાઇલ પર પાછા';
const TRY_AGAIN = 'ફરી પ્રયાસ કરો';
const COULD_NOT_REFRESH = 'રિફ્રેશ થઈ શક્યું નહીં';
const CANCEL = 'રદ કરો';
const SAVING = 'સેવ થઈ રહ્યું છે…';
const FIX_ERRORS = 'હાઇલાઇટ કરેલી વિગતો તપાસો.';
const OPTIONAL = 'વૈકલ્પિક';
const DISCARD = 'છોડી દો';
const DISCARD_CHANGES = 'ફેરફારો છોડી દેવા છે?';
const KEEP_EDITING = 'ફેરફાર ચાલુ રાખો';
const RETURNS_TO_FORM = 'ફોર્મ પર પાછા લઈ જાય છે';
const LEAVES_WITHOUT_SAVING = 'સેવ કર્યા વગર બહાર નીકળે છે';
const FORGETS_FAILED_PHOTO = 'અપલોડ ન થયેલો ફોટો હટાવી દે છે';
const NOT_ADDED_YET = 'હજી ઉમેર્યું નથી';
const ACTIVE_EMPTY_MESSAGE = 'તમે સ્વીકારેલી રિક્વેસ્ટ, તેનું કામ ચાલે ત્યાં સુધી અહીં દેખાશે.';
const COMPLETED_EMPTY_MESSAGE = 'તમે પૂર્ણ કરેલું કામ અહીં દેખાશે.';
const NEW_REQUESTS_MESSAGE = 'નવી સેવા રિક્વેસ્ટ અહીં દેખાશે.';
const FIXORA_DOES_NOT_PROCESS = 'Fixora ચુકવણી પ્રોસેસ કરતું નથી.';

/** As `profileForm.photoProgress` and `teamForm.photoProgress` in English: the same line. */
const PHOTO_PROGRESS = (percent: number) => `અપલોડ થઈ રહ્યું છે… ${percent}%`;

/** The shop-image state words, shown on the tiles and quoted in `leaveMessage`. */
const SHOP_UPLOADING = 'અપલોડ થઈ રહ્યો છે';
const SHOP_UPLOAD_FAILED = 'અપલોડ નિષ્ફળ';
const SHOP_WAITING = 'સેવ થવાની રાહમાં';
const SHOP_SAVING = 'સેવ થઈ રહ્યો છે';
const SHOP_REMOVING = 'કાઢી રહ્યા છીએ';
const SHOP_NOT_SAVED = 'સેવ થયો નથી';

export const VENDOR_COPY_GU: LocaleTable<typeof VENDOR_COPY_EN> = {
  gate: {
    loading: 'તમારી બિઝનેસ પ્રોફાઇલ લોડ થઈ રહી છે',
    failedTitle: 'અમે તમારી બિઝનેસ પ્રોફાઇલ લોડ કરી શક્યા નહીં',
  },

  profileForm: {
    setupTitle: 'તમારો બિઝનેસ સેટ કરો',
    setupSubtitle:
      'ગ્રાહકોને જણાવો કે તમે કોણ છો અને શું કામ કરો છો. આમાંનું કંઈ પણ તમે પછીથી બદલી શકો છો.',
    editTitle: 'બિઝનેસ પ્રોફાઇલમાં ફેરફાર કરો',
    editSubtitle: 'તમે સેવ કરો કે તરત જ ફેરફારો ગ્રાહકોને દેખાશે.',
    back: BACK_TO_PROFILE,

    photoSection: 'બિઝનેસનો ફોટો',
    photoSupport: 'વૈકલ્પિક. તમારી દુકાનનો આગળનો ભાગ, તમારી વાન કે તમારો લોગો.',
    photoCamera: 'ફોટો લો',
    photoGallery: 'ફોટો પસંદ કરો',
    photoAddCameraSpoken: 'કૅમેરાથી પ્રોફાઇલ ફોટો ઉમેરો',
    photoAddGallerySpoken: 'તમારા ફોટામાંથી પ્રોફાઇલ ફોટો ઉમેરો',
    photoReplaceCameraSpoken: 'કૅમેરાથી પ્રોફાઇલ ફોટો બદલો',
    photoReplaceGallerySpoken: 'તમારા ફોટામાંથી પ્રોફાઇલ ફોટો બદલો',
    photoRemove: 'ફોટો કાઢી નાખો',
    photoRemoveSpoken: 'પ્રોફાઇલ ફોટો કાઢી નાખો',
    photoUploading: 'તમારો ફોટો અપલોડ થઈ રહ્યો છે…',
    photoProgress: PHOTO_PROGRESS,
    photoFailedTitle: 'તમારો ફોટો અપલોડ થયો નથી',
    photoRetry: TRY_AGAIN,
    photoDiscard: DISCARD,
    photoDiscardHint: FORGETS_FAILED_PHOTO,
    photoSpoken: 'બિઝનેસનો ફોટો',

    businessSection: 'તમારો બિઝનેસ',
    businessNameLabel: 'બિઝનેસનું નામ',
    businessNamePlaceholder: 'દા.ત. કુમાર ઇલેક્ટ્રિકલ્સ',
    descriptionLabel: 'વર્ણન',
    descriptionPlaceholder: 'તમે શું કામ કરો છો, કેટલા સમયથી કરો છો, તમે શેના માટે જાણીતા છો',
    descriptionHelper: OPTIONAL,

    servicesSection: 'તમે આપો છો તે સેવાઓ',
    categoriesLabel: 'સેવા કેટેગરી',

    areaSection: 'તમે ક્યાં કામ કરો છો',
    areaLabel: 'સેવા વિસ્તાર',
    areaPlaceholder: 'દા.ત. કોરમંગલા, HSR લેઆઉટ અને ઇન્દિરાનગર',
    areaHelper: 'વૈકલ્પિક. જે વિસ્તારો કે શહેરમાં તમે કામ લો છો.',

    contactSection: 'સંપર્ક',
    contactSupport: 'તમારા એકાઉન્ટમાંથી. ગ્રાહકો આના પર તમારો સંપર્ક કરે છે.',
    ownerLabel: 'માલિક',
    phoneLabel: 'ફોન',
    emailLabel: 'ઇમેઇલ',

    saveSetup: 'સેટઅપ પૂર્ણ કરો',
    saveEdit: 'પ્રોફાઇલ સેવ કરો',
    saving: SAVING,
    saveHint: 'તમારી બિઝનેસ પ્રોફાઇલ સેવ કરે છે',
    saveFailedTitle: 'તમારી પ્રોફાઇલ સેવ થઈ નથી',
    fixErrors: FIX_ERRORS,

    signOut: 'સાઇન આઉટ',
    signOutHint: 'સેટઅપ પૂર્ણ કર્યા વગર સાઇન આઉટ કરે છે',

    discardTitle: DISCARD_CHANGES,
    discardMessage: 'બિઝનેસ પ્રોફાઇલમાં કરેલા તમારા ફેરફારો હજી સેવ થયા નથી.',
    discardKeep: KEEP_EDITING,
    discardKeepHint: RETURNS_TO_FORM,
    discardConfirm: DISCARD,
    discardConfirmHint: LEAVES_WITHOUT_SAVING,
  },

  validation: {
    businessNameRequired: 'તમારા બિઝનેસનું નામ નાખો.',
    businessNameTooLong: (max: number) => `બિઝનેસનું નામ ${max} અક્ષરો કે તેથી ઓછું હોવું જોઈએ.`,
    descriptionTooLong: (max: number) => `વર્ણન ${max} અક્ષરો કે તેથી ઓછું હોવું જોઈએ.`,
    areaTooLong: (max: number) => `સેવા વિસ્તાર ${max} અક્ષરો કે તેથી ઓછો હોવો જોઈએ.`,
    categoriesRequired: 'તમે આપો છો તે ઓછામાં ઓછી એક સેવા પસંદ કરો.',

    memberNameRequired: 'તેમનું નામ નાખો.',
    memberNameTooLong: (max: number) => `નામ ${max} અક્ષરો કે તેથી ઓછું હોવું જોઈએ.`,
    memberRoleTooLong: (max: number) => `હોદ્દો ${max} અક્ષરો કે તેથી ઓછો હોવો જોઈએ.`,

    amountRequired: 'અંતિમ રકમ નાખો.',
    amountFormat: 'રકમ ફક્ત આંકડામાં નાખો, જેમ કે 1250 અથવા 1250.50.',
    amountTooSmall: 'અંતિમ રકમ 0 કરતાં વધુ હોવી જોઈએ.',
    amountTooLarge: (max: string) => `અંતિમ રકમ ${max} કે તેથી ઓછી હોવી જોઈએ.`,
    paymentStatusRequired: 'ગ્રાહકે ચુકવણી કરી છે કે નહીં તે પસંદ કરો.',
    paymentMethodRequired: 'ગ્રાહકે કેવી રીતે ચુકવણી કરી તે પસંદ કરો.',
    completionNotesTooLong: (max: number) => `નોંધ ${max} અક્ષરો કે તેથી ઓછી હોવી જોઈએ.`,
  },

  dashboard: {
    greetingMorning: 'સુપ્રભાત',
    greetingAfternoon: 'શુભ બપોર',
    greetingEvening: 'શુભ સાંજ',
    greetingFallbackName: 'મિત્ર',

    businessServicesLabel: 'સેવાઓ',
    businessAreaLabel: 'સેવા વિસ્તાર',
    businessHint: 'તમારી બિઝનેસ પ્રોફાઇલ ખોલે છે',

    overviewTitle: 'સારાંશ',
    pendingLabel: 'બાકી',
    activeLabel: 'ચાલુ',
    completedLabel: 'પૂર્ણ',
    pendingSpoken: (count: number) =>
      count === 1 ? '1 રિક્વેસ્ટ તમારી રાહ જોઈ રહી છે' : `${count} રિક્વેસ્ટ તમારી રાહ જોઈ રહી છે`,
    activeSpoken: (count: number) => (count === 1 ? '1 કામ ચાલુ છે' : `${count} કામ ચાલુ છે`),
    completedSpoken: (count: number) =>
      count === 1 ? '1 કામ પૂર્ણ થયું' : `${count} કામ પૂર્ણ થયાં`,
    atLeastSpoken: (spoken: string) => `ઓછામાં ઓછા ${spoken}`,

    loading: 'તમારું ડેશબોર્ડ લોડ થઈ રહ્યું છે',
    failedTitle: 'અમે તમારું ડેશબોર્ડ લોડ કરી શક્યા નહીં',

    pendingTitle: 'નવી રિક્વેસ્ટ',
    pendingEmptyTitle: 'કોઈ નવી રિક્વેસ્ટ નથી',
    pendingEmptyMessage: NEW_REQUESTS_MESSAGE,

    activeTitle: 'ચાલુ કામ',
    activeEmptyTitle: 'કોઈ ચાલુ કામ નથી',
    activeEmptyMessage: ACTIVE_EMPTY_MESSAGE,

    completedTitle: 'તાજેતરમાં પૂર્ણ થયેલાં કામ',
    completedEmptyTitle: 'હજી કોઈ કામ પૂર્ણ થયું નથી',
    completedEmptyMessage: COMPLETED_EMPTY_MESSAGE,

    seeAll: 'બધું જુઓ',
    seeAllPendingSpoken: 'બધું જુઓ: નવી રિક્વેસ્ટ',
    seeAllActiveSpoken: 'બધું જુઓ: ચાલુ કામ',
    seeAllCompletedSpoken: 'બધું જુઓ: પૂર્ણ થયેલાં કામ',
    seeAllHint: 'તમારી રિક્વેસ્ટ ખોલે છે',

    todayLabel: 'આજની રિક્વેસ્ટ',
    todaySpoken: (value: string) => `આજની રિક્વેસ્ટ, ${value}`,
    todayLoading: 'આજની રિક્વેસ્ટ લોડ થઈ રહી છે',
    todayFailedTitle: 'અમે આજની રિક્વેસ્ટ લોડ કરી શક્યા નહીં',
    todayRetrySpoken: 'ફરી પ્રયાસ કરો: આજની રિક્વેસ્ટ',
    todayRetryHint: 'આજની રિક્વેસ્ટ ફરી લોડ કરે છે',

    ratingHint: 'તમારા રિવ્યૂ ખોલે છે',
    ratingLoading: 'તમારું રેટિંગ લોડ થઈ રહ્યું છે',
    ratingFailedTitle: 'અમે તમારું રેટિંગ લોડ કરી શક્યા નહીં',
    ratingRetrySpoken: 'ફરી પ્રયાસ કરો: તમારું રેટિંગ',
    ratingRetryHint: 'તમારું રેટિંગ ફરી લોડ કરે છે',
    figureRetry: TRY_AGAIN,

    staleTitle: COULD_NOT_REFRESH,
    staleMessage: 'તમારા ડેશબોર્ડની માહિતી કદાચ જૂની હોય.',
    staleRetry: TRY_AGAIN,
    staleRetryHint: 'તમારું ડેશબોર્ડ ફરી લોડ કરે છે',
  },

  job: {
    referencePrefix: 'રેફરન્સ',
    statusLabel: 'સ્થિતિ',
    customerLabel: 'ગ્રાહક',
    areaLabel: 'વિસ્તાર',
    priorityLabel: 'પ્રાથમિકતા',
    raisedLabel: 'મળી',
    completedLabel: 'પૂર્ણ થઈ',
    rejectedLabel: 'નકારી',
    justNow: 'હમણાં જ',

    statusDirected: 'સીધી રિક્વેસ્ટ',
    statusBroadcast: 'ખુલ્લી રિક્વેસ્ટ',
    statusNew: 'નવી',
    statusAccepted: 'સ્વીકારેલી',
    statusInProgress: 'ચાલુ છે',
    statusCompleted: 'પૂર્ણ',
    statusRejected: 'નકારેલી',
    statusCancelled: 'રદ થયેલી',
    statusUnknown: 'સ્થિતિ ઉપલબ્ધ નથી',

    openHint: 'આ રિક્વેસ્ટ ખોલે છે',
  },

  requests: {
    title: 'રિક્વેસ્ટ',
    subtitle: 'તમારી રાહ જોતું, ચાલુ અને પૂર્ણ થયેલું કામ.',

    filtersLabel: 'રિક્વેસ્ટ બતાવો',
    filterHint: 'ફક્ત આ રિક્વેસ્ટ બતાવે છે',
    filterAll: 'બધી',
    filterPending: 'બાકી',
    filterActive: 'ચાલુ',
    filterCompleted: 'પૂર્ણ',
    filterRejected: 'નકારેલી',

    groupPending: 'બાકી',
    groupActive: 'ચાલુ',
    groupCompleted: 'પૂર્ણ',
    groupSpoken: (group: string, count: number) =>
      count === 1 ? `${group}, 1 રિક્વેસ્ટ` : `${group}, ${count} રિક્વેસ્ટ`,

    loadingLabel: 'તમારી રિક્વેસ્ટ લોડ થઈ રહી છે',
    failedTitle: 'અમે તમારી રિક્વેસ્ટ લોડ કરી શક્યા નહીં',

    emptyAllTitle: 'હજી કોઈ રિક્વેસ્ટ નથી',
    emptyAllMessage: NEW_REQUESTS_MESSAGE,
    emptyPendingTitle: 'કોઈ બાકી રિક્વેસ્ટ નથી',
    emptyPendingMessage: 'તમારા જવાબની રાહ જોતી રિક્વેસ્ટ અહીં દેખાશે.',
    emptyActiveTitle: 'કોઈ ચાલુ કામ નથી',
    emptyActiveMessage: ACTIVE_EMPTY_MESSAGE,
    emptyCompletedTitle: 'હજી કોઈ પૂર્ણ થયેલી રિક્વેસ્ટ નથી',
    emptyCompletedMessage: COMPLETED_EMPTY_MESSAGE,
    emptyRejectedTitle: 'કોઈ નકારેલી રિક્વેસ્ટ નથી',
    emptyRejectedMessage: 'તમે હજી સુધી કોઈ રિક્વેસ્ટ નકારી નથી.',

    staleTitle: COULD_NOT_REFRESH,
    staleMessage: 'આ રિક્વેસ્ટની માહિતી કદાચ જૂની હોય.',
    staleRetry: TRY_AGAIN,
    staleRetryHint: 'તમારી રિક્વેસ્ટ ફરી લોડ કરે છે',
  },

  answer: {
    accept: 'સ્વીકારો',
    reject: 'નકારો',
    acceptSpoken: (service: string, reference?: string) =>
      reference ? `સ્વીકારો: ${service}, ${reference}` : `સ્વીકારો: ${service}`,
    rejectSpoken: (service: string, reference?: string) =>
      reference ? `નકારો: ${service}, ${reference}` : `નકારો: ${service}`,
    acceptHint: 'આ કામ સ્વીકારે છે',
    rejectHint: 'આ રિક્વેસ્ટ નકારતાં પહેલાં પૂછે છે',

    section: 'તમારો જવાબ',
    promptDirected:
      'ગ્રાહકે તમને પસંદ કર્યા છે. કામ લેવા માટે સ્વીકારો, અથવા ન કરી શકો તો નકારો.',
    promptBroadcast:
      'બીજા પ્રોફેશનલ પણ આ રિક્વેસ્ટ જોઈ શકે છે. જે પહેલાં સ્વીકારે તેને કામ મળે છે.',
    prompt: 'કામ લેવા માટે સ્વીકારો, અથવા ન કરી શકો તો નકારો.',

    rejectTitle: 'રિક્વેસ્ટ નકારવી છે?',
    rejectMessage: 'આ પછી તમે તેને લઈ શકશો નહીં. તે તમારી "નકારેલી" યાદીમાં રહેશે.',
    rejectCancel: CANCEL,
    rejectCancelHint: 'રિક્વેસ્ટ રાખે છે',
    rejectConfirm: 'નકારો',
    rejectConfirmHint: 'આ રિક્વેસ્ટ નકારે છે',

    accepted: 'રિક્વેસ્ટ સ્વીકારી લીધી. હવે તે તમારા ચાલુ કામમાં છે.',
    rejected: 'રિક્વેસ્ટ નકારી દીધી.',
    taken: 'આ રિક્વેસ્ટ હવે ઉપલબ્ધ નથી. બીજા પ્રોફેશનલે તેને પહેલાં સ્વીકારી લીધી.',
    notPending: 'આ રિક્વેસ્ટ હવે જવાબની રાહ જોઈ રહી નથી.',
    unavailable: 'આ રિક્વેસ્ટ હવે ઉપલબ્ધ નથી.',
    acceptFailed: 'રિક્વેસ્ટ સ્વીકારી શકાઈ નથી.',
    rejectFailed: 'રિક્વેસ્ટ નકારી શકાઈ નથી.',
  },

  work: {
    start: 'કામ શરૂ કરો',
    complete: 'કામ પૂર્ણ કરો',
    startSpoken: (service: string, reference?: string) =>
      reference ? `કામ શરૂ કરો: ${service}, ${reference}` : `કામ શરૂ કરો: ${service}`,
    completeSpoken: (service: string, reference?: string) =>
      reference ? `કામ પૂર્ણ કરો: ${service}, ${reference}` : `કામ પૂર્ણ કરો: ${service}`,
    startHint: 'આ કામને ચાલુ તરીકે નોંધે છે',
    completeHint: 'અંતિમ રકમ અને ચુકવણી નોંધવાનું ફોર્મ ખોલે છે',

    section: 'તમારું કામ',
    promptStart: 'કામ ચાલુ કરો ત્યારે "કામ શરૂ કરો" દબાવો.',
    promptComplete:
      'કામ થઈ જાય ત્યારે તેને પૂર્ણ કરો. તમે અંતિમ રકમ અને ચુકવણી નોંધશો.',

    completeTitle: 'આ કામ પૂર્ણ કરવું છે?',
    completeMessage:
      'આનાથી રિક્વેસ્ટ પૂર્ણ થયેલી ગણાશે અને ચુકવણીની વિગતો સેવ થશે. આ પાછું ફેરવી શકાશે નહીં.',
    completeCancel: CANCEL,
    completeCancelHint: 'કામ ચાલુ રાખે છે',
    completeConfirm: 'પૂર્ણ કરો',
    completeConfirmHint: 'આ કામ પૂર્ણ કરે છે',

    started: 'કામ શરૂ થયું. આ કામ હવે ચાલુ છે.',
    completed: 'કામ પૂર્ણ થયું. હવે તે તમારા પૂર્ણ થયેલા કામમાં છે.',
    changed: 'આ કામમાં પહેલેથી ફેરફાર થઈ ગયો છે. તેની તાજી સ્થિતિ બતાવવામાં આવી રહી છે.',
    startFailed: 'કામ શરૂ થઈ શક્યું નથી.',
    completeFailed: 'કામ પૂર્ણ તરીકે નોંધાઈ શક્યું નથી.',

    paymentRecorded: 'ચુકવણી નોંધાઈ ગઈ. આ કામ હવે ચૂકવાયેલું નોંધાયું છે.',
    recordPaymentFailed: 'ચુકવણી નોંધાઈ શકી નથી.',
  },

  completeForm: {
    title: 'કામ પૂર્ણ કરો',
    subtitle: `કામની કુલ રકમ કેટલી થઈ અને ગ્રાહકે તમને ચુકવણી કરી છે કે નહીં તે નોંધો. ${FIXORA_DOES_NOT_PROCESS}`,
    back: BACK,

    amountLabel: 'અંતિમ રકમ',
    amountPlaceholder: 'દા.ત. 1250',
    amountHelper: 'કામની કુલ રકમ. પૈસા માટે પૉઇન્ટ (.) વાપરો, જેમ કે 1250.50.',

    statusLabel: 'ચુકવણીની સ્થિતિ',
    statusHint: 'ગ્રાહકે ચુકવણી કરી છે કે નહીં તે સેટ કરે છે',

    methodLabel: 'ચુકવણીની રીત',
    methodHint: 'ગ્રાહકે કેવી રીતે ચુકવણી કરી તે સેટ કરે છે',
    methodsLoading: 'ચુકવણીની રીતો લોડ થઈ રહી છે',
    methodsFailed: 'ચુકવણીની રીતો લોડ થઈ નથી.',
    methodsNone: 'અત્યારે ચુકવણીની કોઈ રીત ઉપલબ્ધ નથી.',
    methodsRetry: TRY_AGAIN,
    methodsRetryHint: 'ચુકવણીની રીતો ફરી લોડ કરે છે',

    notesLabel: 'કામની નોંધ',
    notesPlaceholder: 'શું કામ કર્યું, કયા પાર્ટ્સ વાપર્યા, કામ વિશે યાદ રાખવા જેવું કંઈ પણ',
    notesHelper: OPTIONAL,

    submit: 'કામ પૂર્ણ કરો',
    submitHint: 'આ કામ પૂર્ણ કરતાં પહેલાં પૂછે છે',
    fixErrors: FIX_ERRORS,

    discardTitle: 'કામ પૂર્ણ કરવાનું છોડી દેવું છે?',
    discardMessage: 'તમે નાખેલી રકમ અને ચુકવણીની વિગતો સેવ થઈ નથી.',
    discardKeep: KEEP_EDITING,
    discardKeepHint: RETURNS_TO_FORM,
    discardConfirm: DISCARD,
    discardConfirmHint: 'કામ પૂર્ણ કર્યા વગર બહાર નીકળે છે',
  },

  payment: {
    section: 'ચુકવણી',
    amountLabel: 'અંતિમ રકમ',
    statusLabel: 'ચુકવણીની સ્થિતિ',
    notesLabel: 'કામની નોંધ',
    recorded: `તમે નોંધ્યું છે. ${FIXORA_DOES_NOT_PROCESS}`,

    recordPayment: 'ચુકવણી નોંધો',
    recordPaymentHint: 'ગ્રાહકે કેવી રીતે ચુકવણી કરી તે નોંધવાનું ફોર્મ ખોલે છે',
  },

  recordPaymentForm: {
    title: 'ચુકવણી નોંધો',
    subtitle: `ગ્રાહકે આ કામ માટે તમને કેવી રીતે ચુકવણી કરી તે નોંધો. એક વાર ચુકવણી થઈ ગઈ એમ નોંધાય પછી તે બદલી શકાશે નહીં. ${FIXORA_DOES_NOT_PROCESS}`,
    back: BACK,

    submit: 'ચુકવણી નોંધો',
    submitHint: 'આ કામની ચુકવણી થઈ ગઈ એમ નોંધતાં પહેલાં પૂછે છે',
    fixErrors: FIX_ERRORS,

    confirmTitle: (method: string) => `${method} થી ચુકવણી થઈ એમ નોંધવું છે?`,
    confirmTitlePlain: 'આ કામની ચુકવણી થઈ ગઈ એમ નોંધવું છે?',
    confirmMessage: 'આ પછીથી બદલી શકાશે નહીં.',
    confirmCancel: CANCEL,
    confirmCancelHint: 'ચુકવણીને "હજી ચુકવણી થઈ નથી" તરીકે જ રાખે છે',
    confirmConfirm: 'ચુકવણી નોંધો',
    confirmConfirmHint: 'આ કામની ચુકવણી થઈ ગઈ એમ નોંધે છે',

    discardTitle: 'આ ચુકવણી છોડી દેવી છે?',
    discardMessage: 'તમે પસંદ કરેલી ચુકવણીની રીત સેવ થઈ નથી.',
    discardKeep: KEEP_EDITING,
    discardKeepHint: RETURNS_TO_FORM,
    discardConfirm: DISCARD,
    discardConfirmHint: 'ચુકવણી નોંધ્યા વગર બહાર નીકળે છે',
  },

  requestDetails: {
    back: BACK,
    loading: 'આ રિક્વેસ્ટ લોડ થઈ રહી છે',
    failedTitle: 'અમે આ રિક્વેસ્ટ લોડ કરી શક્યા નહીં',
    notFoundTitle: 'આ રિક્વેસ્ટ ઉપલબ્ધ નથી',
    notFoundMessage: 'કદાચ બીજા કોઈએ તે લઈ લીધી હોય, અથવા હવે તે તમારા માટે ખુલ્લી નથી.',

    requestSection: 'રિક્વેસ્ટ',
    referenceLabel: 'રેફરન્સ',
    copyReference: (reference: string) => `રેફરન્સ ${reference} કૉપિ કરો`,
    copyReferenceHint: 'રેફરન્સ ક્લિપબોર્ડ પર કૉપિ કરે છે',
    copied: 'કૉપિ થઈ ગયું',
    copyFailed: 'અમે રેફરન્સ કૉપિ કરી શક્યા નહીં. તેના બદલે તમે તેને લખી લઈ શકો છો.',
    categoryLabel: 'કેટેગરી',
    serviceLabel: 'સેવા',
    statusLabel: 'સ્થિતિ',
    priorityLabel: 'પ્રાથમિકતા',
    raisedLabel: 'મળ્યાનો સમય',
    completedLabel: 'પૂર્ણ થયાનો સમય',
    rejectedLabel: 'નકાર્યાનો સમય',

    originLabel: 'તમારા સુધી કેવી રીતે પહોંચી',
    originDirected: 'ગ્રાહકે આ રિક્વેસ્ટ માટે તમને પસંદ કર્યા છે.',
    originBroadcast: 'આ સેવા આપતા દરેક પ્રોફેશનલને મોકલાઈ છે.',

    preferredDateLabel: 'પસંદગીની તારીખ',
    preferredTimeLabel: 'પસંદગીનો સમય',
    today: 'આજે',
    tomorrow: 'આવતીકાલે',

    customerSection: 'ગ્રાહક',
    customerLabel: 'નામ',
    phoneLabel: 'ફોન',

    locationSection: 'સ્થળ',
    localityLabel: 'વિસ્તાર',
    addressLabel: 'સરનામું',
    withheldNote: 'તમે સ્વીકારો પછી ગ્રાહકનું નામ, ફોન નંબર અને પૂરું સરનામું તમને બતાવવામાં આવે છે.',

    photosLabel: 'ફોટા',
    photoCountOne: '1 ફોટો જોડેલો છે',
    photoCountMany: 'ફોટા જોડેલા છે',
    photoUnavailable: 'બતાવી શકાયા નહીં',

    descriptionSection: 'ગ્રાહકે શું કહ્યું',
    descriptionMissing: 'ગ્રાહકે કોઈ વર્ણન ઉમેર્યું નથી.',
  },

  reviews: {
    title: 'રિવ્યૂ',
    subtitle: 'તમારા કામ વિશે ગ્રાહકોએ શું કહ્યું.',
    back: BACK,

    summaryTitle: 'કુલ રેટિંગ',
    count: (count: number) => `${count} રિવ્યૂ`,
    summarySpoken: (average: string, max: number, count: number) =>
      `રેટિંગ ${max} માંથી ${average}, ${count} રિવ્યૂના આધારે.`,

    breakdownRowSpoken: (stars: number, percent: number, count: number) =>
      `${stars} સ્ટાર, ${percent} ટકા, ${count} રિવ્યૂ`,

    fromSpoken: (name: string) => `${name} તરફથી રિવ્યૂ`,
    anonymousSpoken: 'ગ્રાહકનો રિવ્યૂ',
    commentSpoken: 'કૉમેન્ટ',

    figureLabel: 'રેટિંગ',
    figureNone: 'હજી કોઈ રિવ્યૂ નથી',
    figureNoneSpoken: 'રેટિંગ, હજી કોઈ રિવ્યૂ નથી',
    figureCountOnlySpoken: (count: string) => `રેટિંગ, ${count}`,

    loading: 'તમારા રિવ્યૂ લોડ થઈ રહ્યા છે',
    failedTitle: 'અમે તમારા રિવ્યૂ લોડ કરી શક્યા નહીં',

    emptyTitle: 'હજી કોઈ રિવ્યૂ નથી',
    emptyMessage: 'ગ્રાહકો તમારા પૂર્ણ થયેલા કામનો રિવ્યૂ આપશે ત્યારે તે અહીં દેખાશે.',

    staleTitle: COULD_NOT_REFRESH,
    staleMessage: 'આ રિવ્યૂ કદાચ જૂના હોય.',
    staleRetry: TRY_AGAIN,
    staleRetryHint: 'તમારા રિવ્યૂ ફરી લોડ કરે છે',
  },

  reports: {
    title: 'રિપોર્ટ',
    subtitle: 'તમે પસંદ કરો તે સમયગાળાની તમારી રિક્વેસ્ટ અને રેટિંગ.',
    back: BACK_TO_PROFILE,

    periodsLabel: 'રિપોર્ટનો સમયગાળો',
    periodHint: 'આ સમયગાળાના આંકડા બતાવે છે',
    periodToday: 'આજે',
    periodWeek: 'આ અઠવાડિયે',
    periodMonth: 'આ મહિને',

    total: 'કુલ રિક્વેસ્ટ',
    completed: 'પૂર્ણ',
    rejected: 'નકારેલી',
    cancelled: 'રદ થયેલી',
    totalSpoken: 'કુલ રિક્વેસ્ટ',
    completedSpoken: 'પૂર્ણ થયેલી રિક્વેસ્ટ',
    rejectedSpoken: 'નકારેલી રિક્વેસ્ટ',
    cancelledSpoken: 'રદ થયેલી રિક્વેસ્ટ',
    unavailableSpoken: 'ઉપલબ્ધ નથી',

    rating: 'સરેરાશ રેટિંગ',
    ratingCount: (count: number) => `${count} રેટિંગના આધારે`,
    ratingSpoken: (average: string, max: number, count: number) =>
      `સરેરાશ રેટિંગ ${max} માંથી ${average}, ${count} રેટિંગના આધારે`,
    noRatings: 'હજી કોઈ રેટિંગ નથી',
    noRatingsSpoken: 'સરેરાશ રેટિંગ, હજી કોઈ રેટિંગ નથી',

    noRequests: 'આ સમયગાળામાં હજી કોઈ રિક્વેસ્ટ નથી.',

    loading: 'તમારો રિપોર્ટ લોડ થઈ રહ્યો છે',
    failedTitle: 'અમે તમારો રિપોર્ટ લોડ કરી શક્યા નહીં',

    staleTitle: COULD_NOT_REFRESH,
    staleMessage: 'આ આંકડા કદાચ જૂના હોય.',
    staleRetry: TRY_AGAIN,
    staleRetryHint: 'આ રિપોર્ટ ફરી લોડ કરે છે',
  },

  team: {
    title: 'ટીમ',
    subtitle: 'તમારી સાથે કામ કરતા લોકો.',

    add: 'ટીમ મેમ્બર ઉમેરો',
    addHint: 'તમારી ટીમમાં કોઈને ઉમેરવાનું ફોર્મ ખોલે છે',

    loading: 'તમારી ટીમ લોડ થઈ રહી છે',
    failedTitle: 'અમે તમારી ટીમ લોડ કરી શક્યા નહીં',

    emptyTitle: 'હજી કોઈ ટીમ મેમ્બર નથી',
    emptyMessage: 'તમે હજી સુધી કોઈ ટીમ મેમ્બર ઉમેર્યા નથી.',

    phoneLabel: 'ફોન',
    memberSpoken: (name: string, role?: string, phone?: string) => {
      const who = role ? `${name}, ${role}` : name;
      return phone ? `${who}. ફોન ${phone}` : who;
    },

    statusActive: 'સક્રિય',
    statusDisabled: 'નિષ્ક્રિય',
    statusUnknown: 'સ્થિતિ ઉપલબ્ધ નથી',

    edit: 'ફેરફાર કરો',
    editSpoken: (name: string) => `ફેરફાર કરો: ${name}`,
    editHint: 'આ ટીમ મેમ્બરની વિગતો બદલવા માટે ખોલે છે',
    remove: 'કાઢી નાખો',
    removeSpoken: (name: string) => `કાઢી નાખો: ${name}`,
    removeHint: 'આ ટીમ મેમ્બરને કાઢતાં પહેલાં પૂછે છે',

    removeTitle: 'ટીમ મેમ્બરને કાઢી નાખવા છે?',
    removeMessage: (name: string) => `${name} ને તમારી ટીમમાંથી કાઢી નાખવામાં આવશે.`,
    removeCancel: CANCEL,
    removeCancelHint: 'આ ટીમ મેમ્બરને રાખે છે',
    removeConfirm: 'કાઢી નાખો',
    removeConfirmHint: 'આ ટીમ મેમ્બરને તમારી ટીમમાંથી કાઢી નાખે છે',

    removed: 'ટીમ મેમ્બરને કાઢી નાખ્યા.',
    removeFailed: 'ટીમ મેમ્બરને કાઢી શકાયા નથી.',

    staleTitle: COULD_NOT_REFRESH,
    staleMessage: 'તમારી ટીમની માહિતી કદાચ જૂની હોય.',
    staleRetry: TRY_AGAIN,
    staleRetryHint: 'તમારી ટીમ ફરી લોડ કરે છે',
  },

  teamForm: {
    addTitle: 'ટીમ મેમ્બર ઉમેરો',
    addSubtitle: 'તેમની વિગતો એક જગ્યાએ રાખો. ટીમ મેમ્બર Fixora માં સાઇન ઇન કરતા નથી.',
    editTitle: 'ટીમ મેમ્બરની વિગતો બદલો',
    editSubtitle: 'તેમની વિગતો બદલો, પછી સેવ કરો.',
    back: 'ટીમ પર પાછા',

    nameLabel: 'નામ',
    namePlaceholder: 'તેમનું પૂરું નામ',
    roleLabel: 'હોદ્દો',
    rolePlaceholder: 'દા.ત. સિનિયર ટેક્નિશિયન',
    roleHelper: OPTIONAL,
    phoneLabel: 'ફોન નંબર',
    phonePlaceholder: 'તેમનો ફોન નંબર',
    phoneHelper: OPTIONAL,

    photoSection: 'ફોટો',
    photoSupport: 'વૈકલ્પિક. તેમના ચહેરાનો સ્પષ્ટ ફોટો.',
    photoAdd: 'ફોટો ઉમેરો',
    photoChange: 'ફોટો બદલો',
    photoOptionsHint: 'ફોટાના વિકલ્પો ખોલે છે',
    photoSheetTitle: 'તેમનો ફોટો',
    photoGallery: 'ગૅલેરીમાંથી પસંદ કરો',
    photoGalleryHint: 'એક ફોટો પસંદ કરવા તમારા ફોટા ખોલે છે',
    photoCamera: 'ફોટો લો',
    photoCameraHint: 'કૅમેરા ખોલે છે',
    photoRemove: 'ફોટો કાઢી નાખો',
    photoRemoveHint: 'આ ફોર્મમાંથી તેમનો ફોટો હટાવે છે. ફેરફાર રાખવા માટે સેવ કરો.',
    photoCancel: CANCEL,
    photoCancelHint: 'ફોટાના વિકલ્પો બંધ કરે છે',
    photoUploading: 'ફોટો અપલોડ થઈ રહ્યો છે…',
    photoProgress: PHOTO_PROGRESS,
    photoFailedTitle: 'ફોટો અપલોડ થયો નથી',
    photoRetry: TRY_AGAIN,
    photoDiscard: DISCARD,
    photoDiscardHint: FORGETS_FAILED_PHOTO,

    saveAdd: 'ટીમ મેમ્બર ઉમેરો',
    saveEdit: 'ફેરફારો સેવ કરો',
    saving: SAVING,
    saveAddHint: 'આ વ્યક્તિને તમારી ટીમમાં ઉમેરે છે',
    saveEditHint: 'આ ટીમ મેમ્બરની વિગતો સેવ કરે છે',
    saveFailedTitle: 'ટીમ મેમ્બરની વિગતો સેવ થઈ નથી',
    fixErrors: FIX_ERRORS,

    added: 'ટીમ મેમ્બર ઉમેરાઈ ગયા.',
    saved: 'ટીમ મેમ્બરની વિગતો અપડેટ થઈ ગઈ.',

    loading: 'આ ટીમ મેમ્બરની વિગતો લોડ થઈ રહી છે',
    failedTitle: 'અમે આ ટીમ મેમ્બરની વિગતો લોડ કરી શક્યા નહીં',
    notFoundTitle: 'આ વ્યક્તિ હવે તમારી ટીમમાં નથી',
    notFoundMessage: 'કદાચ તેમને કાઢી નાખવામાં આવ્યા હોય. તમારી હાલની ટીમ જોવા માટે પાછા જાઓ.',

    discardTitle: DISCARD_CHANGES,
    discardMessage: 'આ ટીમ મેમ્બરમાં કરેલા તમારા ફેરફારો હજી સેવ થયા નથી.',
    discardKeep: KEEP_EDITING,
    discardKeepHint: RETURNS_TO_FORM,
    discardConfirm: DISCARD,
    discardConfirmHint: LEAVES_WITHOUT_SAVING,

    statusSection: 'સ્થિતિ',
    statusActiveMessage:
      'જે વ્યક્તિ હાલ પૂરતી તમારી સાથે કામ ન કરતી હોય તેને નિષ્ક્રિય કરો. તે તમારી ટીમમાં રહેશે, અને તમે તેને ફરી સક્રિય કરી શકો છો.',
    statusDisabledMessage:
      'આ ટીમ મેમ્બર નિષ્ક્રિય તરીકે નોંધાયેલા છે. તમે ફરી સક્રિય ન કરો ત્યાં સુધી તેઓ તમારી ટીમમાં રહેશે.',
    statusUnknownMessage:
      'તેમની હાલની સ્થિતિ અહીં બતાવી શકાતી નથી. તમે હજી પણ તેમને નિષ્ક્રિય કરી શકો છો — તેઓ નિષ્ક્રિય તરીકે તમારી ટીમમાં રહેશે.',
    disable: 'મેમ્બરને નિષ્ક્રિય કરો',
    disableHint: 'આ ટીમ મેમ્બરને નિષ્ક્રિય કરતાં પહેલાં પૂછે છે',
    enable: 'મેમ્બરને સક્રિય કરો',
    enableHint: 'આ ટીમ મેમ્બરને ફરી સક્રિય કરે છે',

    disableTitle: (name: string) => `${name} ને નિષ્ક્રિય કરવા છે?`,
    disableMessage: 'તેઓ નિષ્ક્રિય તરીકે તમારી ટીમમાં રહેશે. તમે તેમને ફરી સક્રિય કરી શકો છો.',
    disableCancel: CANCEL,
    disableCancelHint: 'તેમની સ્થિતિ બદલ્યા વગર બંધ કરે છે',
    disableConfirm: 'નિષ્ક્રિય કરો',
    disableConfirmHint: 'આ ટીમ મેમ્બરને નિષ્ક્રિય કરે છે',

    disabled: 'ટીમ મેમ્બર નિષ્ક્રિય થયા.',
    enabled: 'ટીમ મેમ્બર સક્રિય થયા.',
    disableFailed: 'ટીમ મેમ્બરને નિષ્ક્રિય કરી શકાયા નથી.',
    enableFailed: 'ટીમ મેમ્બરને સક્રિય કરી શકાયા નથી.',
  },

  shopImages: {
    title: 'દુકાનના ફોટા',
    subtitle: 'તમારી દુકાન, તમારી વાન કે તમારા કામના ફોટા. દરેક ફેરફાર તમે કરો તેમ જ સેવ થાય છે.',
    back: BACK_TO_PROFILE,

    count: (count: number, max: number) => `${max} માંથી ${count} ફોટા`,
    emptyCount: (max: number) => `હજી કોઈ ફોટો નથી. તમે ${max} સુધી ઉમેરી શકો છો.`,

    loading: 'તમારી દુકાનના ફોટા લોડ થઈ રહ્યા છે',
    failedTitle: 'અમે તમારી દુકાનના ફોટા લોડ કરી શક્યા નહીં',

    photoSpoken: (position: number, total: number) => `દુકાનનો ફોટો ${position}, ${total} માંથી`,

    takePhoto: 'ફોટો લો',
    choosePhoto: 'ફોટો પસંદ કરો',
    takePhotoSpoken: (remaining: number) =>
      `ફોટો લો, કૅમેરાથી. હજી ${remaining === 1 ? '1 ફોટો' : `${remaining} ફોટા`} ઉમેરી શકાય છે.`,
    choosePhotoSpoken: (remaining: number) =>
      `ફોટો પસંદ કરો, તમારી ગૅલેરીમાંથી. હજી ${remaining === 1 ? '1 ફોટો' : `${remaining} ફોટા`} ઉમેરી શકાય છે.`,

    uploading: SHOP_UPLOADING,
    uploadFailed: SHOP_UPLOAD_FAILED,
    waiting: SHOP_WAITING,
    saving: SHOP_SAVING,
    removing: SHOP_REMOVING,
    notSaved: SHOP_NOT_SAVED,
    tryAgain: TRY_AGAIN,
    tryAgainSpoken: (position: number, total: number, state: string) =>
      `ફરી પ્રયાસ કરો, દુકાનનો ફોટો ${position}, ${total} માંથી, ${state}`,
    tryAgainHint: 'આ ફોટો ફરી મોકલે છે',
    removeSpoken: (position: number, total: number) =>
      `કાઢી નાખો: દુકાનનો ફોટો ${position}, ${total} માંથી`,
    removeHint: 'આ ફોટો તમારી દુકાનના ફોટામાંથી કાઢતાં પહેલાં પૂછે છે',
    discardHint: 'આ ફોટો સેવ કર્યા વગર હટાવી દે છે',

    removeTitle: 'આ ફોટો કાઢી નાખવો છે?',
    removeMessage: 'તેને તમારી દુકાનના ફોટામાંથી કાઢી નાખવામાં આવશે.',
    removeCancel: CANCEL,
    removeCancelHint: 'આ ફોટો રાખે છે',
    removeConfirm: 'કાઢી નાખો',
    removeConfirmHint: 'આ ફોટો તમારી દુકાનના ફોટામાંથી કાઢી નાખે છે',

    added: 'દુકાનનો ફોટો સેવ થઈ ગયો.',
    removed: 'દુકાનનો ફોટો કાઢી નાખ્યો.',
    saveFailed: 'ફોટો સેવ થયો નથી.',
    removeFailed: 'ફોટો કાઢી શકાયો નથી.',

    limitReached: (max: number) => `તમે વધુમાં વધુ ${max} દુકાનના ફોટા ઉમેરી શકો છો.`,
    unusable: 'તે ફોટો વાપરી શકાય તેમ નથી. કૃપા કરીને બીજો પસંદ કરો.',
    cameraUnavailable:
      'અમે કૅમેરા ખોલી શક્યા નહીં. તેના બદલે તમે ગૅલેરીમાંથી ફોટો પસંદ કરી શકો છો.',

    staleTitle: COULD_NOT_REFRESH,
    staleMessage: 'તમારી દુકાનના ફોટા કદાચ જૂના હોય.',
    staleRetry: TRY_AGAIN,
    staleRetryHint: 'તમારી દુકાનના ફોટા ફરી લોડ કરે છે',

    leaveTitle: 'ફોટા સેવ થાય તે પહેલાં બહાર નીકળવું છે?',
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
        ? `"${SHOP_UPLOADING}" કે "${SHOP_UPLOAD_FAILED}" લખેલા ફોટા તમારી દુકાનના ફોટામાં ઉમેરાશે નહીં, ` +
          `અને "${SHOP_WAITING}" કે "${SHOP_NOT_SAVED}" લખેલા ફોટા કદાચ ન ઉમેરાય. જે ફોટાના છેલ્લા ` +
          'સેવનો જવાબ ન આવ્યો હોય તે કદાચ સેવ થઈ પણ ગયો હોય; તમારી દુકાનના ફોટા પછીથી તપાસી લેજો.'
        : `"${SHOP_UPLOADING}", "${SHOP_WAITING}", "${SHOP_UPLOAD_FAILED}" કે "${SHOP_NOT_SAVED}" ` +
          'લખેલા ફોટા તમારી દુકાનના ફોટામાં ઉમેરાશે નહીં.') +
      (alsoSending
        ? ` "${SHOP_SAVING}" લખેલા ફોટાનું સેવ પૂરું થશે, અને જો તે સેવ ન થાય તો તમને જણાવીશું.`
        : '') +
      (alsoRemoving
        ? ` "${SHOP_REMOVING}" લખેલો ફોટો તો પણ કાઢી નાખવામાં આવશે, અને જો તે ન નીકળે તો તમને જણાવીશું.`
        : ''),
    leaveStay: 'અહીં રહો',
    leaveStayHint: 'તમારી દુકાનના ફોટા પર પાછા લઈ જાય છે',
    leaveConfirm: 'બહાર નીકળો',
    leaveConfirmHint: 'સેવ ન થયેલા ફોટા વગર બહાર નીકળે છે',
  },

  availability: {
    section: 'ઉપલબ્ધતા',
    acceptingLabel: 'નવી રિક્વેસ્ટ સ્વીકારવી',
    acceptingOn: 'ગ્રાહકો તમને પસંદ કરી શકે છે અને તમને નવી રિક્વેસ્ટ મળે છે.',
    acceptingOff: 'તમને નવી રિક્વેસ્ટ નહીં મળે. તમે સ્વીકારેલા કામ પર કોઈ અસર નથી.',
    acceptingSpoken: (explanation: string) => `નવી રિક્વેસ્ટ સ્વીકારવી. ${explanation}`,
    turnOffHint: 'નવી રિક્વેસ્ટ બંધ કરતાં પહેલાં પૂછે છે',
    turnOnHint: 'નવી રિક્વેસ્ટ ફરી ચાલુ કરે છે',

    stopTitle: 'નવી રિક્વેસ્ટ બંધ કરવી છે?',
    stopMessage:
      'તમે આ ફરી ચાલુ ન કરો ત્યાં સુધી ગ્રાહકો તમને પસંદ કરી શકશે નહીં અને તમને નવી રિક્વેસ્ટ મળશે નહીં. તમે સ્વીકારેલા કામ પર કોઈ અસર નથી.',
    stopCancel: CANCEL,
    stopCancelHint: 'નવી રિક્વેસ્ટ ચાલુ રાખે છે',
    stopConfirm: 'બંધ કરો',
    stopConfirmHint: 'તમે ફરી ચાલુ ન કરો ત્યાં સુધી નવી રિક્વેસ્ટ બંધ કરે છે',

    turnedOn: 'તમે ફરી નવી રિક્વેસ્ટ સ્વીકારી રહ્યા છો.',
    turnedOff: 'તમે નવી રિક્વેસ્ટ બંધ કરી છે.',
    turnOnFailed: 'નવી રિક્વેસ્ટ ચાલુ થઈ નથી.',
    turnOffFailed: 'નવી રિક્વેસ્ટ બંધ થઈ નથી.',

    hoursLabel: 'કામનો સમય',
    hoursEmpty: 'હજી ઉમેર્યો નથી',
    hoursEdit: 'કામનો સમય બદલો',
    hoursEditHint: 'દિવસો અને સમય બદલવા માટે તમારો કામનો સમય ખોલે છે',

    noticeTitle: 'તમે નવી રિક્વેસ્ટ સ્વીકારી રહ્યા નથી.',
    noticeTurnOn: 'ચાલુ કરો',
    noticeTurnOnSpoken: 'ચાલુ કરો: નવી રિક્વેસ્ટ',
    noticeTurnOnHint: 'તમને ફરી નવી રિક્વેસ્ટ મોકલવાનું શરૂ કરે છે',
  },

  workingHours: {
    title: 'કામનો સમય',
    subtitle:
      'તમે સામાન્ય રીતે જે દિવસો અને સમયે કામ કરો છો. તમે સેવ કરો ત્યાં સુધી કંઈ બદલાતું નથી.',
    back: BACK_TO_PROFILE,

    days: {
      MON: { short: 'સોમ', long: 'સોમવાર' },
      TUE: { short: 'મંગળ', long: 'મંગળવાર' },
      WED: { short: 'બુધ', long: 'બુધવાર' },
      THU: { short: 'ગુરુ', long: 'ગુરુવાર' },
      FRI: { short: 'શુક્ર', long: 'શુક્રવાર' },
      SAT: { short: 'શનિ', long: 'શનિવાર' },
      SUN: { short: 'રવિ', long: 'રવિવાર' },
    },
    unknownDay: 'દિવસ',

    closed: 'બંધ',
    open: 'ખુલ્લું',
    openSpoken: 'ખુલ્લું',
    hoursSpoken: (opens: string, closes: string) => `${opens} થી ${closes}`,
    dayRangeSpoken: (first: string, last: string) => `${first} થી ${last}`,
    closedSpoken: 'બંધ',

    dayOpenSpoken: (day: string, hours: string) => `${day}, ખુલ્લું, ${hours}`,
    dayClosedSpoken: (day: string) => `${day}, બંધ`,
    dayCloseHint: (day: string) => `${day} ને બંધ તરીકે નોંધે છે`,
    dayOpenHint: (day: string) => `${day} ને ખુલ્લા તરીકે નોંધે છે`,

    opensLabel: 'ખૂલે',
    closesLabel: 'બંધ થાય',
    opensSpoken: (day: string, time: string) => `${day} ખૂલવાનો સમય, ${time}`,
    closesSpoken: (day: string, time: string) => `${day} બંધ થવાનો સમય, ${time}`,
    timeHint: 'પસંદ કરવા માટે સમયની યાદી ખોલે છે',

    opensTitle: (day: string) => `${day} ખૂલવાનો સમય`,
    closesTitle: (day: string) => `${day} બંધ થવાનો સમય`,
    timesLabel: 'સમય',
    chooseCancel: CANCEL,
    chooseCancelHint: 'સમય બદલ્યા વગર યાદી બંધ કરે છે',

    closesBeforeOpens: 'બંધ થવાનો સમય ખૂલવાના સમય પછીનો હોવો જોઈએ.',

    copyMonday: 'સોમવારનો સમય શુક્રવાર સુધી કૉપિ કરો',
    copyMondayHint: 'મંગળવારથી શુક્રવારને સોમવાર જેવો જ સમય આપે છે',
    copiedMonday: 'મંગળવારથી શુક્રવાર સુધી હવે સોમવાર જેવો જ સમય છે.',

    save: 'ફેરફારો સેવ કરો',
    saving: SAVING,
    saveHint: 'તમારો કામનો સમય સેવ કરે છે',
    saveFailedTitle: 'તમારો કામનો સમય સેવ થયો નથી',
    fixErrors: 'હાઇલાઇટ કરેલા દિવસો તપાસો.',
    saved: 'કામનો સમય સેવ થઈ ગયો.',

    discardTitle: DISCARD_CHANGES,
    discardMessage: 'તમારા કામના સમયમાં કરેલા ફેરફારો હજી સેવ થયા નથી.',
    discardKeep: KEEP_EDITING,
    discardKeepHint: 'તમારા કામના સમય પર પાછા લઈ જાય છે',
    discardConfirm: DISCARD,
    discardConfirmHint: LEAVES_WITHOUT_SAVING,
  },

  profile: {
    title: 'પ્રોફાઇલ',
    businessSection: 'બિઝનેસ',
    descriptionLabel: 'પરિચય',
    categoriesLabel: 'સેવાઓ',
    areaLabel: 'સેવા વિસ્તાર',
    notProvided: NOT_ADDED_YET,
    categoriesFailed: 'સેવાઓનાં નામ લોડ થઈ શક્યાં નહીં',
    contactSection: 'સંપર્ક',
    ownerLabel: 'માલિક',
    phoneLabel: 'ફોન',
    emailLabel: 'ઇમેઇલ',
    edit: 'બિઝનેસ પ્રોફાઇલમાં ફેરફાર કરો',
    editHint: 'બિઝનેસ પ્રોફાઇલનું ફોર્મ ખોલે છે',
    reviews: 'ગ્રાહકોના રિવ્યૂ',
    reviewsHint: 'તમારા કામ વિશે ગ્રાહકોએ લખેલા રિવ્યૂ ખોલે છે',
    reviewsWithRating: (rating: string) => `ગ્રાહકોના રિવ્યૂ. ${rating}`,
    reports: 'રિપોર્ટ',
    reportsHint: 'આજના, આ અઠવાડિયાના કે આ મહિનાના તમારી રિક્વેસ્ટ અને રેટિંગના આંકડા ખોલે છે',
    team: 'ટીમ મેનેજ કરો',
    teamHint: 'તમારી ટીમ ખોલે છે',
    shopImagesSection: 'દુકાનના ફોટા',
    shopImagesEmpty: 'હજી દુકાનના કોઈ ફોટા નથી',
    shopImages: 'દુકાનના ફોટા મેનેજ કરો',
    shopImagesHint: 'ફોટા ઉમેરવા કે કાઢવા માટે તમારી દુકાનના ફોટા ખોલે છે',
    logout: 'લૉગ આઉટ',
    logoutHint: 'તમને સાઇન આઉટ કરતાં પહેલાં પૂછે છે',
    logoutFailedTitle: 'અમે તમને સાઇન આઉટ કરી શક્યા નહીં',
    logoutConfirmTitle: 'લૉગ આઉટ કરવું છે?',
    logoutConfirmMessage: 'તમે ફરી સાઇન ઇન કરો ત્યારે માટે તમારી બિઝનેસ પ્રોફાઇલ સેવ રહેશે.',
    logoutCancel: CANCEL,
    logoutCancelHint: 'તમને સાઇન ઇન રાખે છે',
    logoutConfirm: 'લૉગ આઉટ',
    logoutConfirmHint: 'તમને Fixora માંથી સાઇન આઉટ કરે છે',
  },
};
