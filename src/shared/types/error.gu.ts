/**
 * AppError copy — Gujarati
 *
 * The Gujarati of every sentence in `error.ts` (phase5-contract.md section 7).
 * Typed against the English table, so a code that English does not have fails
 * `tsc`; a code left out here reads in English.
 *
 * Everyday wording, the way a customer or a shop owner would say it — common
 * English loanwords (કોડ, એકાઉન્ટ, ફોટો, રિક્વેસ્ટ, પ્રોફેશનલ) where they are
 * what people actually use. `{wait}`, `{minutes}` and `{hours}` stay exactly as
 * they are; only the words around them move.
 *
 * ⚠️ Keep `FILE_TYPE_NOT_ALLOWED` identical to the device check's sentence in
 * `shared/validation/validationCopy.gu.ts`, as the English pair is. Same for
 * `REQUEST_NOT_CANCELLABLE` and the customer copy's `cancelRequest.refused`.
 */

import type { LocaleTable } from '@/core/i18n';
import type { ERROR_COPY_EN } from '@/shared/types/error';

const USER_MESSAGE = {
  network: 'ઇન્ટરનેટ કનેક્શન નથી. તમારું નેટવર્ક તપાસો અને ફરી પ્રયાસ કરો.',
  timeout: 'આમાં ધાર્યા કરતાં વધુ સમય લાગી રહ્યો છે. કૃપા કરીને ફરી પ્રયાસ કરો.',
  unauthorized: 'તમારું સેશન પૂરું થઈ ગયું છે. કૃપા કરીને ફરી સાઇન ઇન કરો.',
  forbidden: 'તમને આની પરવાનગી નથી.',
  notFound: 'તમે જે શોધી રહ્યા હતા તે અમને મળ્યું નહીં.',
  validation: 'કૃપા કરીને તમે ભરેલી વિગતો તપાસો.',
  conflict: 'આ કામ તાજેતરના કોઈ ફેરફાર સાથે મેળ ખાતું નથી. કૃપા કરીને રિફ્રેશ કરો.',
  permission: 'આગળ વધવા માટે પરવાનગી જરૂરી છે.',
  server: 'અમારી તરફથી કંઈક ખોટું થયું. કૃપા કરીને ફરી પ્રયાસ કરો.',
  cancelled: 'આ કામ રદ કરવામાં આવ્યું.',
  unknown: 'કંઈક ખોટું થયું. કૃપા કરીને ફરી પ્રયાસ કરો.',
} as const;

export const ERROR_COPY_GU: LocaleTable<typeof ERROR_COPY_EN> = {
  userMessage: USER_MESSAGE,
  backendCode: {
    VALIDATION_FAILED: USER_MESSAGE.validation,
    UNAUTHORIZED: USER_MESSAGE.unauthorized,
    OTP_INVALID: 'આ કોડ સાચો નથી. કૃપા કરીને તપાસો અને ફરી પ્રયાસ કરો.',
    OTP_EXPIRED: 'આ કોડનો સમય પૂરો થઈ ગયો છે. નવો કોડ મંગાવો.',
    OTP_TOO_MANY_ATTEMPTS: 'ઘણી વાર ખોટો કોડ નાખવામાં આવ્યો. ફરી પ્રયાસ કરવા માટે નવો કોડ મંગાવો.',
    OTP_RESEND_TOO_SOON: 'બીજો કોડ મંગાવતા પહેલાં કૃપા કરીને થોડી રાહ જુઓ.',
    OTP_DELIVERY_FAILED: 'અત્યારે અમે તમારો કોડ મોકલી શક્યા નહીં. કૃપા કરીને ફરી પ્રયાસ કરો.',
    PHONE_ALREADY_REGISTERED: 'આ નંબરનું એકાઉન્ટ પહેલેથી બનેલું છે. તેના બદલે સાઇન ઇન કરી જુઓ.',
    ACCOUNT_SUSPENDED: 'આ એકાઉન્ટ અત્યારે ચાલુ નથી, તેથી તમે તેનાથી સાઇન ઇન કરી શકતા નથી.',
    REGISTRATION_NOT_FOUND: 'આ રજિસ્ટ્રેશન હવે ઉપલબ્ધ નથી. કૃપા કરીને ફરીથી શરૂ કરો.',
    NOT_SUPPORTED: 'આ સુવિધા હજી ઍપમાં ઉપલબ્ધ નથી.',
    CAMERA_UNAVAILABLE:
      'અત્યારે કૅમેરા વાપરી શકાતો નથી. તેના બદલે તમે ગૅલેરીમાંથી ફોટો પસંદ કરી શકો છો.',
    EMAIL_REQUIRED_FOR_SIGN_IN:
      'તમારું ઇમેઇલ સરનામું કાઢી શકાતું નથી, કારણ કે તેનાથી જ તમે આ એકાઉન્ટમાં સાઇન ઇન કરો છો.',
    FILE_TOO_LARGE: 'આ ફોટો અપલોડ કરવા માટે ખૂબ મોટો છે. કૃપા કરીને નાનો ફોટો પસંદ કરો.',
    FILE_TYPE_NOT_ALLOWED: 'ફક્ત JPG, PNG અને WebP ફોટા જ લગાવી શકાય છે.',
    TOO_MANY_FILES: 'એકસાથે ઘણા બધા ફોટા મોકલાયા. કૃપા કરીને ઓછા ફોટા સાથે ફરી પ્રયાસ કરો.',
    REQUEST_NOT_FOUND: 'અમને તે રિક્વેસ્ટ મળી નહીં.',
    REQUEST_NOT_CANCELLABLE:
      'એક પ્રોફેશનલે આ રિક્વેસ્ટ પહેલેથી સ્વીકારી લીધી છે, તેથી તેને અહીં રદ કરી શકાતી નથી.',
    PAYMENT_ALREADY_RECORDED: 'આ કામની ચુકવણી પહેલેથી નોંધાઈ ગઈ છે.',
    NOTIFICATION_NOT_FOUND: 'આ નોટિફિકેશન હવે ઉપલબ્ધ નથી.',
    REQUEST_ALREADY_TAKEN: 'આ રિક્વેસ્ટ હવે ઉપલબ્ધ નથી. બીજા પ્રોફેશનલે તેને પહેલાં સ્વીકારી લીધી.',
    REQUEST_NOT_PENDING: 'આ રિક્વેસ્ટ હવે જવાબની રાહ જોઈ રહી નથી.',
    INVALID_TRANSITION: 'આ કામમાં પહેલેથી ફેરફાર થઈ ગયો છે. તેની તાજી સ્થિતિ બતાવવામાં આવી રહી છે.',
    RATE_LIMITED: 'ઘણા બધા પ્રયાસો થઈ ગયા. કૃપા કરીને થોડી રાહ જોઈને ફરી પ્રયાસ કરો.',
    REVIEW_NOT_FOUND: 'આ રિક્વેસ્ટ માટે કોઈ રિવ્યૂ મળ્યો નહીં.',
  },
  backendCodeWait: {
    RATE_LIMITED: 'ઘણા બધા પ્રયાસો થઈ ગયા. {wait} પછી ફરી પ્રયાસ કરો.',
  },
  wait: {
    oneMinute: '1 મિનિટ',
    minutes: '{minutes} મિનિટ',
    oneHour: '1 કલાક',
    hours: '{hours} કલાક',
  },
};
